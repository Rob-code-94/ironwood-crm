import type { SavedThread } from "@/lib/crm-assistant-storage"
import {
  CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY,
  CRM_ASSISTANT_THREAD_STORAGE_KEY,
  SAVED_THREADS_KEY,
} from "@/lib/crm-assistant-storage"
import {
  getIronwoodDb,
  idbGetAssistantActiveRemoteId,
  idbGetAssistantSavedThreads,
  idbGetAssistantThreadExport,
  idbSetAssistantActiveRemoteId,
  idbSetAssistantSavedThreads,
  idbSetAssistantThreadExport,
} from "@/lib/workspace/storage/ironwood-idb"

let initPromise: Promise<void> | null = null

/** Migrate legacy localStorage assistant keys into IndexedDB (once). */
export function initCrmAssistantIdb(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!initPromise) {
    initPromise = (async () => {
      await getIronwoodDb()
      const threadEx = await idbGetAssistantThreadExport()
      const savedArr = await idbGetAssistantSavedThreads()
      if (threadEx !== null || savedArr !== null) {
        cleanupLegacyAssistantLocalStorage()
        return
      }
      const lsThread = localStorage.getItem(CRM_ASSISTANT_THREAD_STORAGE_KEY)
      const legacySavedRaw = localStorage.getItem(SAVED_THREADS_KEY)
      const lsActive = localStorage.getItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY)
      if (!lsThread && !legacySavedRaw && !lsActive) return

      if (lsThread) {
        await idbSetAssistantThreadExport(lsThread)
      }
      if (legacySavedRaw) {
        try {
          const parsed = JSON.parse(legacySavedRaw) as unknown
          if (Array.isArray(parsed)) {
            await idbSetAssistantSavedThreads(parsed as SavedThread[])
          }
        } catch {
          /* ignore */
        }
      }
      if (lsActive) {
        await idbSetAssistantActiveRemoteId(lsActive)
      }
      cleanupLegacyAssistantLocalStorage()
    })()
  }
  return initPromise
}

function cleanupLegacyAssistantLocalStorage() {
  try {
    localStorage.removeItem(CRM_ASSISTANT_THREAD_STORAGE_KEY)
    localStorage.removeItem(SAVED_THREADS_KEY)
    localStorage.removeItem(CRM_ASSISTANT_ACTIVE_REMOTE_THREAD_KEY)
  } catch {
    /* ignore */
  }
}

export async function getAssistantThreadExportAsync(): Promise<string | null> {
  await initCrmAssistantIdb()
  return idbGetAssistantThreadExport()
}

export async function setAssistantThreadExportAsync(json: string | null): Promise<void> {
  await initCrmAssistantIdb()
  await idbSetAssistantThreadExport(json)
}

export async function getSavedThreadsAsync(): Promise<SavedThread[]> {
  await initCrmAssistantIdb()
  const s = await idbGetAssistantSavedThreads()
  return s ?? []
}

export async function setSavedThreadsAsync(threads: SavedThread[]): Promise<void> {
  await initCrmAssistantIdb()
  await idbSetAssistantSavedThreads(threads)
}

export async function getActiveRemoteThreadIdAsync(): Promise<string | null> {
  await initCrmAssistantIdb()
  return idbGetAssistantActiveRemoteId()
}

export async function setActiveRemoteThreadIdAsync(id: string | null): Promise<void> {
  await initCrmAssistantIdb()
  await idbSetAssistantActiveRemoteId(id)
}

const MAX_SAVED_THREADS = 20

export async function clearAssistantThreadStorageAsync(): Promise<void> {
  await setAssistantThreadExportAsync(null)
}

export async function addSavedThreadAsync(thread: SavedThread): Promise<void> {
  await initCrmAssistantIdb()
  const existing = (await getSavedThreadsAsync()).filter((t) => t.id !== thread.id)
  const updated = [{ ...thread, status: thread.status ?? "active" }, ...existing].slice(
    0,
    MAX_SAVED_THREADS
  )
  await setSavedThreadsAsync(updated)
}

export async function updateSavedThreadAsync(
  id: string,
  patch: Partial<Pick<SavedThread, "title" | "status">>
): Promise<void> {
  await initCrmAssistantIdb()
  const updated = (await getSavedThreadsAsync()).map((thread) =>
    thread.id === id ? { ...thread, ...patch } : thread
  )
  await setSavedThreadsAsync(updated)
}

export async function deleteSavedThreadAsync(id: string): Promise<void> {
  await initCrmAssistantIdb()
  const updated = (await getSavedThreadsAsync()).filter((t) => t.id !== id)
  await setSavedThreadsAsync(updated)
}
