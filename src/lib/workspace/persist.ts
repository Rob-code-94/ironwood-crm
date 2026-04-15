import type {
  CalendarEvent,
  Company,
  Contact,
  Deal,
  Document,
  NotificationPreferences,
  PlannerNotification,
  Project,
  SavedChatTurn,
  Task,
} from "@/lib/types"

export const WORKSPACE_STORAGE_KEY = "ironwood_workspace_v1"

export type WorkspaceSnapshotV1 = {
  version: 1
  projects: Project[]
  tasks: Task[]
  contacts: Contact[]
  companies: Company[]
  deals: Deal[]
  selectedProjectFilterId: string
  savedChatTurns: SavedChatTurn[]
  documents?: Document[]
  /** User-created calendar rows (task due dates still come from `tasks`). */
  calendarEvents?: CalendarEvent[]
  /**
   * When set (0–365), new task dialog pre-fills due date as today + N days.
   * `null` / omitted = no default.
   */
  taskDefaultDueOffsetDays?: number | null
  notificationPreferences?: NotificationPreferences
  notifications?: PlannerNotification[]
  /** Unix ms - used to pick newer data when syncing to a shared file across worktrees */
  persistedAt?: number
}

/** Client-only: enable loading/saving workspace via /api/workspace/snapshot and IRONWOOD_WORKSPACE_FILE. */
export function isWorkspaceFileSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_IRONWOOD_WORKSPACE_SYNC !== "0"
}

/** Valid empty snapshot for first-time Firestore reads (no doc yet). */
export function emptyWorkspaceSnapshot(): WorkspaceSnapshotV1 {
  return {
    version: 1,
    projects: [],
    tasks: [],
    contacts: [],
    companies: [],
    deals: [],
    selectedProjectFilterId: "all",
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
    // No timestamp — merge logic treats this as bootstrap empty (won't beat real local data).
    persistedAt: undefined,
  }
}

export function normalizeWorkspaceSnapshot(data: unknown): WorkspaceSnapshotV1 | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (d.version !== 1 || !Array.isArray(d.projects)) return null
  if (!Array.isArray(d.tasks)) return null
  if (!Array.isArray(d.contacts)) return null
  if (!Array.isArray(d.companies)) return null
  if (!Array.isArray(d.deals)) return null
  if (typeof d.selectedProjectFilterId !== "string") return null
  const savedChatTurns = Array.isArray(d.savedChatTurns) ? d.savedChatTurns : []
  const documents = Array.isArray(d.documents) ? d.documents : []
  const calendarEvents = Array.isArray(d.calendarEvents) ? (d.calendarEvents as CalendarEvent[]) : []
  let taskDefaultDueOffsetDays: number | null = null
  if (typeof d.taskDefaultDueOffsetDays === "number" && Number.isFinite(d.taskDefaultDueOffsetDays)) {
    const n = Math.floor(d.taskDefaultDueOffsetDays)
    if (n >= 0 && n <= 365) taskDefaultDueOffsetDays = n
  } else if (d.taskDefaultDueOffsetDays === null) {
    taskDefaultDueOffsetDays = null
  }
  const prefsRaw =
    d.notificationPreferences && typeof d.notificationPreferences === "object"
      ? (d.notificationPreferences as Record<string, unknown>)
      : {}
  const defaultReminderMinutesBefore = Number(prefsRaw.defaultReminderMinutesBefore)
  const defaultSnoozeMinutes = Number(prefsRaw.defaultSnoozeMinutes)
  const notificationPreferences: NotificationPreferences = {
    inAppEnabled: prefsRaw.inAppEnabled !== false,
    pushEnabled: prefsRaw.pushEnabled === true,
    defaultReminderMinutesBefore:
      Number.isFinite(defaultReminderMinutesBefore) && defaultReminderMinutesBefore >= 0
        ? Math.floor(defaultReminderMinutesBefore)
        : 60,
    defaultSnoozeMinutes:
      Number.isFinite(defaultSnoozeMinutes) && defaultSnoozeMinutes > 0
        ? Math.floor(defaultSnoozeMinutes)
        : 10,
  }
  const notifications = Array.isArray(d.notifications) ? (d.notifications as PlannerNotification[]) : []

  const persistedAt =
    typeof d.persistedAt === "number" && Number.isFinite(d.persistedAt)
      ? d.persistedAt
      : undefined
  return {
    version: 1,
    projects: d.projects as Project[],
    tasks: d.tasks as Task[],
    contacts: d.contacts as Contact[],
    companies: d.companies as Company[],
    deals: d.deals as Deal[],
    selectedProjectFilterId: d.selectedProjectFilterId,
    savedChatTurns: savedChatTurns as SavedChatTurn[],
    documents: documents as Document[],
    calendarEvents,
    taskDefaultDueOffsetDays,
    notificationPreferences,
    notifications,
    persistedAt,
  }
}

export function loadWorkspaceSnapshot(): WorkspaceSnapshotV1 | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) return null
    return normalizeWorkspaceSnapshot(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function saveWorkspaceSnapshot(snapshot: WorkspaceSnapshotV1) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* quota / private mode */
  }
}
