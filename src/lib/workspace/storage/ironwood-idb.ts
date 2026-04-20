/**
 * IndexedDB backing for workspace snapshot, remote sync outbox, assistant cache,
 * and document-analysis upload queue. Single DB version with additive stores.
 */

import type { WorkspaceSnapshotV1 } from "@/lib/workspace/persist"
import type { SavedThread } from "@/lib/crm-assistant-storage"

export const IRONWOOD_DB_NAME = "ironwood-planner"
export const IRONWOOD_DB_VERSION = 3

const STORE_WORKSPACE = "workspace"
const STORE_OUTBOX = "outbox"
const STORE_ASSISTANT = "assistant"
const STORE_UPLOAD_QUEUE = "uploadQueue"

let dbPromise: Promise<IDBDatabase> | null = null

function openIronwoodDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB unavailable"))
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IRONWOOD_DB_NAME, IRONWOOD_DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result
      const oldV = ev.oldVersion
      if (!db.objectStoreNames.contains(STORE_WORKSPACE)) {
        db.createObjectStore(STORE_WORKSPACE)
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX)
      }
      if (!db.objectStoreNames.contains(STORE_ASSISTANT)) {
        db.createObjectStore(STORE_ASSISTANT)
      }
      if (oldV < 3 && db.objectStoreNames.contains(STORE_UPLOAD_QUEUE)) {
        db.deleteObjectStore(STORE_UPLOAD_QUEUE)
      }
      if (!db.objectStoreNames.contains(STORE_UPLOAD_QUEUE)) {
        db.createObjectStore(STORE_UPLOAD_QUEUE, { keyPath: "id" })
      }
    }
  })
}

export function getIronwoodDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openIronwoodDb()
  return dbPromise
}

/** Reset promise (tests). */
export function resetIronwoodDbForTests() {
  dbPromise = null
}

const SNAPSHOT_KEY = "current"

export async function idbGetWorkspaceSnapshot(): Promise<WorkspaceSnapshotV1 | null> {
  try {
    const db = await getIronwoodDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACE, "readonly")
      const req = tx.objectStore(STORE_WORKSPACE).get(SNAPSHOT_KEY)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const v = req.result as WorkspaceSnapshotV1 | undefined
        resolve(v ?? null)
      }
    })
  } catch {
    return null
  }
}

export async function idbSetWorkspaceSnapshot(snapshot: WorkspaceSnapshotV1): Promise<void> {
  const db = await getIronwoodDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_WORKSPACE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE_WORKSPACE).put(snapshot, SNAPSHOT_KEY)
  })
}

export type WorkspacePutOutboxPayload = {
  snapshot: WorkspaceSnapshotV1
  expectedPersistedAt: number | null
  enqueuedAt: number
  attemptCount: number
}

const OUTBOX_PUT_KEY = "workspacePut"

export async function idbGetWorkspacePutOutbox(): Promise<WorkspacePutOutboxPayload | null> {
  try {
    const db = await getIronwoodDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, "readonly")
      const req = tx.objectStore(STORE_OUTBOX).get(OUTBOX_PUT_KEY)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve((req.result as WorkspacePutOutboxPayload) ?? null)
    })
  } catch {
    return null
  }
}

export async function idbSetWorkspacePutOutbox(payload: WorkspacePutOutboxPayload | null): Promise<void> {
  const db = await getIronwoodDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    const store = tx.objectStore(STORE_OUTBOX)
    if (payload === null) store.delete(OUTBOX_PUT_KEY)
    else store.put(payload, OUTBOX_PUT_KEY)
  })
}

/** Pending document analysis: FormData-equivalent stored offline. */
export type PendingDocumentAnalysisJob = {
  id: string
  fileName: string
  fileType: string
  /** Base64 or array buffer stored as base64 for simplicity */
  fileBase64: string
  instructions: string
  model: string
  enqueuedAt: number
}

export async function idbEnqueueDocumentAnalysis(job: PendingDocumentAnalysisJob): Promise<void> {
  const db = await getIronwoodDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_UPLOAD_QUEUE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE_UPLOAD_QUEUE).put(job)
  })
}

export async function idbGetAllDocumentAnalysisJobs(): Promise<PendingDocumentAnalysisJob[]> {
  const db = await getIronwoodDb()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_UPLOAD_QUEUE, "readonly")
    const req = tx.objectStore(STORE_UPLOAD_QUEUE).getAll()
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve((req.result as PendingDocumentAnalysisJob[]) ?? [])
  })
}

export async function idbDeleteDocumentAnalysisJob(id: string): Promise<void> {
  const db = await getIronwoodDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_UPLOAD_QUEUE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE_UPLOAD_QUEUE).delete(id)
  })
}

/** Assistant: current thread JSON + saved list + active remote id */
const K_THREAD_EXPORT = "currentThreadExport"
const K_SAVED_THREADS = "savedThreads"
const K_ACTIVE_REMOTE = "activeRemoteThreadId"

export async function idbGetAssistantThreadExport(): Promise<string | null> {
  try {
    const db = await getIronwoodDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSISTANT, "readonly")
      const req = tx.objectStore(STORE_ASSISTANT).get(K_THREAD_EXPORT)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null)
    })
  } catch {
    return null
  }
}

export async function idbSetAssistantThreadExport(json: string | null): Promise<void> {
  const db = await getIronwoodDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSISTANT, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    const store = tx.objectStore(STORE_ASSISTANT)
    if (json === null) store.delete(K_THREAD_EXPORT)
    else store.put(json, K_THREAD_EXPORT)
  })
}

export async function idbGetAssistantSavedThreads(): Promise<SavedThread[] | null> {
  try {
    const db = await getIronwoodDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSISTANT, "readonly")
      const req = tx.objectStore(STORE_ASSISTANT).get(K_SAVED_THREADS)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const v = req.result
        resolve(Array.isArray(v) ? (v as SavedThread[]) : null)
      }
    })
  } catch {
    return null
  }
}

export async function idbSetAssistantSavedThreads(threads: SavedThread[]): Promise<void> {
  const db = await getIronwoodDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSISTANT, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE_ASSISTANT).put(threads, K_SAVED_THREADS)
  })
}

export async function idbGetAssistantActiveRemoteId(): Promise<string | null> {
  try {
    const db = await getIronwoodDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSISTANT, "readonly")
      const req = tx.objectStore(STORE_ASSISTANT).get(K_ACTIVE_REMOTE)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const v = req.result
        resolve(typeof v === "string" ? v : null)
      }
    })
  } catch {
    return null
  }
}

export async function idbSetAssistantActiveRemoteId(id: string | null): Promise<void> {
  const db = await getIronwoodDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSISTANT, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    const store = tx.objectStore(STORE_ASSISTANT)
    if (id === null) store.delete(K_ACTIVE_REMOTE)
    else store.put(id, K_ACTIVE_REMOTE)
  })
}

export type AssistantRemoteOutboxItem =
  | { kind: "patch"; remoteId: string; body: Record<string, unknown>; id: string }
  | { kind: "post"; path: string; body?: Record<string, unknown>; id: string }

const K_ASSISTANT_REMOTE_QUEUE = "remoteOpQueue"

export type AssistantRemoteOutboxRow = AssistantRemoteOutboxItem & { enqueuedAt: number }

export async function idbGetAssistantRemoteOps(): Promise<AssistantRemoteOutboxRow[]> {
  try {
    const db = await getIronwoodDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSISTANT, "readonly")
      const req = tx.objectStore(STORE_ASSISTANT).get(K_ASSISTANT_REMOTE_QUEUE)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const v = req.result
        resolve(Array.isArray(v) ? (v as AssistantRemoteOutboxRow[]) : [])
      }
    })
  } catch {
    return []
  }
}

export async function idbSetAssistantRemoteOps(rows: AssistantRemoteOutboxRow[]): Promise<void> {
  const db = await getIronwoodDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSISTANT, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE_ASSISTANT).put(rows, K_ASSISTANT_REMOTE_QUEUE)
  })
}

export async function idbEnqueueAssistantRemoteOp(op: AssistantRemoteOutboxItem): Promise<void> {
  const prev = await idbGetAssistantRemoteOps()
  const row: AssistantRemoteOutboxRow = { ...op, enqueuedAt: Date.now() }
  await idbSetAssistantRemoteOps([...prev, row])
}
