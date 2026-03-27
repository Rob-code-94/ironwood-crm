import { NextResponse } from "next/server"
import { getGoogleApiKeyFromRequest } from "@/lib/ai-request"
import { resolveGeminiModel, type SimpleChatMessage } from "@/lib/gemini-client"
import { GoogleGenerativeAI } from "@google/generative-ai"

type Body = {
  messages?: SimpleChatMessage[]
  message?: string
  system?: string
  model?: string
}

function normalizeMessages(body: Body): SimpleChatMessage[] | null {
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    const out: SimpleChatMessage[] = []
    for (const m of body.messages) {
      if (
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
      ) {
        out.push({ role: m.role, content: m.content })
      }
    }
    return out.length ? out : null
  }

  if (typeof body.message === "string" && body.message.trim()) {
    return [{ role: "user", content: body.message.trim() }]
  }

  return null
}

const DEFAULT_RESEARCH_SYSTEM = `You are the in-app research assistant for Ironwood Planner.

You can use Google web search grounding to find company phone numbers, addresses, websites, and contact details.
Return final answers in natural language and include a short list of source URLs at the end.`

const RESEARCH_INTENT_RE =
  /\b(find|lookup|research|search)\b.*\b(phone|number|contact|company|website|email|address)\b|\b(phone|number|contact|company|website|email|address)\b.*\b(find|lookup|research|search)\b/i

function extractLatestUserText(messages: SimpleChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === "user") return m.content
  }
  return ""
}

export async function POST(req: Request) {
  const apiKey = getGoogleApiKeyFromRequest(req)
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini is not configured. Set GOOGLE_API_KEY or a session key." },
      { status: 503 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const messages = normalizeMessages(body)
  if (!messages) {
    return NextResponse.json(
      { error: "Provide a non-empty messages array or a message string." },
      { status: 400 }
    )
  }

  const modelId = resolveGeminiModel(body.model)
  const systemInstruction = body.system?.trim() || DEFAULT_RESEARCH_SYSTEM

  const latestUserText = extractLatestUserText(messages)
  // This endpoint is intentionally called only when we expect lookup/search intent,
  // but keep a server-side guard to avoid accidental grounding calls.
  if (!RESEARCH_INTENT_RE.test(latestUserText)) {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: modelId,
      systemInstruction,
    })

    const res = await model.generateContent(
      {
        contents: [{ role: "user", parts: [{ text: latestUserText }] }],
      },
      { signal: req.signal }
    )

    return NextResponse.json({ text: res.response.text() })
  }

  // Google grounding with search:
  // Enable the model's built-in Google Search retrieval tool so it can fetch web facts
  // and provide grounding metadata back to us.
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelId,
    systemInstruction,
  })

  const res = await model.generateContent(
    {
      contents: [{ role: "user", parts: [{ text: latestUserText }] }],
      tools: [{ googleSearchRetrieval: {} }],
    },
    { signal: req.signal }
  )

  const text = res.response.text()

  const groundingChunks = res.response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
  const sourceUrls = groundingChunks
    .map((c) => c.web?.uri)
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)

  // De-dupe while preserving order.
  const deduped = Array.from(new Set(sourceUrls))

  const sourcesSection = deduped.length
    ? `\n\nSources:\n${deduped.map((u) => `- ${u}`).join("\n")}`
    : ""

  return NextResponse.json({ text: `${text}${sourcesSection}` })
}

