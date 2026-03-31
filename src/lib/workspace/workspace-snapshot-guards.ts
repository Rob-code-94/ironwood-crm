import type { WorkspaceSnapshotV1 } from "@/lib/workspace/persist"

export class WorkspaceDestructiveOverwriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WorkspaceDestructiveOverwriteError"
  }
}

function entityTotal(s: WorkspaceSnapshotV1): number {
  return (
    s.projects.length +
    s.tasks.length +
    s.contacts.length +
    s.companies.length +
    s.deals.length
  )
}

/**
 * Blocks accidental wipes (empty client, bad hydration) from overwriting real server/workspace data.
 * Override with request header `X-Ironwood-Workspace-Force-Downgrade: 1` when intentionally resetting.
 */
export function assertNotDestructiveWorkspaceOverwrite(
  existing: WorkspaceSnapshotV1 | null,
  incoming: WorkspaceSnapshotV1,
  force: boolean
): void {
  if (force) return
  if (!existing) return

  const exTotal = entityTotal(existing)
  const incTotal = entityTotal(incoming)
  if (exTotal === 0) return

  if (incTotal === 0) {
    throw new WorkspaceDestructiveOverwriteError(
      "Refusing to save an empty workspace over one that has data. Use header X-Ironwood-Workspace-Force-Downgrade: 1 only if you intend to wipe everything."
    )
  }

  if (existing.projects.length > 0 && incoming.projects.length === 0) {
    throw new WorkspaceDestructiveOverwriteError(
      "Refusing to remove all projects while the saved workspace still has projects. Use X-Ironwood-Workspace-Force-Downgrade: 1 to override."
    )
  }

  if (exTotal >= 8 && incTotal < Math.max(1, Math.floor(exTotal * 0.25))) {
    throw new WorkspaceDestructiveOverwriteError(
      "Refusing to save a snapshot that removes most of your data at once. Use X-Ironwood-Workspace-Force-Downgrade: 1 if this deletion is intentional."
    )
  }
}

/** Same rules on the client — skip PUT to avoid a round trip when we know we'd be wiping local+server by mistake. */
export function wouldDestructiveOverwriteReject(
  existing: WorkspaceSnapshotV1,
  incoming: WorkspaceSnapshotV1
): boolean {
  try {
    assertNotDestructiveWorkspaceOverwrite(existing, incoming, false)
    return false
  } catch {
    return true
  }
}
