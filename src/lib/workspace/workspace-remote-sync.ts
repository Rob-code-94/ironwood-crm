import {
  idbGetWorkspacePutOutbox,
  idbSetWorkspacePutOutbox,
  type WorkspacePutOutboxPayload,
} from "@/lib/workspace/storage/ironwood-idb"
import { normalizeWorkspaceSnapshot, type WorkspaceSnapshotV1 } from "@/lib/workspace/persist"

export type WorkspaceRemoteSyncState = "idle" | "syncing" | "pending" | "error"

export async function enqueueWorkspacePutOutbox(
  snapshot: WorkspaceSnapshotV1,
  expectedPersistedAt: number | null
): Promise<void> {
  await idbSetWorkspacePutOutbox({
    snapshot,
    expectedPersistedAt,
    enqueuedAt: Date.now(),
    attemptCount: 0,
  })
}

export async function clearWorkspacePutOutbox(): Promise<void> {
  await idbSetWorkspacePutOutbox(null)
}

export type FlushWorkspacePutResult =
  | { ok: true; snapshot?: WorkspaceSnapshotV1 }
  | { ok: false; kind: "conflict" }
  | { ok: false; kind: "destructive" | "validation"; message?: string }
  | { ok: false; kind: "network" }
  /** Server refused sync (usually missing Firebase Admin / Firestore in production). */
  | { ok: false; kind: "sync_disabled"; message?: string }

/**
 * Sends the pending outbox PUT, or nothing if queue empty.
 * Caller handles conflict/destructive by re-fetching remote snapshot.
 */
export async function flushWorkspacePutOutbox(
  applyRemoteSnapshot: (remote: WorkspaceSnapshotV1) => void
): Promise<FlushWorkspacePutResult> {
  const pending = await idbGetWorkspacePutOutbox()
  if (!pending) {
    return { ok: true }
  }

  const body = {
    expectedPersistedAt: pending.expectedPersistedAt,
    snapshot: pending.snapshot,
  }

  try {
    const res = await fetch("/api/workspace/snapshot", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      await clearWorkspacePutOutbox()
      return { ok: true, snapshot: pending.snapshot }
    }

    if (res.status === 409) {
      const g = await fetch("/api/workspace/snapshot")
      if (g.ok) {
        try {
          const raw = (await g.json()) as unknown
          const latest = normalizeWorkspaceSnapshot(raw)
          if (latest) applyRemoteSnapshot(latest)
        } catch {
          /* ignore */
        }
      }
      await clearWorkspacePutOutbox()
      return { ok: false, kind: "conflict" }
    }

    if (res.status === 422) {
      let message: string | undefined
      try {
        const j = (await res.json()) as { error?: string }
        message = j.error
      } catch {
        /* ignore */
      }
      const g = await fetch("/api/workspace/snapshot")
      if (g.ok) {
        try {
          const raw = (await g.json()) as unknown
          const latest = normalizeWorkspaceSnapshot(raw)
          if (latest) applyRemoteSnapshot(latest)
        } catch {
          /* ignore */
        }
      }
      await clearWorkspacePutOutbox()
      return { ok: false, kind: "destructive", message }
    }

    if (res.status === 503) {
      let message: string | undefined
      try {
        const j = (await res.json()) as { error?: string }
        message = j.error
      } catch {
        /* ignore */
      }
      return { ok: false, kind: "sync_disabled", message }
    }

    return { ok: false, kind: "network" }
  } catch {
    return { ok: false, kind: "network" }
  }
}

export async function readWorkspacePutOutbox(): Promise<WorkspacePutOutboxPayload | null> {
  return idbGetWorkspacePutOutbox()
}
