import { ChatGoogleGenerativeAI } from "@langchain/google-genai"

export const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash-lite",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.4,
  maxRetries: 3,
})

// 判断是否配额/限流错误
export function isQuotaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /429|quota|rate|exceeded|too many|resource.*exhausted/i.test(msg)
}

// 字符串返回的退避重试(改写节点用)
export async function invokeWithRetry(input: string, retries = 4): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await llm.invoke(input)
      return res.content as string
    } catch (e) {
      if (isQuotaError(e) && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 2 ** i * 1000))
        continue
      }
      throw e
    }
  }
  throw new Error("重试次数耗尽")
}

// 通用退避重试(评分节点的 scorer 用)
export async function withRetry<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (e) {
      if (isQuotaError(e) && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 2 ** i * 1000))
        continue
      }
      throw e
    }
  }
  throw new Error("重试次数耗尽")
}