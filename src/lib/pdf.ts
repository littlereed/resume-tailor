import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf"
import { writeFile, unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

export async function parsePDFBuffer(buffer: Buffer): Promise<string> {
  const tmpPath = join(tmpdir(), `resume-${Date.now()}.pdf`)
  await writeFile(tmpPath, buffer)
  try {
    const loader = new PDFLoader(tmpPath, { splitPages: false })
    const docs = await loader.load()
    return docs.map((d) => d.pageContent).join("\n")
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}