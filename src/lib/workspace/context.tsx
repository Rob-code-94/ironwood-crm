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
  type SetStateAction,
} from "react"
import { toast } from "sonner"
import type {
  CalendarEvent,
  Company,
  Contact,
  Deal,
  DealStage,
  Document,
  NotificationPreferences,
  PlannerNotification,
  Priority,
  Project,
  ProjectLifecycleStatus,
  ReminderConfig,
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
import { repairMissingProjectsFromRefs } from "@/lib/workspace/repair-missing-projects"
import { wouldDestructiveOverwriteReject } from "@/lib/workspace/workspace-snapshot-guards"
import { isoDateAddDays, toIsoDateLocal } from "@/lib/due-date-utils"
import { collectDueNotifications, defaultReminderConfig, withReminderSnoozedUntil } from "@/lib/reminders"

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
  reminders?: ReminderConfig[]
  recurrence?: Task["recurrence"]
  invitees?: Task["invitees"]
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
  notificationPreferences: NotificationPreferences
  updateNotificationPreferences: (partial: Partial<NotificationPreferences>) => void
  notifications: PlannerNotification[]
  markNotificationRead: (id: string) => void
  clearNotifications: () => void
  dismissNotification: (id: string) => void
  snoozeNotification: (id: string, minutes?: number) => void
  addProject: (input: NewProjectInput) => Project
  updateProject: (id: string, partial: Partial<Project>) => void
  deleteProject: (id: string) => void
  addTask: (input: NewTaskInput) => Task
  updateTask: (id: string, partial: Partial<Task>) => void
  pinTaskToLineup: (id: string) => void
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
    reminders?: ReminderConfig[]
    recurrence?: CalendarEvent["recurrence"]
    invitees?: string[]
  }) => CalendarEvent
  updateCalendarEvent: (id: string, partial: Partial<CalendarEvent>) => void
  deleteCalendarEvent: (id: string) => void
  appendSavedChatTurn: (turn: Omit<SavedChatTurn, "id" | "createdAt">) => void
  clearSavedChatTurns: () => void
  projectNameById: (id: string | undefined) => string | undefined
  addDocument: (doc: Omit<Document, "id">) => Document
  deleteDocument: (id: string) => void
  /** True while waiting for the first remote workspace load when cloud sync is enabled. */
  workspaceRemoteLoading: boolean
  /** Infer missing `Project` rows from task/document `projectId` refs (then persists). */
  repairWorkspaceFromRefs: () => void
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

/** Matches server CAS (`persistedAtFromStoredRaw` in workspace-put-payload). */
function serverVersionFromSnapshot(s: WorkspaceSnapshotV1): number | null {
  if (typeof s.persistedAt === "number" && Number.isFinite(s.persistedAt)) return s.persistedAt
  const has =
    s.projects.length > 0 ||
    s.tasks.length > 0 ||
    s.contacts.length > 0 ||
    s.companies.length > 0 ||
    s.deals.length > 0 ||
    (s.documents?.length ?? 0) > 0 ||
    (s.calendarEvents?.length ?? 0) > 0 ||
    (s.savedChatTurns?.length ?? 0) > 0
  return has ? 0 : null
}

function readLocalWorkspaceOrSeed(): WorkspaceSnapshotV1 {
  const s = loadWorkspaceSnapshot()
  if (s) return s
  return {
    version: 1,
    projects: [...seedProjects],
    tasks: [...seedTasks],
    contacts: [...seedContacts],
    companies: [...seedCompanies],
    deals: [...seedDeals],
    selectedProjectFilterId: ALL_PROJECTS_FILTER,
    savedChatTurns: [],
    documents: [],
    calendarEvents: [],
    taskDefaultDueOffsetDays: null,
    notificationPreferences: {
      inAppEnabled: true,
      pushEnabled: false,
      defaultReminderMinutesBefore: 60,
      defaultSnoozeMinutes: 10,
    },
    notifications: [],
    persistedAt: undefined,
  }
}

function emptySyncWorkspace(): WorkspaceSnapshotV1 {
  return {
    version: 1,
    projects: [],
    tasks: [],
    contacts: [],
    companies: [],
    deals: [],
    selectedProjectFilterId: ALL_PROJECTS_FILTER,
    savedChatTurns: [],
    documents: [],
    calendarEvents: [],
    taskDefaultDueOffsetDays: null,
    notificationPreferences: {
      inAppEnabled: true,
      pushEnabled: false,
      defaultReminderMinutesBefore: 60,
      defaultSnoozeMinutes: 10,
    },
    notifications: [],
    persistedAt: undefined,
  }
}

function getInitialWorkspaceSnapshot(): WorkspaceSnapshotV1 {
  if (typeof window === "undefined") {
    return isWorkspaceFileSyncEnabled() ? emptySyncWorkspace() : readLocalWorkspaceOrSeed()
  }
  if (!isWorkspaceFileSyncEnabled()) return readLocalWorkspaceOrSeed()
  return emptySyncWorkspace()
}

type WorkspaceStateSetters = {
  setProjects: (v: SetStateAction<Project[]>) => void
  setTasks: (v: SetStateAction<Task[]>) => void
  setContacts: (v: SetStateAction<Contact[]>) => void
  setCompanies: (v: SetStateAction<Company[]>) => void
  setDeals: (v: SetStateAction<Deal[]>) => void
  setSavedChatTurns: (v: SetStateAction<SavedChatTurn[]>) => void
  setDocuments: (v: SetStateAction<Document[]>) => void
  setCalendarEvents: (v: SetStateAction<CalendarEvent[]>) => void
  setTaskDefaultDueOffsetDays: (v: SetStateAction<number | null>) => void
  setNotificationPreferences: (v: SetStateAction<NotificationPreferences>) => void
  setNotifications: (v: SetStateAction<PlannerNotification[]>) => void
  setSelectedProjectFilterId: (v: SetStateAction<string>) => void
}

function applySnapshotToSetters(
  remote: WorkspaceSnapshotV1,
  setters: WorkspaceStateSetters,
  lastServerPersistedAtRef: { current: number | null },
  lastServerSnapshotForGuardRef: { current: WorkspaceSnapshotV1 | null }
) {
  setters.setProjects(remote.projects)
  setters.setTasks(remote.tasks)
  setters.setContacts(remote.contacts)
  setters.setCompanies(remote.companies)
  setters.setDeals(remote.deals)
  setters.setSavedChatTurns(Array.isArray(remote.savedChatTurns) ? remote.savedChatTurns : [])
  setters.setDocuments(Array.isArray(remote.documents) ? remote.documents : [])
  setters.setCalendarEvents(Array.isArray(remote.calendarEvents) ? remote.calendarEvents : [])
  setters.setTaskDefaultDueOffsetDays(
    typeof remote.taskDefaultDueOffsetDays === "number" &&
      remote.taskDefaultDueOffsetDays >= 0 &&
      remote.taskDefaultDueOffsetDays <= 365
      ? remote.taskDefaultDueOffsetDays
      : null
  )
  setters.setNotificationPreferences(
    remote.notificationPreferences ?? {
      inAppEnabled: true,
      pushEnabled: false,
      defaultReminderMinutesBefore: 60,
      defaultSnoozeMinutes: 10,
    }
  )
  setters.setNotifications(Array.isArray(remote.notifications) ? remote.notifications : [])
  setters.setSelectedProjectFilterId(remote.selectedProjectFilterId)
  lastServerPersistedAtRef.current = serverVersionFromSnapshot(remote)
  lastServerSnapshotForGuardRef.current = remote
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [initialSnapshot] = useState(() => getInitialWorkspaceSnapshot())
  const [workspaceHydrated, setWorkspaceHydrated] = useState(
    () => !isWorkspaceFileSyncEnabled()
  )
  const lastServerPersistedAtRef = useRef<number | null>(null)
  const lastServerSnapshotForGuardRef = useRef<WorkspaceSnapshotV1 | null>(null)

  const [projects, setProjects] = useState(initialSnapshot.projects)
  const [tasks, setTasks] = useState(initialSnapshot.tasks)
  const [contacts, setContacts] = useState(initialSnapshot.contacts)
  const [companies, setCompanies] = useState(initialSnapshot.companies)
  const [deals, setDeals] = useState(initialSnapshot.deals)
  const [savedChatTurns, setSavedChatTurns] = useState(initialSnapshot.savedChatTurns)
  const [documents, setDocuments] = useState(() => initialSnapshot.documents ?? [])
  const [calendarEvents, setCalendarEvents] = useState(
    () => initialSnapshot.calendarEvents ?? []
  )
  const [taskDefaultDueOffsetDays, setTaskDefaultDueOffsetDays] = useState<
    number | null
  >(() => initialSnapshot.taskDefaultDueOffsetDays ?? null)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    () =>
      initialSnapshot.notificationPreferences ?? {
        inAppEnabled: true,
        pushEnabled: false,
        defaultReminderMinutesBefore: 60,
        defaultSnoozeMinutes: 10,
      }
  )
  const [notifications, setNotifications] = useState<PlannerNotification[]>(
    () => initialSnapshot.notifications ?? []
  )
  const [selectedProjectFilterId, setSelectedProjectFilterId] = useState(
    () => initialSnapshot.selectedProjectFilterId
  )

  const workspaceSetters: WorkspaceStateSetters = useMemo(
    () => ({
      setProjects,
      setTasks,
      setContacts,
      setCompanies,
      setDeals,
      setSavedChatTurns,
      setDocuments,
      setCalendarEvents,
      setTaskDefaultDueOffsetDays,
      setNotificationPreferences,
      setNotifications,
      setSelectedProjectFilterId,
    }),
    [
      setProjects,
      setTasks,
      setContacts,
      setCompanies,
      setDeals,
      setSavedChatTurns,
      setDocuments,
      setCalendarEvents,
      setTaskDefaultDueOffsetDays,
      setNotificationPreferences,
      setNotifications,
      setSelectedProjectFilterId,
    ]
  )

  const applyRemoteSnapshot = useCallback(
    (remote: WorkspaceSnapshotV1) => {
      applySnapshotToSetters(
        remote,
        workspaceSetters,
        lastServerPersistedAtRef,
        lastServerSnapshotForGuardRef
      )
    },
    [workspaceSetters]
  )

  useEffect(() => {
    if (!isWorkspaceFileSyncEnabled()) return
    let cancelled = false

    void (async () => {
      const res = await fetch("/api/workspace/snapshot")
      if (cancelled) return

      const finishWithLocalFallback = () => {
        startTransition(() => {
          if (cancelled) return
          const local = loadWorkspaceSnapshot()
          if (local)
            applySnapshotToSetters(
              local,
              workspaceSetters,
              lastServerPersistedAtRef,
              lastServerSnapshotForGuardRef
            )
          else {
            lastServerPersistedAtRef.current = null
            lastServerSnapshotForGuardRef.current = null
          }
          setWorkspaceHydrated(true)
        })
      }

      if (res.status === 503 || res.status === 404) {
        finishWithLocalFallback()
        return
      }
      if (!res.ok) {
        finishWithLocalFallback()
        return
      }

      let raw: unknown
      try {
        raw = await res.json()
      } catch {
        finishWithLocalFallback()
        return
      }

      const remote = normalizeWorkspaceSnapshot(raw)
      if (!remote) {
        finishWithLocalFallback()
        return
      }

      const localSnap = loadWorkspaceSnapshot()
      const localPersistedAt = localSnap?.persistedAt ?? 0
      const remoteT = remote.persistedAt ?? 0
      const localHasData =
        (localSnap?.projects?.length ?? 0) > 0 ||
        (localSnap?.tasks?.length ?? 0) > 0 ||
        (localSnap?.contacts?.length ?? 0) > 0 ||
        (localSnap?.companies?.length ?? 0) > 0 ||
        (localSnap?.deals?.length ?? 0) > 0
      const remoteLooksEmpty =
        remote.projects.length === 0 &&
        remote.tasks.length === 0 &&
        remote.contacts.length === 0 &&
        remote.companies.length === 0 &&
        remote.deals.length === 0

      if (cancelled) return

      if (remoteT < localPersistedAt && localSnap) {
        startTransition(() => {
          if (cancelled) return
          applySnapshotToSetters(
            localSnap,
            workspaceSetters,
            lastServerPersistedAtRef,
            lastServerSnapshotForGuardRef
          )
          setWorkspaceHydrated(true)
        })
        return
      }

      if (localHasData && remoteLooksEmpty && localSnap) {
        if (process.env.NODE_ENV === "development") {
          console.info("[Ironwood workspace] Keeping local workspace; remote core data is empty.", {
            localPersistedAt,
            remoteT,
          })
        }
        startTransition(() => {
          if (cancelled) return
          applySnapshotToSetters(
            localSnap,
            workspaceSetters,
            lastServerPersistedAtRef,
            lastServerSnapshotForGuardRef
          )
          setWorkspaceHydrated(true)
        })
        return
      }

      if (process.env.NODE_ENV === "development") {
        console.info("[Ironwood workspace] Applying remote snapshot.", {
          remoteT,
          localPersistedAt,
          projects: remote.projects.length,
          tasks: remote.tasks.length,
        })
      }

      startTransition(() => {
        if (cancelled) return
        applySnapshotToSetters(
          remote,
          workspaceSetters,
          lastServerPersistedAtRef,
          lastServerSnapshotForGuardRef
        )
        setWorkspaceHydrated(true)
      })
    })()

    return () => {
      cancelled = true
    }
  }, [workspaceSetters])

  const repairWorkspaceFromRefs = useCallback(() => {
    setProjects((prev) => {
      const next = repairMissingProjectsFromRefs(prev, tasks, documents)
      if (next === prev) {
        toast.info("No missing projects to restore from task or document links.")
        return prev
      }
      toast.success(
        `Restored ${next.length - prev.length} project(s) from task or document links. Save syncs to Firestore.`
      )
      return next
    })
  }, [tasks, documents])

  const workspaceRemoteLoading = isWorkspaceFileSyncEnabled() && !workspaceHydrated

  useEffect(() => {
    if (isWorkspaceFileSyncEnabled() && !workspaceHydrated) return

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
      notificationPreferences,
      notifications,
      persistedAt: Date.now(),
    }
    const t = window.setTimeout(() => {
      saveWorkspaceSnapshot(snapshot)
      if (!isWorkspaceFileSyncEnabled()) return

      void (async () => {
        const basis = lastServerSnapshotForGuardRef.current
        if (basis && wouldDestructiveOverwriteReject(basis, snapshot)) {
          toast.error(
            "Save skipped: this would remove most of your workspace. Refresh the page or check you are on the right account."
          )
          return
        }

        const res = await fetch("/api/workspace/snapshot", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedPersistedAt: lastServerPersistedAtRef.current,
            snapshot,
          }),
        })
        if (res.status === 409) {
          toast.info("Workspace was updated elsewhere. Loading the latest data…")
          const g = await fetch("/api/workspace/snapshot")
          if (!g.ok) return
          try {
            const raw = await g.json()
            const latest = normalizeWorkspaceSnapshot(raw)
            if (latest) {
              startTransition(() => {
                applyRemoteSnapshot(latest)
              })
            }
          } catch {
            /* ignore */
          }
          return
        }
        if (res.status === 422) {
          let payload: { destructive?: boolean; error?: string } = {}
          try {
            payload = (await res.json()) as typeof payload
          } catch {
            /* ignore */
          }
          if (payload.destructive) {
            toast.error(
              payload.error ?? "Save blocked so your workspace data is not wiped by mistake."
            )
          } else if (payload.error) {
            toast.error(payload.error)
          }
          const g = await fetch("/api/workspace/snapshot")
          if (!g.ok) return
          try {
            const raw = await g.json()
            const latest = normalizeWorkspaceSnapshot(raw)
            if (latest) {
              startTransition(() => {
                applyRemoteSnapshot(latest)
              })
            }
          } catch {
            /* ignore */
          }
          return
        }
        if (res.ok) {
          const persisted =
            typeof snapshot.persistedAt === "number" && Number.isFinite(snapshot.persistedAt)
              ? snapshot.persistedAt
              : Date.now()
          lastServerPersistedAtRef.current = persisted
          lastServerSnapshotForGuardRef.current = { ...snapshot, persistedAt: persisted }
        }
      })()
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
    notificationPreferences,
    notifications,
    workspaceHydrated,
    applyRemoteSnapshot,
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
        reminders: input.reminders?.length
          ? input.reminders
          : defaultReminderConfig(notificationPreferences.defaultReminderMinutesBefore),
        recurrence: input.recurrence,
        invitees: input.invitees,
      }
      setTasks((prev) => [...prev, next])
      return next
    },
    [projectNameById, notificationPreferences.defaultReminderMinutesBefore]
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

  const pinTaskToLineup = useCallback((id: string) => {
    let pinned = false
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        pinned = true
        return t.pinnedToLineup ? t : { ...t, pinnedToLineup: true }
      })
    )
    if (!pinned) {
      toast.error("Could not pin task: task no longer exists.")
    }
  }, [])

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
    (input: {
      title: string
      date: string
      time?: string
      description?: string
      reminders?: ReminderConfig[]
      recurrence?: CalendarEvent["recurrence"]
      invitees?: string[]
    }) => {
      const next: CalendarEvent = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        date: input.date,
        type: "meeting",
        time: input.time?.trim() || undefined,
        description: input.description?.trim() || undefined,
        reminders: input.reminders?.length
          ? input.reminders
          : defaultReminderConfig(notificationPreferences.defaultReminderMinutesBefore),
        recurrence: input.recurrence,
        invitees: input.invitees?.length
          ? input.invitees.map((email) => ({
              id: crypto.randomUUID(),
              email: email.trim(),
              status: "pending" as const,
            }))
          : undefined,
      }
      setCalendarEvents((prev) => [...prev, next])
      return next
    },
    [notificationPreferences.defaultReminderMinutesBefore]
  )

  const updateCalendarEvent = useCallback((id: string, partial: Partial<CalendarEvent>) => {
    setCalendarEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...partial } : e)))
  }, [])

  const deleteCalendarEvent = useCallback((id: string) => {
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const updateNotificationPreferences = useCallback((partial: Partial<NotificationPreferences>) => {
    setNotificationPreferences((prev) => ({ ...prev, ...partial }))
  }, [])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const dismissNotification = useCallback((id: string) => {
    const nowIso = new Date().toISOString()
    const reminderId = id.split(":").at(-1)
    const item = notifications.find((n) => n.id === id)
    if (item && reminderId) {
      if (item.sourceType === "task") {
        setTasks((prev) =>
          prev.map((task) => {
            if (task.id !== item.sourceId || !task.reminders?.length) return task
            return {
              ...task,
              reminders: task.reminders.map((r) =>
                r.id === reminderId ? { ...r, dismissedAt: nowIso } : r
              ),
            }
          })
        )
      } else {
        setCalendarEvents((prev) =>
          prev.map((event) => {
            if (event.id !== item.sourceId || !event.reminders?.length) return event
            return {
              ...event,
              reminders: event.reminders.map((r) =>
                r.id === reminderId ? { ...r, dismissedAt: nowIso } : r
              ),
            }
          })
        )
      }
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [notifications])

  const snoozeNotification = useCallback(
    (id: string, minutes?: number) => {
      const item = notifications.find((n) => n.id === id)
      if (!item) return
      const snoozeMins = minutes ?? notificationPreferences.defaultSnoozeMinutes
      if (item.sourceType === "task") {
        setTasks((prev) =>
          prev.map((task) => {
            if (task.id !== item.sourceId || !task.reminders?.length) return task
            return {
              ...task,
              reminders: task.reminders.map((r) =>
                id.endsWith(`:${r.id}`) ? withReminderSnoozedUntil(r, snoozeMins) : r
              ),
            }
          })
        )
      } else {
        setCalendarEvents((prev) =>
          prev.map((event) => {
            if (event.id !== item.sourceId || !event.reminders?.length) return event
            return {
              ...event,
              reminders: event.reminders.map((r) =>
                id.endsWith(`:${r.id}`) ? withReminderSnoozedUntil(r, snoozeMins) : r
              ),
            }
          })
        )
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    },
    [notifications, notificationPreferences.defaultSnoozeMinutes]
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!notificationPreferences.inAppEnabled && !notificationPreferences.pushEnabled) return
      setNotifications((prev) => {
        const due = collectDueNotifications(
          tasks,
          calendarEvents,
          prev,
          notificationPreferences
        )
        if (!due.length) return prev
        return [...due, ...prev].slice(0, 120)
      })
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [tasks, calendarEvents, notificationPreferences])

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
      notificationPreferences,
      updateNotificationPreferences,
      notifications,
      markNotificationRead,
      clearNotifications,
      dismissNotification,
      snoozeNotification,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      pinTaskToLineup,
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
      updateCalendarEvent,
      deleteCalendarEvent,
      appendSavedChatTurn,
      clearSavedChatTurns,
      projectNameById,
      addDocument,
      deleteDocument,
      workspaceRemoteLoading,
      repairWorkspaceFromRefs,
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
      notificationPreferences,
      notifications,
      updateNotificationPreferences,
      markNotificationRead,
      clearNotifications,
      dismissNotification,
      snoozeNotification,
      workspaceRemoteLoading,
      repairWorkspaceFromRefs,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      updateTask,
      pinTaskToLineup,
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
      updateCalendarEvent,
      deleteCalendarEvent,
      appendSavedChatTurn,
      clearSavedChatTurns,
      projectNameById,
      addDocument,
      deleteDocument,
    ]
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      {workspaceRemoteLoading ? (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm">
          <p className="text-muted-foreground text-sm">Loading workspace from server…</p>
        </div>
      ) : null}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return ctx
}
