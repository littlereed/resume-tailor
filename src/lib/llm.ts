import { ChatGoogleGenerativeAI } from "@langchain/google-genai"

export const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash-lite",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0.4,
  maxRetries: 3,              // 1.x 内置重试(第一层)
})

// 手写指数退避(第二层,专门兜免费层 15 RPM 硬限流)
export async function invokeWithRetry(
  input: string,
  retries = 4
): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await llm.invoke(input)
      return res.content as string
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const status = (e as { status?: number })?.status
      const is429 = status === 429 || /429|rate|quota/i.test(msg)
      if (is429 && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 2 ** i * 1000))
        continue
    }
      throw e
    }
  }
  throw new Error("重试次数耗尽")
}