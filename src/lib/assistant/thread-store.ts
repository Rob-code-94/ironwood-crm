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
