import { tailorGraph } from "@/lib/graph"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  const { resume, jd, locale } = await req.json()
  if (!resume || !jd) {
    return new Response(JSON.stringify({ error: "缺少简历或 JD" }), {
      status: 400,
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      try {
        const events = await tailorGraph.stream(
          { resume, jd, locale:locale || "zh" },
          { streamMode: "updates" }
        )
        for await (const chunk of events) {
          for (const [node, value] of Object.entries(chunk)) {
            send({ node, value })
          }
        }
        send({ done: true })
      } catch (e) {
        const message = e instanceof Error ? e.message : "PDF 解析失败"
        send({ error: message ?? "未知错误" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}