"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkspace } from "@/lib/workspace/context"

type LineupMode = "tasks" | "projects"
const PINNED_PROJECTS_KEY = "ironwood_project_lineup_pinned_v1"

function formatShortDate(input?: string) {
  if (!input) return "no due"
  const parts = input.split("-").map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return input
  const [year, month, day] = parts
  const yy = String(year % 100).padStart(2, "0")
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${yy}`
}

export function TaskLineupBar() {
  const router = useRouter()
  const { tasks, projects, updateTask } = useWorkspace()
  const [mode, setMode] = useState<LineupMode>("tasks")
  const [pinnedProjectIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const raw = localStorage.getItem(PINNED_PROJECTS_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []
    } catch {
      return []
    }
  })

  const availableTasks = useMemo(
    () =>
      [...tasks].sort((a, b) =>
        (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99")
      ),
    [tasks]
  )
  const availableProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99")
      ),
    [projects]
  )
  const taskLineup = useMemo(() => {
    return availableTasks.filter((task) => task.pinnedToLineup).slice(0, 12)
  }, [availableTasks])
  const projectLineup = useMemo(() => {
    const set = new Set(pinnedProjectIds)
    return availableProjects.filter((project) => set.has(project.id)).slice(0, 12)
  }, [availableProjects, pinnedProjectIds])

  return (
    <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "tasks" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setMode("tasks")}
          >
            Tasks
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "projects" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setMode("projects")}
          >
            Projects
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() =>
              router.push(
                mode === "tasks" ? "/tasks?scope=all" : "/projects"
              )
            }
          >
            Open full {mode}
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {(mode === "tasks" ? taskLineup : projectLineup).length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {mode === "tasks"
              ? "No pinned tasks yet. Use “Pin to taskbar” on a task notification."
              : "No pinned projects yet."}
          </span>
        ) : mode === "tasks" ? (
          taskLineup.map((task) => (
            <Badge key={task.id} variant="secondary" className="shrink-0 gap-2 rounded-full px-3 py-1 text-xs">
              <button
                type="button"
                className="whitespace-nowrap hover:underline underline-offset-2"
                onClick={() => router.push(`/tasks?scope=all&taskId=${encodeURIComponent(task.id)}`)}
                title={`Open task: ${task.title}`}
              >
                {task.title}
              </button>
              <span className="text-muted-foreground whitespace-nowrap">{formatShortDate(task.dueDate)}</span>
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => updateTask(task.id, { pinnedToLineup: false })}
                aria-label={`Unpin task: ${task.title}`}
                title="Unpin"
              >
                ×
              </button>
            </Badge>
          ))
        ) : (
          projectLineup.map((project) => (
            <Badge key={project.id} variant="outline" className="shrink-0 gap-2 rounded-full px-3 py-1 text-xs">
              <span className="whitespace-nowrap">{project.name}</span>
              <span className="text-muted-foreground whitespace-nowrap">{formatShortDate(project.dueDate)}</span>
            </Badge>
          ))
        )}
      </div>
    </div>
  )
}
