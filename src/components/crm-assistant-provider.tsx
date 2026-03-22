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
} from "@/lib/crm-assistant-storage"
import {
  FallbackDocumentAttachmentAdapter,
  useCrmChatModelAdapter,
  type CreatedCommandProject,
  type CreatedCommandTask,
} from "@/lib/crm-assistant-chat"
import { useWorkspace } from "@/lib/workspace/context"

function isHexColor(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s.trim())
}

type CrmAssistantUiValue = {
  commandMode: boolean
  setCommandMode: (v: boolean) => void
  resetThread: () => void
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
  const { addTask, addProject } = useWorkspace()
  const onTasksCreatedRef = useRef<((tasks: CreatedCommandTask[]) => void) | undefined>(
    undefined
  )
  const onProjectsCreatedRef = useRef<
    ((projects: CreatedCommandProject[]) => void) | undefined
  >(undefined)

  useEffect(() => {
    onTasksCreatedRef.current = (tasks) => {
      for (const t of tasks) {
        addTask({
          title: t.title,
          description: t.description,
          priority: "medium",
          dueDate: t.dueDate,
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

  const [commandMode, setCommandMode] = useState(false)
  const commandModeRef = useRef(commandMode)
  useEffect(() => {
    commandModeRef.current = commandMode
  }, [commandMode])

  const adapter = useCrmChatModelAdapter(
    commandModeRef,
    onTasksCreatedRef,
    onProjectsCreatedRef
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

  const resetThread = useCallback(() => {
    clearCrmAssistantThreadStorage()
    runtime.thread.reset()
  }, [runtime])

  const uiValue = useMemo<CrmAssistantUiValue>(
    () => ({
      commandMode,
      setCommandMode,
      resetThread,
    }),
    [commandMode, resetThread]
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
