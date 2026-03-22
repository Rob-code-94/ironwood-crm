import { GoogleGenerativeAI } from "@google/generative-ai"
import {
  CRM_AI_MODELS,
  DEFAULT_CRM_MODEL,
  type CrmAiModelId,
} from "@/lib/crm-ai-settings"

export function resolveGeminiModel(requested?: string): CrmAiModelId {
  if (requested && (CRM_AI_MODELS as readonly string[]).includes(requested)) {
    return requested as CrmAiModelId
  }
  const env = process.env.GEMINI_MODEL?.trim()
  if (env && (CRM_AI_MODELS as readonly string[]).includes(env)) {
    return env as CrmAiModelId
  }
  return DEFAULT_CRM_MODEL
}

export type SimpleChatMessage = {
  role: "user" | "assistant"
  content: string
}

/** Merge consecutive same-role turns so Gemini `startChat` history stays valid. */
export function coalesceChatTurns(messages: SimpleChatMessage[]): SimpleChatMessage[] {
  const out: SimpleChatMessage[] = []
  for (const m of messages) {
    const text = m.content.trim()
    if (!text) continue
    const last = out[out.length - 1]
    if (last && last.role === m.role) {
      last.content += `\n${text}`
    } else {
      out.push({ role: m.role, content: text })
    }
  }
  return out
}

export async function* streamGeminiChat(options: {
  apiKey: string
  model: CrmAiModelId
  systemInstruction?: string
  messages: SimpleChatMessage[]
  signal?: AbortSignal
}): AsyncGenerator<string> {
  const merged = coalesceChatTurns(options.messages)
  if (merged.length === 0) return

  const genAI = new GoogleGenerativeAI(options.apiKey)
  const model = genAI.getGenerativeModel({
    model: options.model,
    systemInstruction: options.systemInstruction?.trim() || undefined,
  })

  const last = merged[merged.length - 1]

  if (last.role !== "user") {
    const prompt = merged.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n")
    const stream = await model.generateContentStream(prompt, { signal: options.signal })
    for await (const chunk of stream.stream) {
      const t = chunk.text()
      if (t) yield t
    }
    return
  }

  const history = merged.slice(0, -1).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }))

  const chat = model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: 8192,
    },
  })

  const stream = await chat.sendMessageStream(last.content, { signal: options.signal })

  for await (const chunk of stream.stream) {
    const t = chunk.text()
    if (t) yield t
  }
}

export async function generateGeminiText(options: {
  apiKey: string
  model: CrmAiModelId
  systemInstruction?: string
  prompt: string
  signal?: AbortSignal
}): Promise<string> {
  const genAI = new GoogleGenerativeAI(options.apiKey)
  const model = genAI.getGenerativeModel({
    model: options.model,
    systemInstruction: options.systemInstruction?.trim() || undefined,
  })
  const res = await model.generateContent(
    { contents: [{ role: "user", parts: [{ text: options.prompt }] }] },
    { signal: options.signal }
  )
  return res.response.text()
}
