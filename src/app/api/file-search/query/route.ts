import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { getGoogleApiKeyFromRequest } from "@/lib/ai-request"
import { resolveGeminiModel, type SimpleChatMessage } from "@/lib/gemini-client"

type Body = {
  storeName?: string
  query?: string
  model?: string
  system?: string
  messages?: SimpleChatMessage[]
}

export async function POST(req: Request) {
  const apiKey = getGoogleApiKeyFromRequest(req)
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini is not configured. Set GOOGLE_API_KEY or session key." },
      { status: 503 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const storeName =
    typeof body.storeName === "string" && body.storeName.startsWith("fileSearchStores/")
      ? body.storeName
      : ""
  const query = typeof body.query === "string" ? body.query.trim() : ""
  if (!storeName) {
    return NextResponse.json({ error: "storeName is required" }, { status: 400 })
  }
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  const modelId = resolveGeminiModel(body.model)
  const systemInstruction = typeof body.system === "string" ? body.system.trim() : undefined

  const ai = new GoogleGenAI({ apiKey })

  const contents = query
  const res = await ai.models.generateContent({
    model: modelId,
    contents,
    config: {
      systemInstruction,
      tools: [{ fileSearch: { fileSearchStoreNames: [storeName], topK: 8 } }],
    },
  })

  return NextResponse.json({ text: res.text ?? "" })
}

