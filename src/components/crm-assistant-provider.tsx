"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  useLocalRuntime,
} from "@assistant-ui/react"
import type { ExportedMessageRepository } from "@assistant-ui/core"
import {
  CRM_ASSISTANT_THREAD_STORAGE_KEY,
  clearCrmAssistantThreadStorage,
  getSavedThreads,
  addSavedThread,
  deleteSavedThread,
  updateSavedThread,
  type SavedThread,
} from "@/lib/crm-assistant-storage"
import {
  FallbackDocumentAttachmentAdapter,
  useCrmChatModelAdapter,
  type CreatedCommandProject,
  type CreatedCommandTask,
} from "@/lib/crm-assistant-chat"
import { useWorkspace, ALL_PROJECTS_FILTER } from "@/lib/workspace/context"

function isHexColor(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s.trim())
}

/** Extract a display title from an exported thread's messages */
function threadTitle(exported: ExportedMessageRepository): string {
  const messages = ((exported as unknown) as { messages?: { role: string; content?: { type: string; text?: string }[] }[] }).messages ?? []
  for (const m of messages) {
    if (m.role === "user" && Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === "text" && typeof c.text === "string" && c.text.trim()) {
          const snippet = c.text.trim().slice(0, 55)
          return snippet.length < c.text.trim().length ? `${snippet}…` : snippet
        }
      }
    }
  }
  return `Chat on ${new Date().toLocaleDateString()}`
}

type CrmAssistantUiValue = {
  commandMode: boolean
  setCommandMode: (v: boolean) => void
  resetThread: () => void
  saveAndNewThread: () => void
  startNewThread: () => void
  loadThread: (id: string) => void
  renameThread: (id: string, title: string) => void
  archiveThread: (id: string) => void
  deleteThread: (id: string) => void
  activeThreadId: string | null
  savedThreads: SavedThread[]
}

const CrmAssistantUiContext = createContext<CrmAssistantUiValue | null>(null)

export function useCrmAssistantUi() {
  const ctx = useContext(CrmAssistantUiContext)
  if (!ctx) {
    throw new Error("useCrmAssistantUi must be used within CrmAssistantProvider")
  }
  return ctx
}

function CrmAssistantRuntime({
  children,
}: {
  children: ReactNode
}) {
  const { addTask, addProject, selectedProjectFilterId, projects } = useWorkspace()
  const onApplyPendingWorkspaceRef = useRef<
    | ((batch: { tasks: CreatedCommandTask[]; projects: CreatedCommandProject[] }) => void)
    | undefined
  >(undefined)

  useEffect(() => {
    onApplyPendingWorkspaceRef.current = (batch) => {
      const { tasks, projects: projectsToAdd } = batch

      const validExistingIds = new Set(projects.map((p) => p.id))

      let firstNewProjectId: string | undefined
      for (const p of projectsToAdd) {
        const color = p.color && isHexColor(p.color) ? p.color.trim() : "#6366f1"
        const created = addProject({
          name: p.name,
          description: p.description,
          color,
          category: p.category,
        })
        if (!firstNewProjectId) firstNewProjectId = created.id
      }

      const onlyNewProjectBundle =
        projectsToAdd.length === 1 &&
        tasks.length > 0 &&
        tasks.every((t) => !t.projectId)

      for (const t of tasks) {
        let projectId =
          t.projectId && validExistingIds.has(t.projectId) ? t.projectId : undefined

        if (projectId === undefined && onlyNewProjectBundle && firstNewProjectId) {
          projectId = firstNewProjectId
        }

        addTask({
          title: t.title,
          description: t.description,
          priority: "medium",
          dueDate: t.dueDate,
          projectId,
          section: t.section,
          links: t.links?.length ? t.links : undefined,
        })
      }
    }
  }, [addTask, addProject, projects])

  const projectsCatalog = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        ...(p.description?.trim() ? { description: p.description.trim() } : {}),
      })),
    [projects]
  )

  const workspaceContext = useMemo(() => {
    const filterId = selectedProjectFilterId
    const filterLine =
      !filterId
        ? "Current project filter: unknown."
        : filterId === ALL_PROJECTS_FILTER
          ? "Current project filter: all projects."
          : (() => {
              const projectName = projects.find((p) => p.id === filterId)?.name
              return projectName
                ? `Current project filter (sidebar): ${projectName}.`
                : `Current project filter id: ${filterId}.`
            })()

    if (projects.length === 0) {
      return `${filterLine}\n\nThere are no projects yet. New tasks will be general (unassigned to a project) unless you create a project first.`
    }

    const lines = projects.map(
      (p) =>
        `- **${p.name}** (id: \`${p.id}\`)${p.description?.trim() ? ` — ${p.description.trim().slice(0, 120)}${p.description.trim().length > 120 ? "…" : ""}` : ""}`
    )

    return `${filterLine}

**Projects in this workspace** (the command parser matches tasks to these by id; if unsure it uses **General**):
${lines.join("\n")}

The user must confirm before any task or project is saved. Prefer **General** when placement is ambiguous.`
  }, [projects, selectedProjectFilterId])

  const [commandMode, setCommandMode] = useState(false)
  const commandModeRef = useRef(commandMode)
  useEffect(() => {
    commandModeRef.current = commandMode
  }, [commandMode])

  const adapter = useCrmChatModelAdapter(
    commandModeRef,
    onApplyPendingWorkspaceRef,
    workspaceContext,
    projectsCatalog
  )

  const attachments = useMemo(
    () =>
      new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
        new FallbackDocumentAttachmentAdapter(),
      ]),
    []
  )

  const runtime = useLocalRuntime(adapter, {
    adapters: { attachments },
  })

  const loadedRef = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const thread = runtime.thread

    if (!loadedRef.current) {
      loadedRef.current = true
      const raw = localStorage.getItem(CRM_ASSISTANT_THREAD_STORAGE_KEY)
      if (raw) {
        try {
          const data = JSON.parse(raw) as ExportedMessageRepository
          if (data && Array.isArray(data.messages)) {
            thread.import(data)
          }
        } catch {
          /* ignore corrupt storage */
        }
      }
    }

    let debounce: ReturnType<typeof setTimeout>
    const unsub = thread.subscribe(() => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        try {
          localStorage.setItem(
            CRM_ASSISTANT_THREAD_STORAGE_KEY,
            JSON.stringify(thread.export())
          )
        } catch {
          /* quota / private mode */
        }
      }, 400)
    })

    return () => {
      clearTimeout(debounce)
      unsub()
    }
  }, [runtime])

  const [savedThreads, setSavedThreads] = useState<SavedThread[]>(() =>
    getSavedThreads()
  )
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const resetThread = useCallback(() => {
    clearCrmAssistantThreadStorage()
    runtime.thread.reset()
    setActiveThreadId(null)
  }, [runtime])

  const saveAndNewThread = useCallback(() => {
    const exported = runtime.thread.export()
    const messages = (exported as { messages?: unknown[] }).messages ?? []
    if (messages.length > 0) {
      const saved: SavedThread = {
        id: crypto.randomUUID(),
        title: threadTitle(exported),
        savedAt: new Date().toISOString(),
        status: "active",
        data: exported,
      }
      addSavedThread(saved)
      setSavedThreads(getSavedThreads())
    }
    clearCrmAssistantThreadStorage()
    runtime.thread.reset()
    setActiveThreadId(null)
  }, [runtime])

  const loadThread = useCallback(
    (id: string) => {
      const threads = getSavedThreads()
      const found = threads.find((t) => t.id === id)
      if (!found) return
      clearCrmAssistantThreadStorage()
      runtime.thread.reset()
      // Small delay so reset propagates before we import
      setTimeout(() => {
        try {
          runtime.thread.import(found.data as ExportedMessageRepository)
          // Persist so the loaded thread auto-saves going forward
          localStorage.setItem(
            CRM_ASSISTANT_THREAD_STORAGE_KEY,
            JSON.stringify(found.data)
          )
        } catch {
          /* ignore */
        }
      }, 50)
      setActiveThreadId(found.id)
    },
    [runtime]
  )

  const renameThread = useCallback((id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    updateSavedThread(id, { title: trimmed })
    setSavedThreads(getSavedThreads())
  }, [])

  const archiveThread = useCallback((id: string) => {
    updateSavedThread(id, { status: "archived" })
    setSavedThreads(getSavedThreads())
    setActiveThreadId((prev) => (prev === id ? null : prev))
  }, [])

  const deleteThread = useCallback((id: string) => {
    deleteSavedThread(id)
    setSavedThreads(getSavedThreads())
    setActiveThreadId((prev) => (prev === id ? null : prev))
  }, [])

  const uiValue = useMemo<CrmAssistantUiValue>(
    () => ({
      commandMode,
      setCommandMode,
      resetThread,
      saveAndNewThread,
      startNewThread: saveAndNewThread,
      loadThread,
      renameThread,
      archiveThread,
      deleteThread,
      activeThreadId,
      savedThreads,
    }),
    [
      commandMode,
      resetThread,
      saveAndNewThread,
      loadThread,
      renameThread,
      archiveThread,
      deleteThread,
      activeThreadId,
      savedThreads,
    ]
  )

  return (
    <CrmAssistantUiContext.Provider value={uiValue}>
      <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
    </CrmAssistantUiContext.Provider>
  )
}

export function CrmAssistantProvider({ children }: { children: ReactNode }) {
  return <CrmAssistantRuntime>{children}</CrmAssistantRuntime>
}
