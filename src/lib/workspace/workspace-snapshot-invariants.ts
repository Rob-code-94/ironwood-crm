import type { WorkspaceSnapshotV1 } from "@/lib/workspace/persist"

/** Task/project IDs referenced by tasks but missing from `projects`. */
export function orphanTaskProjectIds(snapshot: WorkspaceSnapshotV1): string[] {
  const ids = new Set(snapshot.projects.map((p) => p.id))
  const missing = new Set<string>()
  for (const t of snapshot.tasks) {
    const pid = t.projectId?.trim()
    if (pid && !ids.has(pid)) missing.add(pid)
  }
  return [...missing]
}

export function workspaceSnapshotHasOrphanTasks(snapshot: WorkspaceSnapshotV1): boolean {
  return orphanTaskProjectIds(snapshot).length > 0
}
