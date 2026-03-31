import type { Document, Project, Task } from "@/lib/types"

/**
 * If `projects[]` was lost but tasks/documents still reference `projectId`,
 * append minimal Project rows so the UI and filters work again.
 */
export function repairMissingProjectsFromRefs(
  projects: Project[],
  tasks: Task[],
  documents: Document[] = []
): Project[] {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const additions: Project[] = []
  const iso = new Date().toISOString()
  const seenNew = new Set<string>()

  const consider = (projectId: string | undefined, projectName: string | undefined) => {
    const pid = projectId?.trim()
    if (!pid || byId.has(pid) || seenNew.has(pid)) return
    seenNew.add(pid)
    const p: Project = {
      id: pid,
      name: projectName?.trim() || "Recovered project",
      color: "#6366f1",
      createdAt: iso,
      updatedAt: iso,
      status: "active",
    }
    byId.set(pid, p)
    additions.push(p)
  }

  for (const t of tasks) consider(t.projectId, t.projectName)
  for (const d of documents) consider(d.projectId, d.projectName)

  if (additions.length === 0) return projects
  return [...projects, ...additions]
}
