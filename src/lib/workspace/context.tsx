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
  Company,
  Contact,
  Deal,
  DealStage,
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
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  type WorkspaceSnapshotV1,
} from "@/lib/workspace/persist"

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
  savedChatTurns: SavedChatTurn[]
  selectedProjectFilterId: string
  setSelectedProjectFilterId: (id: string) => void
  addProject: (input: NewProjectInput) => Project
  updateProject: (id: string, partial: Partial<Project>) => void
  deleteProject: (id: string) => void
  addTask: (input: NewTaskInput) => Task
  updateTask: (id: string, partial: Partial<Task>) => void
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
  }) => void
  advanceDealStage: (dealId: string) => void
  appendSavedChatTurn: (turn: Omit<SavedChatTurn, "id" | "createdAt">) => void
  clearSavedChatTurns: () => void
  projectNameById: (id: string | undefined) => string | undefined
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
  const [selectedProjectFilterId, setSelectedProjectFilterId] = useState<string>(
    () => loadWorkspaceSnapshot()?.selectedProjectFilterId ?? ALL_PROJECTS_FILTER
  )

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
    }
    const t = window.setTimeout(() => saveWorkspaceSnapshot(snapshot), 400)
    return () => window.clearTimeout(t)
  }, [
    projects,
    tasks,
    contacts,
    companies,
    deals,
    selectedProjectFilterId,
    savedChatTurns,
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
        },
      ])
    },
    [contacts]
  )

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

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      projects,
      tasks,
      contacts,
      companies,
      deals,
      savedChatTurns,
      selectedProjectFilterId,
      setSelectedProjectFilterId,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      moveTaskToStatus,
      deleteTask,
      addContact,
      updateContact,
      addCompany,
      updateCompany,
      addDeal,
      advanceDealStage,
      appendSavedChatTurn,
      clearSavedChatTurns,
      projectNameById,
    }),
    [
      projects,
      tasks,
      contacts,
      companies,
      deals,
      savedChatTurns,
      selectedProjectFilterId,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      moveTaskToStatus,
      deleteTask,
      addContact,
      updateContact,
      addCompany,
      updateCompany,
      addDeal,
      advanceDealStage,
      appendSavedChatTurn,
      clearSavedChatTurns,
      projectNameById,
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
