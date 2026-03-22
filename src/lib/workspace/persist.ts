import type {
  Company,
  Contact,
  Deal,
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
}

export function loadWorkspaceSnapshot(): WorkspaceSnapshotV1 | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as WorkspaceSnapshotV1
    if (data?.version !== 1 || !Array.isArray(data.projects)) return null
    if (!Array.isArray(data.savedChatTurns)) data.savedChatTurns = []
    return data
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
