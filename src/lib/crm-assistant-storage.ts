export const CRM_ASSISTANT_THREAD_STORAGE_KEY = "ironwood.crmAssistant.thread.v1"
/** Firestore-backed assistant: which thread document is active in this browser */
export const CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY = "ironwood.crmAssistant.activeRemoteThreadId.v1"
export const SAVED_THREADS_KEY = "ironwood.crmAssistant.savedThreads.v1"

const MAX_SAVED_THREADS = 20

export type SavedThread = {
  id: string
  title: string
  savedAt: string
  status?: "active" | "archived"
  /** ExportedMessageRepository — typed as unknown to avoid pulling in @assistant-ui/core here */
  data: unknown
}

export function clearCrmAssistantThreadStorage() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(CRM_ASSISTANT_THREAD_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function getSavedThreads(): SavedThread[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SAVED_THREADS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedThread[]) : []
  } catch {
    return []
  }
}

export function addSavedThread(thread: SavedThread): void {
  if (typeof window === "undefined") return
  try {
    const existing = getSavedThreads().filter((t) => t.id !== thread.id)
    const updated = [{ ...thread, status: thread.status ?? "active" }, ...existing].slice(
      0,
      MAX_SAVED_THREADS
    )
    localStorage.setItem(SAVED_THREADS_KEY, JSON.stringify(updated))
  } catch {
    /* quota / private mode */
  }
}

export function updateSavedThread(
  id: string,
  patch: Partial<Pick<SavedThread, "title" | "status">>
): void {
  if (typeof window === "undefined") return
  try {
    const updated = getSavedThreads().map((thread) =>
      thread.id === id ? { ...thread, ...patch } : thread
    )
    localStorage.setItem(SAVED_THREADS_KEY, JSON.stringify(updated))
  } catch {
    /* ignore */
  }
}

export function deleteSavedThread(id: string): void {
  if (typeof window === "undefined") return
  try {
    const updated = getSavedThreads().filter((t) => t.id !== id)
    localStorage.setItem(SAVED_THREADS_KEY, JSON.stringify(updated))
  } catch {
    /* ignore */
  }
}
