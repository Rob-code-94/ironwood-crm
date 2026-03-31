import { getFirebaseAdminFirestore } from "@/lib/firebase-admin"

type ThreadStatus = "regular" | "archived"

export type AssistantThread = {
  remoteId: string
  title?: string
  status: ThreadStatus
  updatedAt: number
  createdAt: number
}

type GlobalState = {
  threads: Map<string, AssistantThread>
}

const THREADS_COLLECTION = "assistantThreads"

function getState(): GlobalState {
  const g = globalThis as unknown as { __iwcAssistantThreads?: GlobalState }
  if (!g.__iwcAssistantThreads) {
    g.__iwcAssistantThreads = { threads: new Map() }
  }
  return g.__iwcAssistantThreads
}

export function listThreads() {
  return Array.from(getState().threads.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createThread() {
  const now = Date.now()
  const thread: AssistantThread = {
    remoteId: crypto.randomUUID(),
    status: "regular",
    createdAt: now,
    updatedAt: now,
  }
  getState().threads.set(thread.remoteId, thread)
  return thread
}

export function getThread(remoteId: string) {
  return getState().threads.get(remoteId)
}

export function updateThread(
  remoteId: string,
  partial: Partial<Pick<AssistantThread, "title" | "status">>
) {
  const current = getThread(remoteId)
  if (!current) return false
  const next: AssistantThread = {
    ...current,
    ...partial,
    updatedAt: Date.now(),
  }
  getState().threads.set(remoteId, next)
  return true
}

export function deleteThread(remoteId: string) {
  getState().threads.delete(remoteId)
}

function asThreadStatus(value: unknown): ThreadStatus {
  return value === "archived" ? "archived" : "regular"
}

function asAssistantThread(remoteId: string, raw: Record<string, unknown>): AssistantThread {
  const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : Date.now()
  const updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : createdAt
  const title = typeof raw.title === "string" ? raw.title : undefined

  return {
    remoteId,
    title,
    status: asThreadStatus(raw.status),
    createdAt,
    updatedAt,
  }
}

async function listThreadsFirestore() {
  const db = getFirebaseAdminFirestore()
  if (!db) return null

  try {
    const snapshot = await db
      .collection(THREADS_COLLECTION)
      .orderBy("updatedAt", "desc")
      .get()
    return snapshot.docs.map((doc) =>
      asAssistantThread(doc.id, doc.data() as Record<string, unknown>)
    )
  } catch {
    return null
  }
}

async function createThreadFirestore() {
  const db = getFirebaseAdminFirestore()
  if (!db) return null

  const now = Date.now()
  const remoteId = crypto.randomUUID()
  const thread: AssistantThread = {
    remoteId,
    status: "regular",
    createdAt: now,
    updatedAt: now,
  }

  try {
    await db.collection(THREADS_COLLECTION).doc(remoteId).set(thread)
    return thread
  } catch {
    return null
  }
}

async function getThreadFirestore(remoteId: string) {
  const db = getFirebaseAdminFirestore()
  if (!db) return null

  try {
    const doc = await db.collection(THREADS_COLLECTION).doc(remoteId).get()
    if (!doc.exists) return undefined
    return asAssistantThread(remoteId, (doc.data() ?? {}) as Record<string, unknown>)
  } catch {
    return null
  }
}

async function updateThreadFirestore(
  remoteId: string,
  partial: Partial<Pick<AssistantThread, "title" | "status">>
) {
  const db = getFirebaseAdminFirestore()
  if (!db) return null

  try {
    const ref = db.collection(THREADS_COLLECTION).doc(remoteId)
    const current = await ref.get()
    if (!current.exists) return false

    await ref.update({
      ...(partial.title !== undefined ? { title: partial.title } : {}),
      ...(partial.status !== undefined ? { status: partial.status } : {}),
      updatedAt: Date.now(),
    })
    return true
  } catch {
    return null
  }
}

async function deleteThreadFirestore(remoteId: string) {
  const db = getFirebaseAdminFirestore()
  if (!db) return null

  try {
    await db.collection(THREADS_COLLECTION).doc(remoteId).delete()
    return true
  } catch {
    return null
  }
}

export async function listThreadsPersistent() {
  const firestoreThreads = await listThreadsFirestore()
  return firestoreThreads ?? listThreads()
}

export async function createThreadPersistent() {
  const firestoreThread = await createThreadFirestore()
  return firestoreThread ?? createThread()
}

export async function getThreadPersistent(remoteId: string) {
  const firestoreThread = await getThreadFirestore(remoteId)
  return firestoreThread ?? getThread(remoteId)
}

export async function updateThreadPersistent(
  remoteId: string,
  partial: Partial<Pick<AssistantThread, "title" | "status">>
) {
  const firestoreResult = await updateThreadFirestore(remoteId, partial)
  return firestoreResult ?? updateThread(remoteId, partial)
}

export async function deleteThreadPersistent(remoteId: string) {
  const firestoreResult = await deleteThreadFirestore(remoteId)
  if (firestoreResult !== null) return
  deleteThread(remoteId)
}
