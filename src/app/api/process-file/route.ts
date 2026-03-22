import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getGoogleApiKeyFromRequest } from "@/lib/ai-request"
import { resolveGeminiModel } from "@/lib/gemini-client"

const MAX_BYTES = 6 * 1024 * 1024

export async function POST(req: Request) {
  const apiKey = getGoogleApiKeyFromRequest(req)
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini is not configured. Set GOOGLE_API_KEY or session key." },
      { status: 503 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / (1024 * 1024)} MB)` },
      { status: 413 }
    )
  }

  const instructionsRaw = form.get("instructions")
  const instructions =
    typeof instructionsRaw === "string" && instructionsRaw.trim()
      ? instructionsRaw.trim()
      : "Analyze this file. Summarize key points and list concrete action items with any dates mentioned."

  const buf = Buffer.from(await file.arrayBuffer())
  const base64 = buf.toString("base64")
  const mimeType = file.type || "application/octet-stream"

  const modelField = form.get("model")
  const modelId = resolveGeminiModel(
    typeof modelField === "string" ? modelField : undefined
  )
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: modelId })

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: instructions },
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
    })

    const extracted = result.response.text()
    return NextResponse.json({
      extracted,
      fileName: file.name,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to analyze file",
        fileName: file.name,
        timestamp: new Date().toISOString(),
      },
      { status: 502 }
    )
  }
}
