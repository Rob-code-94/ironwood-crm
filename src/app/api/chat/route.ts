import { NextResponse } from "next/server"
import { getGoogleApiKeyFromRequest } from "@/lib/ai-request"
import { resolveGeminiModel, streamGeminiChat, generateGeminiChatOnce, type SimpleChatMessage } from "@/lib/gemini-client"

export const maxDuration = 120
export const runtime = "nodejs"

type ChatBody = {
  messages?: SimpleChatMessage[]
  message?: string
  system?: string
  model?: string
  conversationId?: string
  stream?: boolean
}

const DEFAULT_SYSTEM = `You are the in-app assistant for Ironwood Planner. You help users plan and execute work in plain language.

Note: you do not automatically receive the user's live workspace/CRM data. Instead, rely on:
- the conversation messages you receive
- any attached or extracted document text included in the conversation

CRITICAL — files in the thread:
- Earlier user messages may include blocks starting with "Attached file:" followed by extracted text (from PDF, HTML, Word, etc.). That text IS the file content for this conversation.
- When the user says "this file", "the document", "review it", or "break it into tasks" without attaching again, use the most recent such "Attached file:" content in the thread. Do NOT claim you cannot see files if that text is present.
- HTML uploads are converted to extracted text; you do not need the user to paste raw HTML.

When you create tasks or projects, the app will execute those actions for the user after explicit confirmation. 

IMPORTANT - Command Detection:
When the user requests an action (e.g., "create a task", "add a project", "create a deal", "add a contact"), you MUST:
1. Recognize the command intent
2. Summarize what you'll do in format: "[ACTION] I'll {action}. Should I proceed?"
3. Wait for user confirmation (yes/ok/proceed/go ahead, etc.) before executing
4. Execute the action via the command system only after explicit confirmation

Examples:
- User: "Create a task called 'Review deal docs'" → Reply: "[ACTION] I'll create a task named 'Review deal docs'. Should I proceed?"
- User: "Add John to contacts" → Reply: "[ACTION] I'll add John to your contacts. Should I proceed?"
- User: "Make a new project for Acme" → Reply: "[ACTION] I'll create a new project for Acme. Should I proceed?"

Be concise, accurate, and practical. Always ask before executing commands.`

function normalizeMessages(body: ChatBody): SimpleChatMessage[] | null {
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

export async function POST(req: Request) {
  const apiKey = getGoogleApiKeyFromRequest(req)
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Gemini is not configured. Set GOOGLE_API_KEY in the server environment, or use Settings → AI assistant to set a session key (dev).",
      },
      { status: 503 }
    )
  }

  let body: ChatBody
  try {
    body = (await req.json()) as ChatBody
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

  const model = resolveGeminiModel(body.model)
  const systemInstruction = body.system?.trim() || DEFAULT_SYSTEM
  const stream = body.stream === true

  if (stream) {
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamGeminiChat({
            apiKey,
            model,
            systemInstruction,
            messages,
            signal: req.signal,
          })) {
            controller.enqueue(encoder.encode(chunk))
          }
        } catch (e) {
          // Fallback: retry with non-streaming generation.
          // This avoids environments where SSE streaming fetches can fail.
          const msg = e instanceof Error ? e.message : "Stream failed"
          try {
            const text = await generateGeminiChatOnce({
              apiKey,
              model,
              systemInstruction,
              messages,
              signal: req.signal,
            })
            controller.enqueue(encoder.encode(text || `\n[Error] ${msg}`))
          } catch {
            controller.enqueue(encoder.encode(`\n[Error] ${msg}`))
          }
        } finally {
          controller.close()
        }
      },
    })

    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    })
    if (body.conversationId) {
      headers.set("X-Conversation-Id", body.conversationId)
    }
    return new Response(readable, { headers })
  }

  try {
    const text = await generateGeminiChatOnce({
      apiKey,
      model,
      systemInstruction,
      messages,
      signal: req.signal,
    })
    return NextResponse.json({
      text,
      conversationId: body.conversationId ?? null,
      response: text,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 502 }
    )
  }
}
