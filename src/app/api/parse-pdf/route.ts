import { parsePDFBuffer } from "@/lib/pdf"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return Response.json({ error: "未收到文件" }, { status: 400 })
    if (file.type !== "application/pdf") {
      return Response.json({ error: "仅支持 PDF 文件" }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await parsePDFBuffer(buffer)
    return Response.json({ text })
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF 解析失败"
    return Response.json({ error: message ?? "PDF 解析失败" }, { status: 500 })
  }
}