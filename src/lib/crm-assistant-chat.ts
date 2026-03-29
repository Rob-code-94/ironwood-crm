"use client"

import { useMemo, useRef } from "react"
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
import {
  enrichUserTextWithSlashAtMetadata,
  stripSlashAtMetadata,
} from "@/lib/assistant/commands"
import type { CommandProjectCatalogEntry } from "@/lib/project-catalog"

export type CreatedCommandTask = {
  id: string
  title: string
  dueDate?: string
  description?: string
  section?: string
  links?: { label: string; href: string }[]
  /** Set when execute-command received a project catalog */
  projectId?: string
  projectLabel?: string
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
    let extractedText: string
    try {
      const fd = new FormData()
      fd.set("file", attachment.file)
      const isHtml = /\.html?$/i.test(attachment.name)
      fd.set(
        "instructions",
        isHtml
          ? "Extract structured checklists, phases, headings, links, phone numbers, and action items from this HTML (including text inside scripts). Preserve group names for sections."
          : "Summarize key points, list action items with any dates mentioned."
      )
      fd.set("model", getStoredCrmAiModel())
      const res = await fetch("/api/process-file", { method: "POST", body: fd })
      if (res.ok) {
        const data = (await res.json()) as { extracted?: string; error?: string }
        extractedText =
          typeof data.extracted === "string"
            ? data.extracted
            : `[Could not extract content from ${attachment.name}]`
      } else {
        // Fall back to raw text read
        try {
          extractedText = await attachment.file.text()
          if (extractedText.length > 8_000) extractedText = `${extractedText.slice(0, 8_000)}\n[truncated]`
        } catch {
          extractedText = `[Could not read file: ${attachment.name}]`
        }
      }
    } catch {
      try {
        extractedText = await attachment.file.text()
        if (extractedText.length > 8_000) extractedText = `${extractedText.slice(0, 8_000)}\n[truncated]`
      } catch {
        extractedText = `[Could not read file: ${attachment.name}]`
      }
    }

    const text = `Attached file: **${attachment.name}**\n\n${extractedText || "(empty or binary)"}`

    // Best-effort index into Gemini File Search so the assistant can later
    // answer "search inside my uploaded docs" queries.
    try {
      const existingStoreName =
        typeof window !== "undefined" ? window.localStorage.getItem(FILE_SEARCH_STORE_KEY) : null

      const fd = new FormData()
      fd.set("file", attachment.file)
      fd.set("displayName", attachment.name)
      if (existingStoreName) fd.set("storeName", existingStoreName)

      if (existingStoreName) {
        fetch("/api/file-search/index", { method: "POST", body: fd }).catch(() => {
          /* ignore indexing failures */
        })
      } else {
        const r = await fetch("/api/file-search/index", { method: "POST", body: fd }).catch(() => null)
        if (r?.ok) {
          const data = (await r.json()) as { storeName?: string }
          if (data?.storeName && typeof window !== "undefined") {
            window.localStorage.setItem(FILE_SEARCH_STORE_KEY, data.storeName)
          }
        }
      }
    } catch {
      /* ignore */
    }

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
      // assistant-ui keeps processed file text on `message.attachments[].content`, not in `message.content`
      if (m.role === "user" && m.attachments?.length) {
        for (const att of m.attachments) {
          for (const c of att.content) {
            if (c.type === "text" && c.text.trim()) chunks.push(c.text)
          }
        }
      }
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
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i]!.role === "user") {
      const enriched = enrichUserTextWithSlashAtMetadata(out[i]!.content)
      if (enriched !== out[i]!.content) {
        out[i] = { ...out[i]!, content: enriched }
      }
      break
    }
  }
  return out
}

function augmentChatSystem(
  base: string | undefined,
  lastUserText: string,
  workspaceContext?: string
): string | undefined {
  const parts: string[] = []
  if (base?.trim()) parts.push(base.trim())
  if (workspaceContext?.trim()) {
    parts.push(`Workspace context:\n${workspaceContext.trim()}`)
  }
  if (/\[Command:\s*plan\]/i.test(lastUserText)) {
    parts.push(
      "Planning mode: read the request fully, output a numbered plan of tasks you would create, and ask for confirmation before suggesting workspace changes."
    )
  }
  const mention = lastUserText.match(/\[Mention:\s*([^\]]+)\]/i)
  if (mention) {
    parts.push(
      `The user is focusing on this name in the message ("${mention[1]!.trim()}") — prefer that context for answers and for task or project placement when relevant.`
    )
  }
  if (parts.length === 0) return base
  return parts.join("\n\n")
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

type ExecuteCommandClientPayload = {
  success?: boolean
  message?: string
  tasks?: CreatedCommandTask[]
  projects?: CreatedCommandProject[]
  error?: string
  modelOutputPreview?: string
}

function formatCommandReply(data: {
  success: boolean
  message: string
  tasks: CreatedCommandTask[]
  projects: CreatedCommandProject[]
  modelOutputPreview?: string
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
      const sec = t.section ? ` [${t.section}]` : ""
      const place =
        typeof t.projectLabel === "string" && t.projectLabel.trim()
          ? ` → ${t.projectLabel.trim()}`
          : ""
      lines.push(`${i + 1}. ${t.title}${sec}${place}${t.dueDate ? ` — due ${t.dueDate}` : ""}`)
    })
  }
  if (data.success && (data.tasks.length || data.projects.length)) {
    const parts: string[] = []
    if (data.projects.length) parts.push("project(s)")
    if (data.tasks.length) parts.push("task(s)")
    lines.push("", `✅ Added ${parts.join(" and ")} to your workspace.`)
  } else if (!data.success) {
    const preview = data.modelOutputPreview?.trim()
    if (preview) {
      lines.push(
        "",
        "---",
        "What the model returned (trimmed for display):",
        "```",
        preview.slice(0, 4000),
        "```"
      )
    } else {
      lines.push("", "Could not fully execute the command; adjust your wording and try again.")
    }
  }
  return lines.join("\n")
}

const TASK_INTENT_RE = /\b(tasks?|action items?|create|add|extract|to-?do|review|breakdown|list|organize|analyze)\b/i

const FILE_PROTOCOL_RE = /\bfile:\/\//i

/** User wants tasks/projects built from an attached file or fetched page */
function wantsWorkFromSource(userText: string): boolean {
  if (TASK_INTENT_RE.test(userText)) return true
  if (/\b(project|projects|program|initiative|playbook|roadmap)\b/i.test(userText)) return true
  if (/\bturn\s+(this|that|it)\s+into\b/i.test(userText)) return true
  if (/\b(build|generate|populate|ingest)\b/i.test(userText)) return true
  return false
}

function firstHttpUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')]+/i)
  return m ? m[0] : null
}

function resolveCommandTypeHint(userText: string): string | undefined {
  const projectish = /\b(project|projects|program|initiative|playbook|workspace)\b/i.test(
    userText
  )
  const taskish = /\b(tasks?|action items?|to-?dos?|checklist|steps?)\b/i.test(userText)
  if (projectish && !taskish) return "create-project"
  if (taskish && !projectish) return "create-tasks"
  return undefined
}

const MAX_INGEST_COMMAND_CHARS = 100_000

function truncateForCommand(s: string): string {
  if (s.length <= MAX_INGEST_COMMAND_CHARS) return s
  const half = Math.floor(MAX_INGEST_COMMAND_CHARS / 2) - 80
  return `${s.slice(0, half)}\n\n[... middle truncated ...]\n\n${s.slice(-half)}`
}

function proposalConfirmLines(
  message: string | undefined,
  tasks: CreatedCommandTask[],
  projects: CreatedCommandProject[]
): string {
  const taskLines =
    tasks.length > 0
      ? tasks.map((t, i) => {
          const place =
            typeof t.projectLabel === "string" && t.projectLabel.trim()
              ? ` → **${t.projectLabel.trim()}**`
              : ""
          return `${i + 1}. ${t.title}${place}`
        })
      : []

  return [
    typeof message === "string" && message.trim() ? message.trim() : "I’m ready to make changes.",
    "",
    "**Proposed changes** (review project placement before confirming):",
    tasks.length
      ? taskLines.join("\n")
      : `- No tasks to add.`,
    projects.length ? `- Add ${projects.length} project(s).` : ``,
    "",
    `Reply **yes** to confirm, or **no** to cancel.`,
  ]
    .filter((line) => line !== "")
    .join("\n")
}

const CONFIRM_RE = /^(yes|yep|ok|okay|proceed|go ahead|continue)\b/i
const CANCEL_RE = /^(no|nope|cancel|stop|never mind)\b/i
const RESEARCH_INTENT_RE =
  /\b(find|lookup|research|search)\b.*\b(phone|number|contact|company|website|email|address)\b|\b(phone|number|contact|company|website|email|address)\b.*\b(find|lookup|research|search)\b/i

const FILE_SEARCH_STORE_KEY = "ironwood.fileSearch.storeName.v1"
const DOC_SEARCH_INTENT_RE =
  /\b(find|lookup|search)\b.*\b(document|file|attachment|uploaded|attached)\b|\b(phone|number|contact|company|website|email|address)\b.*\b(in|from)\b.*\b(document|file|attachment|uploaded|attached)\b|\b(in|from)\b.*\b(document|file|attachment|uploaded|attached)\b/i

function hasDocumentAttachments(messages: readonly ThreadMessage[]): boolean {
  // Scan the last 6 messages (3 turns) so multi-turn "upload then ask" works
  const recent = messages.slice(-6)
  for (const m of recent) {
    if (m.role !== "user") continue
    for (const c of m.content) {
      if (c.type === "text" && (c as { text: string }).text.startsWith("Attached file:")) return true
    }
    if (m.attachments?.length) {
      for (const att of m.attachments) {
        for (const c of att.content) {
          if (c.type === "text" && (c as { text: string }).text.startsWith("Attached file:")) return true
        }
      }
    }
  }
  return false
}

export function useCrmChatModelAdapter(
  commandModeRef: React.MutableRefObject<boolean>,
  onApplyPendingWorkspaceRef: React.MutableRefObject<
    | ((batch: { tasks: CreatedCommandTask[]; projects: CreatedCommandProject[] }) => void)
    | undefined
  >,
  workspaceContext?: string,
  projectsCatalog: CommandProjectCatalogEntry[] = []
): ChatModelAdapter {
  const pendingActionsRef = useRef<{
    tasks: CreatedCommandTask[]
    projects: CreatedCommandProject[]
    message?: string
  } | null>(null)

  return useMemo(
    () => ({
      async *run(options) {
        // Confirmation gate:
        // - When the assistant detects an actionable intent, it stores pending tasks/projects.
        // - It only persists them after the user replies with "yes/ok/proceed".
        const lastUserTextValue = lastUserText(options.messages)
        const hasPendingActions = pendingActionsRef.current !== null

        if (!hasPendingActions && FILE_PROTOCOL_RE.test(lastUserTextValue)) {
          yield {
            content: [
              {
                type: "text",
                text: 'Local `file://` links cannot be opened from the browser. Use the **Attach file** button in the composer and upload the file, then ask again (for example: “Create a project and tasks from this”).',
              },
            ],
          }
          return
        }

        if (hasPendingActions) {
          if (CONFIRM_RE.test(lastUserTextValue)) {
            const pending = pendingActionsRef.current
            pendingActionsRef.current = null

            if (!pending) return

            if (
              (pending.tasks.length || pending.projects.length) &&
              onApplyPendingWorkspaceRef.current
            ) {
              onApplyPendingWorkspaceRef.current({
                tasks: pending.tasks,
                projects: pending.projects,
              })
            }

            yield {
              content: [
                {
                  type: "text",
                  text: formatCommandReply({
                    success: true,
                    message: pending.message ?? "Added to your workspace.",
                    tasks: pending.tasks,
                    projects: pending.projects,
                  }),
                },
              ],
            }
            return
          }

          if (CANCEL_RE.test(lastUserTextValue)) {
            pendingActionsRef.current = null
            yield {
              content: [
                {
                  type: "text",
                  text: "Cancelled. No changes were made.",
                },
              ],
            }
            return
          }
        }

        // Search inside uploaded docs (Gemini File Search).
        // Only triggers in the CRM assistant and only for doc-lookup style requests.
        if (
          !hasPendingActions &&
          !commandModeRef.current &&
          hasDocumentAttachments(options.messages) &&
          DOC_SEARCH_INTENT_RE.test(lastUserTextValue) &&
          !TASK_INTENT_RE.test(stripSlashAtMetadata(lastUserTextValue))
        ) {
          const storeName =
            typeof window !== "undefined" ? window.localStorage.getItem(FILE_SEARCH_STORE_KEY) ?? "" : ""

          if (storeName.startsWith("fileSearchStores/")) {
            const activeAgent = getActiveAgent()
            const resolvedModel = activeAgent ? activeAgent.model : getStoredCrmAiModel()
            const resolvedSystem = activeAgent
              ? activeAgent.systemPrompt.trim() || undefined
              : getStoredCrmSystemPrompt().trim() || undefined

            const systemForRequest = augmentChatSystem(
              resolvedSystem,
              lastUserTextValue,
              workspaceContext
            )

            const res = await fetch("/api/file-search/query", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                storeName,
                query: stripSlashAtMetadata(lastUserTextValue),
                model: resolvedModel,
                system: systemForRequest,
              }),
              signal: options.abortSignal,
            })

            if (res.ok) {
              const data = (await res.json()) as { text?: string }
              yield {
                content: [
                  {
                    type: "text",
                    text: typeof data.text === "string" ? data.text : "Done.",
                  },
                ],
              }
              return
            }
          }
          // If File Search isn't ready yet, fall back to normal chat.
        }

        if (!hasPendingActions && commandModeRef.current) {
          const text = lastUserText(options.messages)
          if (!text.trim()) {
            yield { content: [{ type: "text", text: "No user message to run as a command." }] }
            return
          }
          const activeAgentForCmd = getActiveAgent()
          const cmdModel = activeAgentForCmd ? activeAgentForCmd.model : getStoredCrmAiModel()
          const strippedCmd = stripSlashAtMetadata(text)
          const cmdHint = resolveCommandTypeHint(strippedCmd)
          const res = await fetch("/api/execute-command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              command: strippedCmd,
              ...(cmdHint ? { commandType: cmdHint } : {}),
              model: cmdModel,
              ...(projectsCatalog.length > 0 ? { projectsCatalog } : {}),
            }),
            signal: options.abortSignal,
          })
          const data = (await res.json()) as ExecuteCommandClientPayload
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

          if (data.success && (tasks.length || projects.length)) {
            pendingActionsRef.current = {
              tasks,
              projects,
              message: typeof data.message === "string" ? data.message : undefined,
            }
            yield {
              content: [
                {
                  type: "text",
                  text: proposalConfirmLines(
                    typeof data.message === "string" ? data.message : undefined,
                    tasks,
                    projects
                  ),
                },
              ],
            }
            return
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
                  modelOutputPreview:
                    typeof data.modelOutputPreview === "string"
                      ? data.modelOutputPreview
                      : undefined,
                }),
              },
            ],
          }
          return
        }

        // Auto-route: attached document + intent to build tasks/projects → execute-command
        const userText = lastUserText(options.messages)
        const userTextStripped = stripSlashAtMetadata(userText)
        if (
          !hasPendingActions &&
          hasDocumentAttachments(options.messages) &&
          wantsWorkFromSource(userTextStripped)
        ) {
          const fullCommand = truncateForCommand(
            threadMessagesToApi(options.messages)
              .map((m) => m.content)
              .join("\n")
          )
          const activeAgentForDoc = getActiveAgent()
          const docModel = activeAgentForDoc ? activeAgentForDoc.model : getStoredCrmAiModel()
          const strippedDoc = stripSlashAtMetadata(fullCommand)
          const docHint = resolveCommandTypeHint(userTextStripped)
          const docRes = await fetch("/api/execute-command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              command: strippedDoc,
              ...(docHint ? { commandType: docHint } : {}),
              model: docModel,
              ...(projectsCatalog.length > 0 ? { projectsCatalog } : {}),
            }),
            signal: options.abortSignal,
          })
          const docData = (await docRes.json()) as ExecuteCommandClientPayload
          const docTasks = Array.isArray(docData.tasks) ? docData.tasks : []
          const docProjects = Array.isArray(docData.projects) ? docData.projects : []

          if (docData.success && (docTasks.length || docProjects.length)) {
            pendingActionsRef.current = {
              tasks: docTasks,
              projects: docProjects,
              message: typeof docData.message === "string" ? docData.message : undefined,
            }
            yield {
              content: [
                {
                  type: "text",
                  text: proposalConfirmLines(
                    typeof docData.message === "string" ? docData.message : undefined,
                    docTasks,
                    docProjects
                  ),
                },
              ],
            }
            return
          }

          yield {
            content: [
              {
                type: "text",
                text: formatCommandReply({
                  success: Boolean(docData.success),
                  message: typeof docData.message === "string" ? docData.message : "Done.",
                  tasks: docTasks,
                  projects: docProjects,
                  modelOutputPreview:
                    typeof docData.modelOutputPreview === "string"
                      ? docData.modelOutputPreview
                      : undefined,
                }),
              },
            ],
          }
          return
        }

        // URL in message (no attachment): fetch page → same parser as document ingest
        if (
          !hasPendingActions &&
          !commandModeRef.current &&
          !hasDocumentAttachments(options.messages) &&
          wantsWorkFromSource(userTextStripped)
        ) {
          const pageUrl = firstHttpUrl(userTextStripped)
          if (pageUrl) {
            const ingestRes = await fetch("/api/fetch-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: pageUrl }),
              signal: options.abortSignal,
            })
            const ingestJson = (await ingestRes.json().catch(() => ({}))) as {
              markdown?: string
              error?: string
            }
            if (!ingestRes.ok) {
              yield {
                content: [
                  {
                    type: "text",
                    text:
                      typeof ingestJson.error === "string"
                        ? ingestJson.error
                        : "Could not fetch that URL.",
                  },
                ],
              }
              return
            }
            const md =
              typeof ingestJson.markdown === "string" && ingestJson.markdown.trim()
                ? ingestJson.markdown.trim()
                : "(empty)"
            const urlCommand = truncateForCommand(
              `User request:\n${userText}\n\nFetched page (${pageUrl}):\n${md}`
            )
            const activeAgentForUrl = getActiveAgent()
            const urlModel = activeAgentForUrl ? activeAgentForUrl.model : getStoredCrmAiModel()
            const urlHint = resolveCommandTypeHint(userTextStripped)
            const urlExecRes = await fetch("/api/execute-command", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                command: stripSlashAtMetadata(urlCommand),
                ...(urlHint ? { commandType: urlHint } : {}),
                model: urlModel,
                ...(projectsCatalog.length > 0 ? { projectsCatalog } : {}),
              }),
              signal: options.abortSignal,
            })
            const urlData = (await urlExecRes.json()) as ExecuteCommandClientPayload
            if (!urlExecRes.ok) {
              yield {
                content: [
                  {
                    type: "text",
                    text:
                      typeof urlData.error === "string"
                        ? urlData.error
                        : "Command request failed.",
                  },
                ],
              }
              return
            }
            const urlTasks = Array.isArray(urlData.tasks) ? urlData.tasks : []
            const urlProjects = Array.isArray(urlData.projects) ? urlData.projects : []

            if (urlData.success && (urlTasks.length || urlProjects.length)) {
              pendingActionsRef.current = {
                tasks: urlTasks,
                projects: urlProjects,
                message: typeof urlData.message === "string" ? urlData.message : undefined,
              }
              yield {
                content: [
                  {
                    type: "text",
                    text: proposalConfirmLines(
                      typeof urlData.message === "string" ? urlData.message : undefined,
                      urlTasks,
                      urlProjects
                    ),
                  },
                ],
              }
              return
            }

            yield {
              content: [
                {
                  type: "text",
                  text: formatCommandReply({
                    success: Boolean(urlData.success),
                    message: typeof urlData.message === "string" ? urlData.message : "Done.",
                    tasks: urlTasks,
                    projects: urlProjects,
                    modelOutputPreview:
                      typeof urlData.modelOutputPreview === "string"
                        ? urlData.modelOutputPreview
                        : undefined,
                  }),
                },
              ],
            }
            return
          }
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

        const systemForRequest = augmentChatSystem(
          resolvedSystem,
          lastUserTextValue,
          workspaceContext
        )

        const strippedForIntent = stripSlashAtMetadata(lastUserTextValue)
        const shouldResearch =
          RESEARCH_INTENT_RE.test(strippedForIntent) && !TASK_INTENT_RE.test(strippedForIntent)
        const res = await fetch(shouldResearch ? "/api/research-chat" : "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            model: resolvedModel,
            system: systemForRequest,
            stream: !shouldResearch,
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

        if (shouldResearch) {
          const data = (await res.json()) as { text?: string; error?: string }
          yield { content: [{ type: "text", text: typeof data.text === "string" ? data.text : "Done." }] }
          return
        }

        const contentType = res.headers.get("content-type") ?? ""
        if (contentType.includes("text/plain") && res.body) {
          const hasFileExtract = messages.some(
            (m) => m.role === "user" && m.content.includes("Attached file:")
          )
          const traceLine = `Model: ${resolvedModel} · ${messages.length} message(s) · streaming · prior turns ${hasFileExtract ? "include attached file text" : "text only"}`
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let acc = ""
          try {
            yield {
              content: [
                { type: "reasoning" as const, text: traceLine },
                { type: "text" as const, text: "" },
              ],
            }
            for (;;) {
              const { done, value } = await reader.read()
              if (options.abortSignal.aborted) {
                await reader.cancel().catch(() => {})
                return
              }
              if (done) break
              if (value?.length) {
                acc += decoder.decode(value, { stream: true })
                yield {
                  content: [
                    { type: "reasoning" as const, text: traceLine },
                    { type: "text" as const, text: acc },
                  ],
                }
              }
            }
            const tail = decoder.decode()
            if (tail) {
              acc += tail
              yield {
                content: [
                  { type: "reasoning" as const, text: traceLine },
                  { type: "text" as const, text: acc },
                ],
              }
            }
            if (!acc.trim()) {
              yield {
                content: [
                  { type: "reasoning" as const, text: traceLine },
                  { type: "text" as const, text: "(Empty response from model.)" },
                ],
              }
            }
          } catch {
            yield {
              content: [
                {
                  type: "text",
                  text: "Streaming was interrupted. Try sending again or pick another model.",
                },
              ],
            }
          }
          return
        }

        const data = (await res.json().catch(() => ({}))) as { text?: string }
        yield {
          content: [
            {
              type: "text",
              text: typeof data.text === "string" ? data.text : "Done.",
            },
          ],
        }
        return
      },
    }),
    [commandModeRef, onApplyPendingWorkspaceRef, workspaceContext, projectsCatalog]
  )
}
