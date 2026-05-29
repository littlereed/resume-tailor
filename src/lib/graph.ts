import { StateGraph, Annotation, START, END } from "@langchain/langgraph"
import { PromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { llm, invokeWithRetry, withRetry, isQuotaError } from "./llm"
import { extractKeywordsTool, keywordMatchTool } from "./tools"

// 开关:控制是否启用第二重验证(配额紧张时设 false)
const ENABLE_VERIFY = process.env.ENABLE_VERIFY === "true"
// 状态定义
const TailorState = Annotation.Root({
  resume: Annotation<string>(),
  jd: Annotation<string>(),
  locale: Annotation<string>({ reducer: (_, b) => b, default: () => "zh" }),
  keywords: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  optimized: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  score: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  matchRate: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  feedback: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  feedbackCode: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  rounds: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  degraded: Annotation<boolean>({ reducer: (_, b) => b, default: () => false }),
  hallucinationFound: Annotation<boolean>({
    reducer: (_, b) => b,
    default: () => false,
  }),
  hallucinationDetail: Annotation<string>({
    reducer: (_, b) => b,
    default: () => "",
  }),
  missing: Annotation<string[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
})

type State = typeof TailorState.State

// 语言映射
const LANG_MAP: Record<string, string> = {
  zh: "中文(简体中文)",
  en: "English",
  ja: "日本語",
}

// 改写 Prompt(含防幻觉强约束)
const rewritePrompt = PromptTemplate.fromTemplate(`
你是资深简历顾问。请用 {language} 改写下面的简历。

【目标岗位的关键要求】(请重点围绕这些优化)
{keywords}

═══ 核心约束(防止捏造,最重要)═══
1. 只能基于【原简历已有的事实】进行改写,你的任务是优化【表达方式】,不是创造内容。
2. 严禁添加原简历中不存在的:工作经历、公司、项目、技能、证书、具体数字、成就。
3. 不要为了贴合 JD 而虚构经历。如果原简历缺少 JD 要求的某项技能,不要假装有——可以调整措辞突出相关的既有经历,但绝不编造。
4. 如果原简历信息不足,宁可保守保留,也不要填充虚假内容。

═══ 优化要求 ═══
5. 必须用 {language} 输出。
6. 输出【完整的】简历,保留原简历的所有关键信息,不要删减任何经历。
7. 在【真实】的前提下,优化措辞:用更专业、更有力的动词,突出与关键要求相关的既有技能和经历。
8. 篇幅与原简历相当,不要无故拉长。
{feedbackSection}

【目标岗位 JD】
{jd}

【原简历】
{resume}

直接输出完整的优化后简历正文(用 {language}),不要任何解释,不要 markdown 标记。
`)

// 评分 schema(结构化输出)
const scoreSchema = z.object({
  score: z.number().min(0).max(100).describe("简历与 JD 的匹配度分数"),
  feedback: z.string().describe("一句话具体改进建议"),
})

const scorer = llm.withStructuredOutput(scoreSchema, { name: "resume_score" })
// 幻觉检测 schema(第二重验证)
const verifySchema = z.object({
  hasFabrication: z
    .boolean()
    .describe("优化版是否包含原简历没有的捏造内容"),
  fabricatedItems: z
    .array(z.string())
    .describe("捏造的具体内容列表,没有则为空数组"),
})

const verifier = llm.withStructuredOutput(verifySchema, {
  name: "hallucination_check",
})

// 节点 1:提取 JD 关键词(tool calling)
async function extractNode(state: State) {
  try {
    const keywords = await extractKeywordsTool.invoke({ jd: state.jd })
    return { keywords }
  } catch (e) {
    if (isQuotaError(e)) {
      return { keywords: "", degraded: true }
    }
    return { keywords: "" }
  }
}

// 节点 2:改写(含配额降级)
async function rewriteNode(state: State) {
  const feedbackSection = state.feedback
    ? `上一轮评估反馈:${state.feedback},请针对性改进。`
    : ""

  const prompt = await rewritePrompt.format({
    language: LANG_MAP[state.locale] ?? "中文",
    keywords: state.keywords || "(未提取到关键词)",
    feedbackSection,
    jd: state.jd,
    resume: state.optimized || state.resume,
  })

  try {
    const optimized = await invokeWithRetry(prompt)
    return { optimized, rounds: state.rounds + 1 }
  } catch (e) {
    if (isQuotaError(e)) {
      // 降级:用原简历兜底
      return {
        optimized: state.optimized || state.resume,
        rounds: state.rounds + 1,
        degraded: true,
      }
    }
    throw e
  }
}

// 节点 3:评分(tool 算客观匹配率 + LLM 综合 + 配额降级)
async function scoreNode(state: State) {
  const language = LANG_MAP[state.locale] ?? "中文"
  // 1. 客观匹配率(零配额)
  let matchRate = 0
  let missing: string[] = []
  try {
    const matchRaw = await keywordMatchTool.invoke({
      resume: state.optimized,
      keywords: state.keywords,
    })
    const parsed = JSON.parse(matchRaw)
    matchRate = parsed.matchRate
    missing = parsed.missing ?? []
  } catch {
    matchRate = 0
  }

  // 2. 已降级则直接用客观分,跳过 LLM
  if (state.degraded) {
    return { score: matchRate, feedbackCode: "err_quota_degraded", matchRate, missing }
  }
  // 3. LLM 综合评分
  try {
    const result = await withRetry(() =>
      scorer.invoke(
        `客观关键词匹配率为 ${matchRate}%,缺失的关键词:${missing.join("、") || "无"}。
         请结合这个客观数据,综合评估简历与 JD 的匹配度,给出 0-100 分和改进建议。
         用 ${language} 给出 feedback。
         【JD】${state.jd}
         【简历】${state.optimized}`
      )
    )
    return { score: result.score, feedback: result.feedback, matchRate, missing }
  } catch (e) {
    if (isQuotaError(e)) {
      return {
        score: matchRate,
        feedbackCode: "err_quota_degraded",
        matchRate,
        missing,
        degraded: true,
      }
    }
    return { score: matchRate, feedbackCode: "err_score_fallback", matchRate, missing }
  }
}

// 节点 4:幻觉检测(第二重验证,由开关控制)
async function verifyNode(state: State) {
  try {
    const result = await withRetry(() =>
      verifier.invoke(
        `对比【原简历】和【优化后简历】,检查优化版是否捏造了原简历中【完全不存在】的事实。
         重点检查:新增的公司、职位、项目、技能、证书、具体数字、成就。
         注意:仅仅是表达方式的优化、措辞的改进【不算】捏造,只有凭空新增的事实才算。

         【原简历】
         ${state.resume}

         【优化后简历】
         ${state.optimized}`
      )
    )
    return {
      hallucinationFound: result.hasFabrication,
      hallucinationDetail: result.fabricatedItems.join("、"),
    }
  } catch (e) {
    if (isQuotaError(e)) {
      // 配额满,跳过验证,不阻断主流程
      return { hallucinationFound: false, hallucinationDetail: "" }
    }
    return { hallucinationFound: false, hallucinationDetail: "" }
  }
}

// 条件路由:决定下一步去哪
function shouldContinue(
  state: State
): "rewrite" | "verify" | typeof END {
  // 降级了直接结束(省配额)
  if (state.degraded) return END

  // 分数不达标且未到上限 → 继续改写
  if (state.score < 85 && state.rounds < 3) return "rewrite"

  // 分数达标 → 看是否启用第二重验证
  return ENABLE_VERIFY ? "verify" : END
}

export const tailorGraph = new StateGraph(TailorState)
  .addNode("extract", extractNode)
  .addNode("rewrite", rewriteNode)
  .addNode("fitness", scoreNode)
  .addNode("verify", verifyNode)
  .addEdge(START, "extract")
  .addEdge("extract", "rewrite")
  .addEdge("rewrite", "fitness")
  .addConditionalEdges("fitness", shouldContinue, {
    rewrite: "rewrite",
    verify: "verify",
    [END]: END,
  })
  .addEdge("verify", END)
  .compile()