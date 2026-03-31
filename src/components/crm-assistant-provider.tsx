"use client"

import {
  createContext,
  startTransition,
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
  CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY,
  clearCrmAssistantThreadStorage,
  getSavedThreads,
  addSavedThread,
  deleteSavedThread,
  updateSavedThread,
  type SavedThread,
} from "@/lib/crm-assistant-storage"
import { isWorkspaceFileSyncEnabled } from "@/lib/workspace/persist"
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

/** One-time: push legacy localStorage thread list into Firestore when cloud is empty */
async function migrateLegacyAssistantThreadsToFirestore(): Promise<void> {
  try {
    const listRes = await fetch("/api/assistant/threads")
    if (!listRes.ok) return
    const listJson = (await listRes.json()) as { threads?: unknown[] }
    if ((listJson.threads?.length ?? 0) > 0) return

    const legacySaved = getSavedThreads()
    for (const s of [...legacySaved].reverse()) {
      const cre = await fetch("/api/assistant/threads", { method: "POST" })
      if (!cre.ok) continue
      const { remoteId } = (await cre.json()) as { remoteId: string }
      await fetch(`/api/assistant/threads/${remoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: s.title,
          ...(s.data !== undefined ? { repository: s.data } : {}),
        }),
      })
    }
  } catch {
    /* offline / api down */
  }
}

type CrmAssistantUiValue = {
  commandMode: boolean
  setCommandMode: (v: boolean) => void
  resetThread: () => void
  saveAndNewThread: () => void | Promise<void>
  startNewThread: () => void | Promise<void>
  loadThread: (id: string) => void | Promise<void>
  renameThread: (id: string, title: string) => void | Promise<void>
  archiveThread: (id: string) => void | Promise<void>
  deleteThread: (id: string) => void | Promise<void>
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

  const [savedThreads, setSavedThreads] = useState<SavedThread[]>(() =>
    isWorkspaceFileSyncEnabled() ? [] : getSavedThreads()
  )
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const refreshThreadList = useCallback(async () => {
    if (!isWorkspaceFileSyncEnabled()) {
      startTransition(() => {
        setSavedThreads(getSavedThreads())
      })
      return
    }
    try {
      const res = await fetch("/api/assistant/threads")
      if (!res.ok) return
      const data = (await res.json()) as {
        threads: Array<{
          remoteId: string
          title?: string
          status: string
          updatedAt?: number
        }>
      }
      const mapped: SavedThread[] = (data.threads ?? []).map((t) => ({
        id: t.remoteId,
        title: t.title?.trim() || "New Chat",
        savedAt: new Date(
          typeof t.updatedAt === "number" ? t.updatedAt : Date.now()
        ).toISOString(),
        status: t.status === "archived" ? "archived" : "active",
        data: undefined,
      }))
      startTransition(() => {
        setSavedThreads(mapped)
      })
    } catch {
      /* ignore */
    }
  }, [])

  const loadedRef = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    const thread = runtime.thread
    let debounce: ReturnType<typeof setTimeout>
    let cancelled = false
    let unsub: (() => void) | undefined

    const mountSubscribe = () => {
      unsub = thread.subscribe(() => {
        clearTimeout(debounce)
        debounce = setTimeout(() => {
          try {
            const exported = thread.export()
            localStorage.setItem(
              CRM_ASSISTANT_THREAD_STORAGE_KEY,
              JSON.stringify(exported)
            )
          } catch {
            /* quota / private mode */
          }
          if (!isWorkspaceFileSyncEnabled()) return
          const remoteId = localStorage.getItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY)
          if (!remoteId) return
          const exported = thread.export()
          void fetch(`/api/assistant/threads/${remoteId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repository: exported }),
          }).catch(() => {})
        }, 800)
      })
    }

    void (async () => {
      if (!isWorkspaceFileSyncEnabled()) {
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
        mountSubscribe()
        return
      }

      await migrateLegacyAssistantThreadsToFirestore()
      if (cancelled) return
      await refreshThreadList()
      if (cancelled) return

      let activeId = localStorage.getItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY)
      const listRes = await fetch("/api/assistant/threads")
      if (!listRes.ok) {
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
              /* ignore */
            }
          }
        }
        mountSubscribe()
        return
      }

      const listJson = (await listRes.json()) as {
        threads?: Array<{ remoteId: string }>
      }
      const threadsList = listJson.threads ?? []
      const remoteIds = new Set(threadsList.map((t) => t.remoteId))

      if (!activeId || !remoteIds.has(activeId)) {
        let nextId = threadsList[0]?.remoteId ?? null
        if (!nextId) {
          const cre = await fetch("/api/assistant/threads", { method: "POST" })
          if (cre.ok) {
            nextId = ((await cre.json()) as { remoteId: string }).remoteId
          }
        }
        activeId = nextId
        if (activeId) {
          localStorage.setItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY, activeId)
        }
      }
      if (!cancelled && activeId) {
        startTransition(() => setActiveThreadId(activeId))
      }

      if (cancelled) return

      if (!loadedRef.current) {
        loadedRef.current = true
        let imported = false
        if (activeId) {
          const threadRes = await fetch(`/api/assistant/threads/${activeId}`)
          if (threadRes.ok) {
            const body = (await threadRes.json()) as { repository?: unknown }
            const repo = body.repository
            if (
              repo &&
              typeof repo === "object" &&
              Array.isArray((repo as { messages?: unknown }).messages)
            ) {
              try {
                thread.import(repo as ExportedMessageRepository)
                imported = true
              } catch {
                /* ignore */
              }
            }
          }
        }
        if (!imported) {
          const legacyRaw = localStorage.getItem(CRM_ASSISTANT_THREAD_STORAGE_KEY)
          if (legacyRaw) {
            try {
              const data = JSON.parse(legacyRaw) as ExportedMessageRepository
              if (data && Array.isArray(data.messages) && data.messages.length > 0) {
                thread.import(data)
                if (activeId) {
                  void fetch(`/api/assistant/threads/${activeId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      repository: data,
                      title: threadTitle(data),
                    }),
                  })
                }
              }
            } catch {
              /* ignore */
            }
          }
        }
      }

      if (!cancelled && activeId) {
        startTransition(() => setActiveThreadId(activeId))
      }
      mountSubscribe()
    })()

    return () => {
      cancelled = true
      clearTimeout(debounce)
      unsub?.()
    }
  }, [runtime, refreshThreadList])

  const loadThread = useCallback(
    async (id: string) => {
      if (!isWorkspaceFileSyncEnabled()) {
        const threads = getSavedThreads()
        const found = threads.find((t) => t.id === id)
        if (!found) return
        clearCrmAssistantThreadStorage()
        runtime.thread.reset()
        setTimeout(() => {
          try {
            runtime.thread.import(found.data as ExportedMessageRepository)
            localStorage.setItem(
              CRM_ASSISTANT_THREAD_STORAGE_KEY,
              JSON.stringify(found.data)
            )
          } catch {
            /* ignore */
          }
        }, 50)
        setActiveThreadId(found.id)
        return
      }

      clearCrmAssistantThreadStorage()
      runtime.thread.reset()
      localStorage.setItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY, id)
      setActiveThreadId(id)
      const r = await fetch(`/api/assistant/threads/${id}`)
      if (!r.ok) return
      const body = (await r.json()) as { repository?: unknown }
      setTimeout(() => {
        try {
          const repo = body.repository
          if (
            repo &&
            typeof repo === "object" &&
            Array.isArray((repo as { messages?: unknown }).messages)
          ) {
            runtime.thread.import(repo as ExportedMessageRepository)
            localStorage.setItem(
              CRM_ASSISTANT_THREAD_STORAGE_KEY,
              JSON.stringify(repo)
            )
          }
        } catch {
          /* ignore */
        }
      }, 50)
    },
    [runtime]
  )

  const ensureActiveRemoteThreadAfterRemoval = useCallback(
    async (removedId: string) => {
      const active = localStorage.getItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY)
      if (active !== removedId) {
        await refreshThreadList()
        return
      }
      const listRes = await fetch("/api/assistant/threads")
      let nextId: string | null = null
      if (listRes.ok) {
        const listJson = (await listRes.json()) as {
          threads?: Array<{ remoteId: string }>
        }
        nextId = listJson.threads?.[0]?.remoteId ?? null
      }
      if (!nextId) {
        const cre = await fetch("/api/assistant/threads", { method: "POST" })
        if (cre.ok) {
          nextId = ((await cre.json()) as { remoteId: string }).remoteId
        }
      }
      if (nextId) {
        await loadThread(nextId)
      } else {
        localStorage.removeItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY)
        setActiveThreadId(null)
        clearCrmAssistantThreadStorage()
        runtime.thread.reset()
      }
      await refreshThreadList()
    },
    [loadThread, refreshThreadList, runtime]
  )

  const resetThread = useCallback(() => {
    clearCrmAssistantThreadStorage()
    runtime.thread.reset()
    if (isWorkspaceFileSyncEnabled()) {
      const id = localStorage.getItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY)
      if (id) {
        const empty = runtime.thread.export()
        void fetch(`/api/assistant/threads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repository: empty }),
        }).catch(() => {})
      }
    } else {
      setActiveThreadId(null)
    }
  }, [runtime])

  const saveAndNewThread = useCallback(async () => {
    if (!isWorkspaceFileSyncEnabled()) {
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
      return
    }

    const currentId = localStorage.getItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY)
    const exported = runtime.thread.export()
    if (currentId) {
      await fetch(`/api/assistant/threads/${currentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repository: exported }),
      }).catch(() => {})
    }
    const cre = await fetch("/api/assistant/threads", { method: "POST" })
    if (!cre.ok) return
    const { remoteId } = (await cre.json()) as { remoteId: string }
    localStorage.setItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY, remoteId)
    clearCrmAssistantThreadStorage()
    runtime.thread.reset()
    setActiveThreadId(remoteId)
    await refreshThreadList()
  }, [runtime, refreshThreadList])

  const renameThread = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      if (!isWorkspaceFileSyncEnabled()) {
        updateSavedThread(id, { title: trimmed })
        setSavedThreads(getSavedThreads())
        return
      }
      await fetch(`/api/assistant/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      })
      await refreshThreadList()
    },
    [refreshThreadList]
  )

  const archiveThread = useCallback(
    async (id: string) => {
      if (!isWorkspaceFileSyncEnabled()) {
        updateSavedThread(id, { status: "archived" })
        setSavedThreads(getSavedThreads())
        setActiveThreadId((prev) => (prev === id ? null : prev))
        return
      }
      await fetch(`/api/assistant/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      })
      await ensureActiveRemoteThreadAfterRemoval(id)
    },
    [ensureActiveRemoteThreadAfterRemoval]
  )

  const deleteThread = useCallback(
    async (id: string) => {
      if (!isWorkspaceFileSyncEnabled()) {
        deleteSavedThread(id)
        setSavedThreads(getSavedThreads())
        setActiveThreadId((prev) => (prev === id ? null : prev))
        return
      }
      await fetch(`/api/assistant/threads/${id}`, { method: "DELETE" })
      await ensureActiveRemoteThreadAfterRemoval(id)
    },
    [ensureActiveRemoteThreadAfterRemoval]
  )

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
