"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkspace } from "@/lib/workspace/context"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DotsThreeVertical } from "@phosphor-icons/react/dist/ssr"

type LineupMode = "tasks" | "projects"
const PINNED_TASKS_KEY = "ironwood_task_lineup_pinned_v1"
const PINNED_PROJECTS_KEY = "ironwood_project_lineup_pinned_v1"
const TASK_PIN_EVENT = "ironwood-task-lineup-pin"

function readPinnedTaskIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(PINNED_TASKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

function formatShortDate(input?: string) {
  if (!input) return "no due"
  const parts = input.split("-").map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return input
  const [year, month, day] = parts
  const yy = String(year % 100).padStart(2, "0")
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${yy}`
}

export function TaskLineupBar() {
  const { tasks, projects } = useWorkspace()
  const [mode, setMode] = useState<LineupMode>("tasks")
  const [pinnedTaskIds, setPinnedTaskIds] = useState<string[]>(() => {
    return readPinnedTaskIds()
  })
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>(() => {
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

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_TASKS_KEY, JSON.stringify(pinnedTaskIds))
    } catch {
      /* ignore */
    }
  }, [pinnedTaskIds])

  useEffect(() => {
    const onPin = () => {
      setPinnedTaskIds(readPinnedTaskIds())
    }
    window.addEventListener(TASK_PIN_EVENT, onPin)
    return () => window.removeEventListener(TASK_PIN_EVENT, onPin)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify(pinnedProjectIds))
    } catch {
      /* ignore */
    }
  }, [pinnedProjectIds])

  const availableTasks = useMemo(
    () =>
      [...tasks]
        .filter((task) => task.status !== "done")
        .sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99")),
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
    const set = new Set(pinnedTaskIds)
    return availableTasks.filter((task) => set.has(task.id)).slice(0, 12)
  }, [availableTasks, pinnedTaskIds])
  const projectLineup = useMemo(() => {
    const set = new Set(pinnedProjectIds)
    return availableProjects.filter((project) => set.has(project.id)).slice(0, 12)
  }, [availableProjects, pinnedProjectIds])

  const toggleTaskPinned = (id: string, checked: boolean) => {
    setPinnedTaskIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((v) => v !== id)
    )
  }
  const toggleProjectPinned = (id: string, checked: boolean) => {
    setPinnedProjectIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((v) => v !== id)
    )
  }

  return (
    <div className="border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="outline" size="icon-sm" aria-label="Manage lineup pins" />}
            >
              <DotsThreeVertical size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {mode === "tasks" ? "Pin tasks to lineup" : "Pin projects to lineup"}
              </p>
              <DropdownMenuSeparator />
              {mode === "tasks"
                ? availableTasks.slice(0, 20).map((task) => (
                    <DropdownMenuCheckboxItem
                      key={task.id}
                      checked={pinnedTaskIds.includes(task.id)}
                      onCheckedChange={(checked) => toggleTaskPinned(task.id, checked === true)}
                    >
                      <span className="truncate">{task.title}</span>
                    </DropdownMenuCheckboxItem>
                  ))
                : availableProjects.slice(0, 20).map((project) => (
                    <DropdownMenuCheckboxItem
                      key={project.id}
                      checked={pinnedProjectIds.includes(project.id)}
                      onCheckedChange={(checked) =>
                        toggleProjectPinned(project.id, checked === true)
                      }
                    >
                      <span className="truncate">{project.name}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            href={mode === "tasks" ? "/tasks" : "/projects"}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Open full {mode}
          </Link>
        </div>
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {(mode === "tasks" ? taskLineup : projectLineup).length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {mode === "tasks" ? "No pinned tasks yet. Use the menu to pin tasks." : "No pinned projects yet. Use the menu to pin projects."}
          </span>
        ) : mode === "tasks" ? (
          taskLineup.map((task) => (
            <Badge key={task.id} variant="secondary" className="shrink-0 gap-2 rounded-full px-3 py-1 text-xs">
              <span className="max-w-[15rem] truncate">{task.title}</span>
              <span className="text-muted-foreground">{formatShortDate(task.dueDate)}</span>
            </Badge>
          ))
        ) : (
          projectLineup.map((project) => (
            <Badge key={project.id} variant="outline" className="shrink-0 gap-2 rounded-full px-3 py-1 text-xs">
              <span className="max-w-[15rem] truncate">{project.name}</span>
              <span className="text-muted-foreground">{formatShortDate(project.dueDate)}</span>
            </Badge>
          ))
        )}
      </div>
    </div>
  )
}
