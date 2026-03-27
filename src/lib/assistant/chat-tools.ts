import { tool, zodSchema } from "ai"
import { z } from "zod"

export type AssistantToolContext = {
  defaultClientId: string | null
}

function resolveClientId(ctx: AssistantToolContext, explicit?: string): string | null {
  if (explicit && explicit.trim()) return explicit.trim()
  return ctx.defaultClientId
}

/**
 * Tools are intentionally read-only/stubbed on server in this app.
 * The real write path remains client-side workspace actions.
 */
export function createAssistantTools(ctx: AssistantToolContext) {
  const getClientSnapshot = tool({
    description:
      "Return current workspace context id used by the assistant when no explicit clientId is provided.",
    inputSchema: zodSchema(
      z.object({
        clientId: z.string().optional(),
      })
    ),
    execute: async ({ clientId }) => {
      return {
        clientId: resolveClientId(ctx, clientId),
        note: "Workspace context bridged from active project filter.",
      }
    },
  })

  const createClientTask = tool({
    description:
      "Create a task in ICRM context. Returns normalized payload that client-side workspace handler can apply.",
    inputSchema: zodSchema(
      z.object({
        clientId: z.string().optional(),
        title: z.string(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
      })
    ),
    execute: async ({ clientId, title, priority, dueDate, notes }) => {
      return {
        ok: true,
        action: "create_task",
        payload: {
          clientId: resolveClientId(ctx, clientId),
          title,
          priority: priority ?? "medium",
          dueDate: dueDate ?? null,
          notes: notes ?? "",
        },
      }
    },
  })

  return {
    getClientSnapshot,
    createClientTask,
  }
}
