"use client"

import { useMemo } from "react"
import type {
  Attachment,
  AttachmentAdapter,
  ChatModelAdapter,
  PendingAttachment,
  ThreadMessage,
} from "@assistant-ui/react"
import {
  getStoredCrmAiModel,
  getStoredCrmSystemPrompt,
} from "@/lib/crm-ai-settings"
import { getActiveAgent } from "@/lib/agents"

export type CreatedCommandTask = {
  id: string
  title: string
  dueDate?: string
  description?: string
}

export type CreatedCommandProject = {
  id: string
  name: string
  description?: string
  color?: string
  category?: string
}

/** Last adapter in composite: non-image files → text snippet for the model (from @assistant-ui/core patterns). */
export class FallbackDocumentAttachmentAdapter implements AttachmentAdapter {
  accept = "*"

  async add(state: { file: File }): Promise<PendingAttachment> {
    return {
      id: `${state.file.name}-${state.file.size}-${state.file.lastModified}`,
      type: "document",
      name: state.file.name,
      contentType: state.file.type || "application/octet-stream",
      file: state.file,
      status: { type: "requires-action", reason: "composer-send" },
    }
  }

  async send(attachment: PendingAttachment) {
    let body: string
    try {
      body = await attachment.file.text()
      if (body.length > 16_000) {
        body = `${body.slice(0, 16_000)}\n\n[truncated]`
      }
    } catch {
      body = `[Could not read file as text: ${attachment.name}]`
    }
    const text = `Attached file: **${attachment.name}**\n\n${body || "(empty or binary)"}`
    return {
      ...attachment,
      status: { type: "complete" as const },
      content: [{ type: "text" as const, text }],
    }
  }

  async remove(_attachment: Attachment) {}
}

export function threadMessagesToApi(messages: readonly ThreadMessage[]) {
  const out: { role: "user" | "assistant"; content: string }[] = []
  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant") {
      const chunks: string[] = []
      for (const c of m.content) {
        if (c.type === "text") chunks.push(c.text)
        else if (c.type === "image") chunks.push("[Image attachment]")
        else if (c.type === "file") {
          const fn = (c as { filename?: string }).filename
          chunks.push(`[File: ${fn ?? "attachment"}]`)
        }
      }
      const text = chunks.join("\n").trim()
      if (text) out.push({ role: m.role, content: text })
    }
  }
  return out
}

function lastUserText(messages: readonly ThreadMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === "user") {
      const parts = threadMessagesToApi([m])
      return parts[0]?.content ?? ""
    }
  }
  return ""
}

function formatCommandReply(data: {
  success: boolean
  message: string
  tasks: CreatedCommandTask[]
  projects: CreatedCommandProject[]
}): string {
  const lines = [data.message]
  if (data.projects.length) {
    lines.push("", "**Projects:**")
    data.projects.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name}${p.category ? ` (${p.category})` : ""}`)
    })
  }
  if (data.tasks.length) {
    lines.push("", "**Tasks:**")
    data.tasks.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title}${t.dueDate ? ` — due ${t.dueDate}` : ""}`)
    })
  }
  if (data.success && (data.tasks.length || data.projects.length)) {
    const parts: string[] = []
    if (data.projects.length) parts.push("project(s)")
    if (data.tasks.length) parts.push("task(s)")
    lines.push("", `✅ Added ${parts.join(" and ")} to your workspace.`)
  } else if (!data.success) {
    lines.push("", "Could not fully execute the command; adjust your wording and try again.")
  }
  return lines.join("\n")
}

export function useCrmChatModelAdapter(
  commandModeRef: React.MutableRefObject<boolean>,
  onTasksCreatedRef: React.MutableRefObject<((tasks: CreatedCommandTask[]) => void) | undefined>,
  onProjectsCreatedRef: React.MutableRefObject<
    ((projects: CreatedCommandProject[]) => void) | undefined
  >
): ChatModelAdapter {
  return useMemo(
    () => ({
      async *run(options) {
        if (commandModeRef.current) {
          const text = lastUserText(options.messages)
          if (!text.trim()) {
            yield { content: [{ type: "text", text: "No user message to run as a command." }] }
            return
          }
          const activeAgentForCmd = getActiveAgent()
          const cmdModel = activeAgentForCmd ? activeAgentForCmd.model : getStoredCrmAiModel()
          const res = await fetch("/api/execute-command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              command: text,
              model: cmdModel,
            }),
            signal: options.abortSignal,
          })
          const data = (await res.json()) as {
            success?: boolean
            message?: string
            tasks?: CreatedCommandTask[]
            projects?: CreatedCommandProject[]
            error?: string
          }
          if (!res.ok) {
            yield {
              content: [
                {
                  type: "text",
                  text: typeof data.error === "string" ? data.error : "Command request failed.",
                },
              ],
            }
            return
          }
          const tasks = Array.isArray(data.tasks) ? data.tasks : []
          const projects = Array.isArray(data.projects) ? data.projects : []
          if (data.success && tasks.length && onTasksCreatedRef.current) {
            onTasksCreatedRef.current(tasks)
          }
          if (data.success && projects.length && onProjectsCreatedRef.current) {
            onProjectsCreatedRef.current(projects)
          }
          yield {
            content: [
              {
                type: "text",
                text: formatCommandReply({
                  success: Boolean(data.success),
                  message: typeof data.message === "string" ? data.message : "Done.",
                  tasks,
                  projects,
                }),
              },
            ],
          }
          return
        }

        const messages = threadMessagesToApi(options.messages)
        if (messages.length === 0) {
          yield { content: [{ type: "text", text: "Nothing to send." }] }
          return
        }

        const activeAgent = getActiveAgent()
        const resolvedModel = activeAgent ? activeAgent.model : getStoredCrmAiModel()
        const resolvedSystem = activeAgent
          ? activeAgent.systemPrompt.trim() || undefined
          : getStoredCrmSystemPrompt().trim() || undefined

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            model: resolvedModel,
            system: resolvedSystem,
            stream: true,
          }),
          signal: options.abortSignal,
        })

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string }
          yield {
            content: [
              {
                type: "text",
                text:
                  typeof errData.error === "string"
                    ? errData.error
                    : `Request failed (${res.status})`,
              },
            ],
          }
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          yield { content: [{ type: "text", text: "No response body." }] }
          return
        }

        const dec = new TextDecoder()
        let acc = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          acc += dec.decode(value, { stream: true })
          yield { content: [{ type: "text", text: acc }] }
        }
      },
    }),
    [commandModeRef, onTasksCreatedRef, onProjectsCreatedRef]
  )
}
