"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type {
  CalendarEvent,
  Company,
  Contact,
  Deal,
  DealStage,
  Document,
  Priority,
  Project,
  ProjectLifecycleStatus,
  ResourceLink,
  SavedChatTurn,
  Task,
  TaskStatus,
} from "@/lib/types"
import {
  seedCompanies,
  seedContacts,
  seedDeals,
  seedProjects,
  seedTasks,
} from "@/lib/workspace/seed"
import {
  isWorkspaceFileSyncEnabled,
  loadWorkspaceSnapshot,
  normalizeWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshotV1,
} from "@/lib/workspace/persist"
import { isoDateAddDays, toIsoDateLocal } from "@/lib/due-date-utils"

export const ALL_PROJECTS_FILTER = "all"

type NewProjectInput = {
  name: string
  description?: string
  color: string
  category?: string
  customFields?: Record<string, string>
}

type NewTaskInput = {
  title: string
  description?: string
  projectId?: string
  priority: Priority
  dueDate?: string
  assignee?: string
  status?: TaskStatus
  section?: string
  tags?: string[]
  sortOrder?: number
  links?: ResourceLink[]
}

type WorkspaceContextValue = {
  projects: Project[]
  tasks: Task[]
  contacts: Contact[]
  companies: Company[]
  deals: Deal[]
  calendarEvents: CalendarEvent[]
  documents: Document[]
  savedChatTurns: SavedChatTurn[]
  selectedProjectFilterId: string
  setSelectedProjectFilterId: (id: string) => void
  taskDefaultDueOffsetDays: number | null
  setTaskDefaultDueOffsetDays: (days: number | null) => void
  addProject: (input: NewProjectInput) => Project
  updateProject: (id: string, partial: Partial<Project>) => void
  deleteProject: (id: string) => void
  addTask: (input: NewTaskInput) => Task
  updateTask: (id: string, partial: Partial<Task>) => void
  /** Set the same due date on many tasks (undefined clears). */
  bulkSetTaskDueDates: (taskIds: string[], dueDate: string | undefined) => void
  /** Shift each task’s due date by `days` (uses today if a task has no due date). */
  bulkBumpTaskDueDates: (taskIds: string[], days: number) => void
  moveTaskToStatus: (taskId: string, status: TaskStatus) => void
  deleteTask: (id: string) => void
  addContact: (input: Omit<Contact, "id" | "tags" | "createdAt"> & { tags?: string[] }) => void
  updateContact: (id: string, partial: Partial<Contact>) => void
  addCompany: (input: Omit<Company, "id" | "contactCount" | "createdAt">) => void
  updateCompany: (id: string, partial: Partial<Company>) => void
  addDeal: (input: {
    title: string
    value: number
    stage: DealStage
    contactId?: string
    contactName?: string
    closeDate?: string
    followUpAt?: string
  }) => void
  updateDeal: (id: string, partial: Partial<Deal>) => void
  advanceDealStage: (dealId: string) => void
  addCalendarEvent: (input: {
    title: string
    date: string
    time?: string
    description?: string
  }) => CalendarEvent
  deleteCalendarEvent: (id: string) => void
  appendSavedChatTurn: (turn: Omit<SavedChatTurn, "id" | "createdAt">) => void
  clearSavedChatTurns: () => void
  projectNameById: (id: string | undefined) => string | undefined
  addDocument: (doc: Omit<Document, "id">) => Document
  deleteDocument: (id: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function isoNow() {
  return new Date().toISOString()
}

function defaultDueDate() {
  const d = new Date()
  d.setMonth(d.getMonth() + 2)
  return d.toISOString().slice(0, 10)
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    const s = loadWorkspaceSnapshot()
    if (s) return s.projects
    return [...seedProjects]
  })
  const [tasks, setTasks] = useState<Task[]>(() => {
    const s = loadWorkspaceSnapshot()
    if (s) return s.tasks
    return [...seedTasks]
  })
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const s = loadWorkspaceSnapshot()
    if (s) return s.contacts
    return [...seedContacts]
  })
  const [companies, setCompanies] = useState<Company[]>(() => {
    const s = loadWorkspaceSnapshot()
    if (s) return s.companies
    return [...seedCompanies]
  })
  const [deals, setDeals] = useState<Deal[]>(() => {
    const s = loadWorkspaceSnapshot()
    if (s) return s.deals
    return [...seedDeals]
  })
  const [savedChatTurns, setSavedChatTurns] = useState<SavedChatTurn[]>(() => {
    const s = loadWorkspaceSnapshot()
    if (s && Array.isArray(s.savedChatTurns)) return s.savedChatTurns
    return []
  })
  const [documents, setDocuments] = useState<Document[]>(() => {
    const s = loadWorkspaceSnapshot()
    if (s && Array.isArray(s.documents)) return s.documents
    return []
  })
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const s = loadWorkspaceSnapshot()
    if (s && Array.isArray(s.calendarEvents)) return s.calendarEvents
    return []
  })
  const [taskDefaultDueOffsetDays, setTaskDefaultDueOffsetDays] = useState<number | null>(
    () => {
      const s = loadWorkspaceSnapshot()
      if (
        s &&
        typeof s.taskDefaultDueOffsetDays === "number" &&
        Number.isFinite(s.taskDefaultDueOffsetDays) &&
        s.taskDefaultDueOffsetDays >= 0 &&
        s.taskDefaultDueOffsetDays <= 365
      ) {
        return s.taskDefaultDueOffsetDays
      }
      return null
    }
  )
  const [selectedProjectFilterId, setSelectedProjectFilterId] = useState<string>(
    () => loadWorkspaceSnapshot()?.selectedProjectFilterId ?? ALL_PROJECTS_FILTER
  )

  useEffect(() => {
    if (!isWorkspaceFileSyncEnabled()) return
    const localPersistedAt = loadWorkspaceSnapshot()?.persistedAt ?? 0
    let cancelled = false
    void (async () => {
      const res = await fetch("/api/workspace/snapshot")
      if (cancelled) return
      if (res.status === 503 || res.status === 404) return
      if (!res.ok) return
      let raw: unknown
      try {
        raw = await res.json()
      } catch {
        return
      }
      const remote = normalizeWorkspaceSnapshot(raw)
      if (!remote || cancelled) return
      const remoteT = remote.persistedAt ?? 0
      if (remoteT < localPersistedAt) return
      setProjects(remote.projects)
      setTasks(remote.tasks)
      setContacts(remote.contacts)
      setCompanies(remote.companies)
      setDeals(remote.deals)
      setSavedChatTurns(
        Array.isArray(remote.savedChatTurns) ? remote.savedChatTurns : []
      )
      // Merge so remote snapshot does not wipe documents added locally before the fetch completed.
      setDocuments((prev) => {
        const remoteDocs = Array.isArray(remote.documents) ? remote.documents : []
        const remoteIds = new Set(remoteDocs.map((d) => d.id))
        const merged = [...remoteDocs]
        for (const d of prev) {
          if (!remoteIds.has(d.id)) merged.push(d)
        }
        return merged
      })
      setCalendarEvents(Array.isArray(remote.calendarEvents) ? remote.calendarEvents : [])
      setTaskDefaultDueOffsetDays(
        typeof remote.taskDefaultDueOffsetDays === "number" &&
          remote.taskDefaultDueOffsetDays >= 0 &&
          remote.taskDefaultDueOffsetDays <= 365
          ? remote.taskDefaultDueOffsetDays
          : null
      )
      setSelectedProjectFilterId(remote.selectedProjectFilterId)
      // Persist merged state via the debounced effect below (do not save `remote` alone).
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const snapshot: WorkspaceSnapshotV1 = {
      version: 1,
      projects,
      tasks,
      contacts,
      companies,
      deals,
      selectedProjectFilterId,
      savedChatTurns,
      documents,
      calendarEvents,
      taskDefaultDueOffsetDays,
      persistedAt: Date.now(),
    }
    const t = window.setTimeout(() => {
      saveWorkspaceSnapshot(snapshot)
      if (isWorkspaceFileSyncEnabled()) {
        void fetch("/api/workspace/snapshot", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        })
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [
    projects,
    tasks,
    contacts,
    companies,
    deals,
    selectedProjectFilterId,
    savedChatTurns,
    documents,
    calendarEvents,
    taskDefaultDueOffsetDays,
  ])

  const projectNameById = useCallback(
    (id: string | undefined) => {
      if (!id) return undefined
      return projects.find((p) => p.id === id)?.name
    },
    [projects]
  )

  const addProject = useCallback((input: NewProjectInput) => {
    const ts = isoNow()
    const next: Project = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      color: input.color,
      category: input.category,
      customFields:
        input.customFields && Object.keys(input.customFields).length
          ? input.customFields
          : undefined,
      createdAt: ts,
      updatedAt: ts,
      status: "active" as ProjectLifecycleStatus,
      progress: 0,
      members: 1,
      dueDate: defaultDueDate(),
    }
    setProjects((prev) => [...prev, next])
    return next
  }, [])

  const updateProject = useCallback((id: string, partial: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...partial, updatedAt: isoNow() } : p))
    )
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setTasks((prev) =>
      prev.map((t) =>
        t.projectId === id
          ? { ...t, projectId: undefined, projectName: undefined }
          : t
      )
    )
    setSelectedProjectFilterId((cur) => (cur === id ? ALL_PROJECTS_FILTER : cur))
  }, [])

  const addTask = useCallback(
    (input: NewTaskInput) => {
      const ts = isoNow()
      const name = input.projectId ? projectNameById(input.projectId) : undefined
      const next: Task = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        projectId: input.projectId,
        projectName: name,
        status: input.status ?? "todo",
        priority: input.priority,
        dueDate: input.dueDate,
        assignee: input.assignee?.trim() || undefined,
        createdAt: ts,
        section: input.section?.trim() || undefined,
        tags: input.tags?.length ? input.tags : undefined,
        sortOrder: input.sortOrder,
        links: input.links?.filter((l) => l.label.trim() && l.href.trim()).length
          ? input.links.filter((l) => l.label.trim() && l.href.trim())
          : undefined,
      }
      setTasks((prev) => [...prev, next])
      return next
    },
    [projectNameById]
  )

  const updateTask = useCallback((id: string, partial: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const merged = { ...t, ...partial }
        if (partial.projectId !== undefined) {
          merged.projectName = partial.projectId
            ? projects.find((p) => p.id === partial.projectId)?.name
            : undefined
        }
        return merged
      })
    )
  }, [projects])

  const bulkSetTaskDueDates = useCallback(
    (taskIds: string[], dueDate: string | undefined) => {
      const idSet = new Set(taskIds)
      setTasks((prev) =>
        prev.map((t) => (idSet.has(t.id) ? { ...t, dueDate } : t))
      )
    },
    []
  )

  const bulkBumpTaskDueDates = useCallback((taskIds: string[], days: number) => {
    const idSet = new Set(taskIds)
    const today = toIsoDateLocal(new Date())
    setTasks((prev) =>
      prev.map((t) => {
        if (!idSet.has(t.id)) return t
        const base = t.dueDate ?? today
        return { ...t, dueDate: isoDateAddDays(base, days) }
      })
    )
  }, [])

  const moveTaskToStatus = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addContact = useCallback(
    (input: Omit<Contact, "id" | "tags" | "createdAt"> & { tags?: string[] }) => {
      if (!input.name.trim()) return
      setContacts((prev) => [
        ...prev,
        {
          ...input,
          id: crypto.randomUUID(),
          tags: input.tags ?? [],
          createdAt: isoNow(),
        },
      ])
    },
    []
  )

  const updateContact = useCallback((id: string, partial: Partial<Contact>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c)))
  }, [])

  const addCompany = useCallback((input: Omit<Company, "id" | "contactCount" | "createdAt">) => {
    if (!input.name.trim()) return
    setCompanies((prev) => [
      ...prev,
      {
        ...input,
        id: crypto.randomUUID(),
        contactCount: 0,
        createdAt: isoNow(),
      },
    ])
  }, [])

  const updateCompany = useCallback((id: string, partial: Partial<Company>) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c)))
  }, [])

  const addDeal = useCallback(
    (input: {
      title: string
      value: number
      stage: DealStage
      contactId?: string
      contactName?: string
      closeDate?: string
      followUpAt?: string
    }) => {
      if (!input.title.trim()) return
      const contactName =
        input.contactName?.trim() ||
        (input.contactId ? contacts.find((c) => c.id === input.contactId)?.name : undefined)
      setDeals((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          title: input.title.trim(),
          value: input.value,
          stage: input.stage,
          contactId: input.contactId,
          contactName,
          createdAt: isoNow(),
          closeDate: input.closeDate?.trim() || undefined,
          followUpAt: input.followUpAt?.trim() || undefined,
        },
      ])
    },
    [contacts]
  )

  const updateDeal = useCallback((id: string, partial: Partial<Deal>) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...partial } : d)))
  }, [])

  const addCalendarEvent = useCallback(
    (input: { title: string; date: string; time?: string; description?: string }) => {
      const next: CalendarEvent = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        date: input.date,
        type: "meeting",
        time: input.time?.trim() || undefined,
        description: input.description?.trim() || undefined,
      }
      setCalendarEvents((prev) => [...prev, next])
      return next
    },
    []
  )

  const deleteCalendarEvent = useCallback((id: string) => {
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const advanceDealStage = useCallback((dealId: string) => {
    const order: DealStage[] = [
      "lead",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ]
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d
        const i = order.indexOf(d.stage)
        if (i < 0 || i >= order.length - 1) return d
        return { ...d, stage: order[i + 1] }
      })
    )
  }, [])

  const appendSavedChatTurn = useCallback(
    (turn: Omit<SavedChatTurn, "id" | "createdAt">) => {
      const row: SavedChatTurn = {
        ...turn,
        id: crypto.randomUUID(),
        createdAt: isoNow(),
      }
      setSavedChatTurns((prev) => [row, ...prev].slice(0, 80))
    },
    []
  )

  const clearSavedChatTurns = useCallback(() => {
    setSavedChatTurns([])
  }, [])

  const addDocument = useCallback((doc: Omit<Document, "id">): Document => {
    const next: Document = { ...doc, id: crypto.randomUUID() }
    setDocuments((prev) => [next, ...prev])
    return next
  }, [])

  const deleteDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      projects,
      tasks,
      contacts,
      companies,
      deals,
      calendarEvents,
      documents,
      savedChatTurns,
      selectedProjectFilterId,
      setSelectedProjectFilterId,
      taskDefaultDueOffsetDays,
      setTaskDefaultDueOffsetDays,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      bulkSetTaskDueDates,
      bulkBumpTaskDueDates,
      moveTaskToStatus,
      deleteTask,
      addContact,
      updateContact,
      addCompany,
      updateCompany,
      addDeal,
      updateDeal,
      advanceDealStage,
      addCalendarEvent,
      deleteCalendarEvent,
      appendSavedChatTurn,
      clearSavedChatTurns,
      projectNameById,
      addDocument,
      deleteDocument,
    }),
    [
      projects,
      tasks,
      contacts,
      companies,
      deals,
      calendarEvents,
      documents,
      savedChatTurns,
      selectedProjectFilterId,
      taskDefaultDueOffsetDays,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      bulkSetTaskDueDates,
      bulkBumpTaskDueDates,
      moveTaskToStatus,
      deleteTask,
      addContact,
      updateContact,
      addCompany,
      updateCompany,
      addDeal,
      updateDeal,
      advanceDealStage,
      addCalendarEvent,
      deleteCalendarEvent,
      appendSavedChatTurn,
      clearSavedChatTurns,
      projectNameById,
      addDocument,
      deleteDocument,
    ]
  )

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return ctx
}
