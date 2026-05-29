import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { llm } from "./llm"

export const extractKeywordsTool = tool(
  async ({ jd }: { jd: string }) => {
    const res = await llm.invoke(
      `从下面的职位描述中提取最关键的技能要求和关键词,
       只返回逗号分隔的关键词列表:\n\n${jd}`
    )
    return res.content as string
  },
  {
    name: "extract_jd_keywords",
    description: "从职位描述中提取关键技能要求和关键词",
    schema: z.object({ jd: z.string().describe("职位描述全文") }),
  }
)

export const keywordMatchTool = tool(
  async ({ resume, keywords }: { resume: string; keywords: string }) => {
    const kwList = keywords.split(/[,,、]/).map((k) => k.trim()).filter(Boolean)
    const matched = kwList.filter((kw) => resume.toLowerCase().includes(kw.toLowerCase()))
    const missing = kwList.filter((kw) => !matched.includes(kw))
    const matchRate = kwList.length ? Math.round((matched.length / kwList.length) * 100) : 0
    return JSON.stringify({ matchRate, matched, missing })
  },
  {
    name: "calculate_keyword_match",
    description: "计算简历覆盖了 JD 关键词的比例",
    schema: z.object({
      resume: z.string().describe("简历内容"),
      keywords: z.string().describe("JD 关键词,逗号分隔"),
    }),
  }
)