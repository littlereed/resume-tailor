import { StateGraph, Annotation, START, END } from "@langchain/langgraph"
import { PromptTemplate } from "@langchain/core/prompts"
import { z } from "zod"
import { llm, invokeWithRetry } from "./llm"

// ── 状态定义 ──
const TailorState = Annotation.Root({
  resume: Annotation<string>(),
  jd: Annotation<string>(),
  locale: Annotation<string>({          
    reducer: (_, b) => b,
    default: () => "zh",
  }),
  optimized: Annotation<string>({
    reducer: (_, b) => b,
    default: () => ""
  }),
  score: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0
  }),
  feedback: Annotation<string>({
    reducer: (_, b) => b,
    default: () => ""
  }),
  rounds: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),
})

type State = typeof TailorState.State

// ── ① PromptTemplate ──
// locale → 自然语言名称(给 LLM 看的)
const LANG_MAP: Record<string, string> = {
  zh: "中文(简体中文)",
  en: "English",
  ja: "日本語",
};

const rewritePrompt = PromptTemplate.fromTemplate(`
你是资深简历顾问。请用 {language} 改写下面的简历。

要求:
1. 必须用 {language} 输出,这一点最重要。
2. 输出【完整的】简历,保留原简历的所有关键信息,不要删减任何经历。
3. 在保留内容的基础上优化:措辞更专业、突出与 JD 相关的技能、用更有力的动词。
4. 不要编造原简历里没有的事实。
5. 篇幅与原简历相当,不要无故拉长。
{feedbackSection}

【目标岗位 JD】
{jd}

【原简历】
{resume}

直接输出完整的优化后简历正文(用 {language}),不要任何解释,不要 markdown 标记。
`)

// ── ② 结构化输出 schema ──
const scoreSchema = z.object({
  score: z.number().min(0).max(100).describe("简历与 JD 的匹配度分数"),
  feedback: z.string().describe("一句话具体改进建议"),
})

const scorer = llm.withStructuredOutput(scoreSchema, { name: "resume_score" })

// ── 节点 1:改写 ──
async function rewriteNode(state: State) {
  const feedbackSection = state.feedback
    ? `上一轮评估反馈:${state.feedback},请针对性改进。`
    : ""
  const prompt = await rewritePrompt.format({
    language: LANG_MAP[state.locale] ?? "中文",
    feedbackSection,
    jd: state.jd,
    resume: state.optimized || state.resume,
  })
  const optimized = await invokeWithRetry(prompt)
  return { optimized, rounds: state.rounds + 1 }
}

// ── 节点 2:评分 ──
async function scoreNode(state: State) {
  try {
    const language = LANG_MAP[state.locale] ?? "中文";
    const result = await scorer.invoke(
      `评估这份简历与目标岗位 JD 的匹配度,给出 0-100 分和改进建议。
        用 ${language} 给出 feedback。
       【JD】${state.jd}
       【简历】${state.optimized}`
    )
    return { score: result.score, feedback: result.feedback }
  } catch {
    return { score: 75, feedback: "评分解析失败,使用默认值" }
  }
}

// ── 条件路由:不达标且轮数 < 3 就继续改 ──
function shouldContinue(state: State): "rewrite" | typeof END {
  if (state.score < 85 && state.rounds < 3) return "rewrite"
  return END
}

// ── 组装图 ──
export const tailorGraph = new StateGraph(TailorState)
  .addNode("rewrite", rewriteNode)
  .addNode("scoreNode", scoreNode)
  .addEdge(START, "rewrite")
  .addEdge("rewrite", "scoreNode")
  .addConditionalEdges("scoreNode", shouldContinue, {
    rewrite: "rewrite",
    [END]: END,
  })
  .compile()