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
  loadThread: (id: string) => void
  deleteThread: (id: string) => void
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
  // Keep a ref so the task-creation callback always uses the latest project filter
  const selectedProjectRef = useRef<string>(selectedProjectFilterId)
  useEffect(() => {
    selectedProjectRef.current = selectedProjectFilterId
  }, [selectedProjectFilterId])
  const onTasksCreatedRef = useRef<((tasks: CreatedCommandTask[]) => void) | undefined>(
    undefined
  )
  const onProjectsCreatedRef = useRef<
    ((projects: CreatedCommandProject[]) => void) | undefined
  >(undefined)

  useEffect(() => {
    onTasksCreatedRef.current = (tasks) => {
      const projectId =
        selectedProjectRef.current !== ALL_PROJECTS_FILTER
          ? selectedProjectRef.current
          : undefined
      for (const t of tasks) {
        addTask({
          title: t.title,
          description: t.description,
          priority: "medium",
          dueDate: t.dueDate,
          projectId,
        })
      }
    }
  }, [addTask])

  useEffect(() => {
    onProjectsCreatedRef.current = (projects) => {
      for (const p of projects) {
        const color = p.color && isHexColor(p.color) ? p.color.trim() : "#6366f1"
        addProject({
          name: p.name,
          description: p.description,
          color,
          category: p.category,
        })
      }
    }
  }, [addProject])

  const workspaceContext = useMemo(() => {
    const filterId = selectedProjectFilterId
    if (!filterId) return "Current project filter: unknown."

    if (filterId === ALL_PROJECTS_FILTER) {
      return "Current project filter: all projects."
    }

    const projectName = projects.find((p) => p.id === filterId)?.name
    if (!projectName) {
      return `Current project filter id: ${filterId}.`
    }

    return `Current project filter: ${projectName}. When the assistant creates tasks/projects, they will be saved in this project context.`
  }, [projects, selectedProjectFilterId])

  const [commandMode, setCommandMode] = useState(false)
  const commandModeRef = useRef(commandMode)
  useEffect(() => {
    commandModeRef.current = commandMode
  }, [commandMode])

  const adapter = useCrmChatModelAdapter(
    commandModeRef,
    onTasksCreatedRef,
    onProjectsCreatedRef,
    workspaceContext
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

  const resetThread = useCallback(() => {
    clearCrmAssistantThreadStorage()
    runtime.thread.reset()
  }, [runtime])

  const saveAndNewThread = useCallback(() => {
    const exported = runtime.thread.export()
    const messages = (exported as { messages?: unknown[] }).messages ?? []
    if (messages.length > 0) {
      const saved: SavedThread = {
        id: crypto.randomUUID(),
        title: threadTitle(exported),
        savedAt: new Date().toISOString(),
        data: exported,
      }
      addSavedThread(saved)
      setSavedThreads(getSavedThreads())
    }
    clearCrmAssistantThreadStorage()
    runtime.thread.reset()
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
    },
    [runtime]
  )

  const deleteThread = useCallback((id: string) => {
    deleteSavedThread(id)
    setSavedThreads(getSavedThreads())
  }, [])

  const uiValue = useMemo<CrmAssistantUiValue>(
    () => ({
      commandMode,
      setCommandMode,
      resetThread,
      saveAndNewThread,
      loadThread,
      deleteThread,
      savedThreads,
    }),
    [commandMode, resetThread, saveAndNewThread, loadThread, deleteThread, savedThreads]
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
