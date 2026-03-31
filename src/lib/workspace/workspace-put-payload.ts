import { normalizeWorkspaceSnapshot, type WorkspaceSnapshotV1 } from "@/lib/workspace/persist"

/** Client sends this shape for optimistic locking. Legacy clients send a bare snapshot. */
export type WorkspacePutBodyV1 = {
  expectedPersistedAt: number | null
  snapshot: WorkspaceSnapshotV1
}

export class WorkspaceVersionConflictError extends Error {
  constructor(
    message: string,
    readonly serverPersistedAt: number | null
  ) {
    super(message)
    this.name = "WorkspaceVersionConflictError"
  }
}

/**
 * Compare client's `expectedPersistedAt` to the server doc/file version.
 * `serverVersion` null = no stored workspace yet.
 * Legacy clients omit `expected`; CAS is skipped.
 */
export function assertWorkspacePutCas(
  expectedPersistedAt: number | null | undefined,
  serverVersion: number | null
): void {
  if (expectedPersistedAt === undefined) return
  if (serverVersion === null) {
    if (expectedPersistedAt !== null) {
      throw new WorkspaceVersionConflictError(
        "Workspace changed on the server. Reload to get the latest data.",
        null
      )
    }
  } else if (expectedPersistedAt !== serverVersion) {
    throw new WorkspaceVersionConflictError(
      "Workspace was updated elsewhere.",
      serverVersion
    )
  }
}

/** Firestore/file document data → CAS version (0 if legacy doc had no persistedAt). */
export function persistedAtFromStoredRaw(raw: unknown): number | null {
  if (raw == null || typeof raw !== "object") return null
  const p = normalizeWorkspaceSnapshot(raw)
  if (!p) return null
  if (typeof p.persistedAt === "number" && Number.isFinite(p.persistedAt)) return p.persistedAt
  return 0
}

export function parseWorkspacePutPayload(body: unknown): {
  snapshot: WorkspaceSnapshotV1
  /** `undefined` = legacy body (skip compare-and-swap). `null` = client believes server has no doc yet. */
  expectedPersistedAt: number | null | undefined
} | null {
  if (!body || typeof body !== "object") return null
  const o = body as Record<string, unknown>
  if ("snapshot" in o && o.snapshot && typeof o.snapshot === "object") {
    const snapshot = normalizeWorkspaceSnapshot(o.snapshot)
    if (!snapshot) return null
    if (!("expectedPersistedAt" in o)) {
      return { snapshot, expectedPersistedAt: undefined }
    }
    const exp = o.expectedPersistedAt
    if (exp === null) {
      return { snapshot, expectedPersistedAt: null }
    }
    if (typeof exp === "number" && Number.isFinite(exp)) {
      return { snapshot, expectedPersistedAt: exp }
    }
    return null
  }
  const snapshot = normalizeWorkspaceSnapshot(body)
  if (!snapshot) return null
  return { snapshot, expectedPersistedAt: undefined }
}
