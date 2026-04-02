import type { Task } from "@/lib/types"

export function sortTasksInSection(a: Task, b: Task) {
  const oa = a.sortOrder ?? 9999
  const ob = b.sortOrder ?? 9999
  if (oa !== ob) return oa - ob
  return a.title.localeCompare(b.title)
}

/** Tasks grouped by section name, sorted for playbook / PDF export */
export function groupProjectTasksIntoSections(
  tasks: Task[],
  projectId: string
): [string, Task[]][] {
  const list = tasks.filter((t) => t.projectId === projectId)
  const map = new Map<string, Task[]>()
  for (const t of list) {
    const sec = t.section?.trim() || "General"
    if (!map.has(sec)) map.set(sec, [])
    map.get(sec)!.push(t)
  }
  for (const arr of map.values()) {
    arr.sort(sortTasksInSection)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}
