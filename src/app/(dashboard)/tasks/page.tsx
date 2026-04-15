"use client"

import { startTransition, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, MagnifyingGlass, Funnel, Trash } from "@phosphor-icons/react/dist/ssr"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { TaskPriorityBadge } from "@/components/task-badges"
import { TaskStatusSelect } from "@/components/task-status-select"
import { ResourceLinks } from "@/components/resource-links"
import { Checkbox } from "@/components/ui/checkbox"
import { DUE_DATE_QUICK_PRESETS } from "@/lib/due-date-utils"
import { toast } from "sonner"

const ASSIGNED_PROJECT_NAMES = new Set(["Internal Tools", "Client Portal"])

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function isOverdue(due?: string) {
  if (!due) return false
  return due < todayISO()
}

function initialTabFromFilter(sp: { get: (k: string) => string | null }) {
  const f = sp.get("filter")
  if (f === "my") return "my-tasks"
  if (f === "assigned") return "assigned"
  if (f === "overdue") return "overdue"
  return "all"
}

export default function TasksPage() {
  const searchParams = useSearchParams()
  const {
    tasks,
    projects,
    selectedProjectFilterId,
    updateTask,
    deleteTask,
    bulkSetTaskDueDates,
    bulkBumpTaskDueDates,
  } = useWorkspace()

  const [searchQuery, setSearchQuery] = useState("")
  const [filterPriority, setFilterPriority] = useState("all")
  const [activeTab, setActiveTab] = useState(() => initialTabFromFilter(searchParams))
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [selectedIdsRaw, setSelectedIdsRaw] = useState<Set<string>>(() => new Set())
  const [bulkDueDate, setBulkDueDate] = useState("")

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [tasks, detailTaskId]
  )

  useEffect(() => {
    const f = searchParams.get("filter")
    let next: "all" | "my-tasks" | "assigned" | "overdue" = "all"
    if (f === "my") next = "my-tasks"
    else if (f === "assigned") next = "assigned"
    else if (f === "overdue") next = "overdue"
    startTransition(() => setActiveTab(next))
  }, [searchParams])

  const scopedTasks = useMemo(() => {
    if (selectedProjectFilterId === ALL_PROJECTS_FILTER) return tasks
    return tasks.filter((t) => t.projectId === selectedProjectFilterId)
  }, [tasks, selectedProjectFilterId])

  const filteredTasks = useMemo(() => {
    let filtered = scopedTasks

    if (activeTab === "my-tasks") {
      filtered = filtered.filter((t) => t.status !== "done")
    } else if (activeTab === "assigned") {
      filtered = filtered.filter(
        (t) =>
          (t.projectName && ASSIGNED_PROJECT_NAMES.has(t.projectName)) ||
          Boolean(t.assignee)
      )
    } else if (activeTab === "overdue") {
      filtered = filtered.filter((t) => isOverdue(t.dueDate) && t.status !== "done")
    }

    if (filterPriority !== "all") {
      filtered = filtered.filter((t) => t.priority === filterPriority)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.projectName ?? "").toLowerCase().includes(q)
      )
    }

    return filtered
  }, [scopedTasks, activeTab, filterPriority, searchQuery])

  const allowedTaskIds = useMemo(
    () => new Set(filteredTasks.map((t) => t.id)),
    [filteredTasks]
  )
  const selectedIds = useMemo(() => {
    const next = new Set<string>()
    for (const id of selectedIdsRaw) {
      if (allowedTaskIds.has(id)) next.add(id)
    }
    return next
  }, [allowedTaskIds, selectedIdsRaw])

  const visibleIds = useMemo(() => filteredTasks.map((t) => t.id), [filteredTasks])
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  const taskStats = {
    all: scopedTasks.length,
    "my-tasks": scopedTasks.filter((t) => t.status !== "done").length,
    assigned: scopedTasks.filter(
      (t) =>
        (t.projectName && ASSIGNED_PROJECT_NAMES.has(t.projectName)) ||
        Boolean(t.assignee)
    ).length,
    overdue: scopedTasks.filter((t) => isOverdue(t.dueDate) && t.status !== "done")
      .length,
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and track all your tasks</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click a task title to open details (description, links, tags).
          </p>
          {selectedProjectFilterId !== ALL_PROJECTS_FILTER && (
            <p className="text-xs text-muted-foreground mt-1">
              Filtered by project:{" "}
              <span className="font-medium text-foreground">
                {projects.find((p) => p.id === selectedProjectFilterId)?.name}
              </span>
            </p>
          )}
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          New Task
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-md">
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-2">
              {taskStats.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="my-tasks">
            My Tasks
            <Badge variant="secondary" className="ml-2">
              {taskStats["my-tasks"]}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="assigned">
            Assigned
            <Badge variant="secondary" className="ml-2">
              {taskStats.assigned}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue
            <Badge variant="destructive" className="ml-2">
              {taskStats.overdue}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filterPriority}
              onValueChange={(v) => {
                if (v != null) setFilterPriority(v)
              }}
            >
              <SelectTrigger className="w-32">
                <Funnel size={16} className="mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="shrink-0 gap-2" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              Add task
            </Button>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
              <p className="text-sm font-medium">
                {selectedIds.size} task{selectedIds.size === 1 ? "" : "s"} selected
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Quick due:</span>
                {DUE_DATE_QUICK_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      const ids = [...selectedIds]
                      bulkSetTaskDueDates(ids, p.getIso())
                      toast.success(`Due date set for ${ids.length} task${ids.length === 1 ? "" : "s"}`)
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => {
                    const ids = [...selectedIds]
                    bulkBumpTaskDueDates(ids, 1)
                    toast.success(`Moved due date +1 day for ${ids.length} task${ids.length === 1 ? "" : "s"}`)
                  }}
                >
                  +1 day
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    const ids = [...selectedIds]
                    bulkSetTaskDueDates(ids, undefined)
                    toast.success(`Cleared due date for ${ids.length} task${ids.length === 1 ? "" : "s"}`)
                  }}
                >
                  Clear due
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label htmlFor="bulk-due" className="text-xs text-muted-foreground">
                    Custom date
                  </label>
                  <Input
                    id="bulk-due"
                    type="date"
                    className="h-8 w-[11rem]"
                    value={bulkDueDate}
                    onChange={(e) => setBulkDueDate(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={!bulkDueDate}
                  onClick={() => {
                    const ids = [...selectedIds]
                    bulkSetTaskDueDates(ids, bulkDueDate)
                    toast.success(`Due date set for ${ids.length} task${ids.length === 1 ? "" : "s"}`)
                  }}
                >
                  Apply date
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setSelectedIdsRaw(new Set())}
                >
                  Clear selection
                </Button>
              </div>
            </div>
          )}

          <Card>
            <CardContent className="pt-6">
              {filteredTasks.length > 0 ? (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="w-10 px-2 py-3">
                          <Checkbox
                            checked={allVisibleSelected}
                            indeterminate={someVisibleSelected && !allVisibleSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedIdsRaw(new Set(visibleIds))
                              } else {
                                setSelectedIdsRaw(new Set())
                              }
                            }}
                            aria-label="Select all tasks in this list"
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-medium">Task</th>
                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Project</th>
                        <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Links</th>
                        <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Priority</th>
                        <th className="px-4 py-3 text-left font-medium min-w-[9.5rem]">Status</th>
                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Due</th>
                        <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Reminder</th>
                        <th className="px-4 py-3 text-right font-medium w-[1%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task, i) => (
                        <tr
                          key={task.id}
                          className={i < filteredTasks.length - 1 ? "border-b" : ""}
                        >
                          <td className="px-2 py-3 align-middle">
                            <Checkbox
                              checked={selectedIds.has(task.id)}
                              onCheckedChange={(checked) => {
                                setSelectedIdsRaw((prev) => {
                                  const next = new Set(prev)
                                  if (checked) next.add(task.id)
                                  else next.delete(task.id)
                                  return next
                                })
                              }}
                              aria-label={`Select task: ${task.title}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="text-left font-medium text-foreground hover:underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="View task details"
                              onClick={() => setDetailTaskId(task.id)}
                            >
                              {task.title}
                            </button>
                            <ResourceLinks links={task.links} compact className="mt-1 md:hidden" />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            {task.projectName ?? "—"}
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell align-top">
                            <ResourceLinks links={task.links} compact />
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <TaskPriorityBadge priority={task.priority} />
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <TaskStatusSelect
                              value={task.status}
                              onChange={(status) => updateTask(task.id, { status })}
                            />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            {task.dueDate ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                            {task.reminders?.[0] ? `${task.reminders[0].minutesBefore}m before` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right align-middle">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete task: ${task.title}`}
                              onClick={() => {
                                if (!window.confirm(`Delete “${task.title}”?`)) return
                                deleteTask(task.id)
                                if (detailTaskId === task.id) setDetailTaskId(null)
                                toast.success("Task deleted")
                              }}
                            >
                              <Trash size={18} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No tasks found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailDialog
        task={detailTask}
        open={detailTask !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTaskId(null)
        }}
      />
    </div>
  )
}
