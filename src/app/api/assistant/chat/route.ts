import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { convertToModelMessages, stepCountIs, streamText, type ToolSet } from "ai"
import { getGoogleApiKeyFromRequest } from "@/lib/ai-request"
import { createAssistantTools } from "@/lib/assistant/chat-tools"
import { getCommandContext, parseCommandsAndMentions } from "@/lib/assistant/commands"
import { THINKING_MODELS, VALID_MODEL_IDS } from "@/lib/assistant/constants"

export const maxDuration = 60
export const runtime = "nodejs"

const DEFAULT_MODEL = "gemini-2.5-flash"

export async function POST(req: Request) {
  const apiKey = getGoogleApiKeyFromRequest(req)
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "Missing API key. Set GOOGLE_API_KEY (or GEMINI_API_KEY) in .env.local and restart the dev server, or save a session key in Settings → AI assistant.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const messages = body.messages
  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Expected messages array" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const lastMsg = messages[messages.length - 1] as Record<string, unknown> | undefined
  if (lastMsg && typeof lastMsg.content === "string") {
    const match = parseCommandsAndMentions(lastMsg.content)
    if (match) {
      const context = getCommandContext(match)
      if (context.mentionedClient) {
        lastMsg.content = `[Mention: ${context.mentionedClient}] ${lastMsg.content}`
      }
      if (context.commandType) {
        lastMsg.content = `[Command: ${context.commandType}] ${lastMsg.content}`
      }
    }
  }

  const config = body.config as { modelName?: string } | undefined
  const requestedModel = typeof config?.modelName === "string" ? config.modelName.trim() : ""
  const modelId = VALID_MODEL_IDS.has(requestedModel) ? requestedModel : DEFAULT_MODEL
  const supportsThinking = THINKING_MODELS.has(modelId)

  const clientContextId =
    typeof body.clientContextId === "string" && body.clientContextId.trim()
      ? body.clientContextId.trim()
      : null

  const google = createGoogleGenerativeAI({ apiKey })
  const tools: ToolSet = {
    ...createAssistantTools({
      defaultClientId: clientContextId,
    }),
  }

  const lastMsgText = (() => {
    const msg = messages[messages.length - 1] as Record<string, unknown> | undefined
    return typeof msg?.content === "string" ? msg.content : ""
  })()
  const isPlanMode = lastMsgText.startsWith("[Command: plan]")
  const planningInstructions = isPlanMode
    ? `\n\nPLANNING MODE ACTIVE:
1. Read request fully.
2. Output a numbered plan of tasks you would create.
3. Ask for confirmation before creating tasks.`
    : ""

  const result = streamText({
    model: google(modelId),
    system: `You are IW Capital Assistant, adapted for Ironwood Planner's ICRM workflow.
Use tools when you need workspace context and task payloads.
Be concise and practical.
When user asks to create work, prefer producing clear action plans and ask confirmation before execution.${planningInstructions}`,
    messages: await convertToModelMessages(messages as never),
    tools,
    stopWhen: stepCountIs(10),
    ...(supportsThinking
      ? {
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: 8000,
                includeThoughts: true,
              },
            },
          },
        }
      : {}),
  })

  return result.toUIMessageStreamResponse()
}
