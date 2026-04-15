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
import {
  Plus,
  MagnifyingGlass,
  Funnel,
  Trash,
  PushPin,
  ArrowsDownUp,
  CaretUp,
  CaretDown,
} from "@phosphor-icons/react/dist/ssr"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { TaskStatusSelect } from "@/components/task-status-select"
import { ResourceLinks } from "@/components/resource-links"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { DUE_DATE_QUICK_PRESETS } from "@/lib/due-date-utils"
import { toast } from "sonner"
import type { Priority, TaskStatus } from "@/lib/types"

const ASSIGNED_PROJECT_NAMES = new Set(["Internal Tools", "Client Portal"])
const PRIORITY_OPTIONS: Priority[] = ["urgent", "high", "medium", "low"]

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

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function cmpText(a?: string, b?: string) {
  return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" })
}

function cmpDue(a?: string, b?: string) {
  const ax = a ?? "9999-99-99"
  const bx = b ?? "9999-99-99"
  return ax.localeCompare(bx)
}

export default function TasksPage() {
  const searchParams = useSearchParams()
  const {
    tasks,
    projects,
    selectedProjectFilterId,
    updateTask,
    pinTaskToLineup,
    deleteTask,
    bulkSetTaskDueDates,
    bulkBumpTaskDueDates,
  } = useWorkspace()

  const [searchQuery, setSearchQuery] = useState("")
  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all")
  const [activeTab, setActiveTab] = useState(() => initialTabFromFilter(searchParams))
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [selectedIdsRaw, setSelectedIdsRaw] = useState<Set<string>>(() => new Set())
  const [bulkDueDate, setBulkDueDate] = useState("")
  const [pageProjectFilterId, setPageProjectFilterId] = useState<string>(ALL_PROJECTS_FILTER)
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all")
  const [hideDone, setHideDone] = useState(false)
  const [sortKey, setSortKey] = useState<
    | "due-asc"
    | "due-desc"
    | "created-desc"
    | "priority-desc"
    | "project-asc"
    | "status-asc"
    | "title-asc"
  >("due-asc")

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [tasks, detailTaskId]
  )

  useEffect(() => {
    const taskId = searchParams.get("taskId")
    if (!taskId) return
    if (!tasks.some((t) => t.id === taskId)) return
    startTransition(() => setDetailTaskId(taskId))
  }, [searchParams, tasks])

  useEffect(() => {
    const f = searchParams.get("filter")
    let next: "all" | "my-tasks" | "assigned" | "overdue" = "all"
    if (f === "my") next = "my-tasks"
    else if (f === "assigned") next = "assigned"
    else if (f === "overdue") next = "overdue"
    startTransition(() => setActiveTab(next))
  }, [searchParams])

  useEffect(() => {
    const scope = searchParams.get("scope")
    const project = searchParams.get("project")
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const sort = searchParams.get("sort")
    const hideDoneParam = searchParams.get("hideDone")

    startTransition(() => {
      if (scope === "all") {
        setPageProjectFilterId(ALL_PROJECTS_FILTER)
      } else if (project && projects.some((p) => p.id === project)) {
        setPageProjectFilterId(project)
      } else {
        setPageProjectFilterId(
          selectedProjectFilterId === ALL_PROJECTS_FILTER
            ? ALL_PROJECTS_FILTER
            : selectedProjectFilterId
        )
      }

      if (
        status === "todo" ||
        status === "in-progress" ||
        status === "review" ||
        status === "done"
      ) {
        setStatusFilter(status)
      } else {
        setStatusFilter("all")
      }

      if (priority === "urgent" || priority === "high" || priority === "medium" || priority === "low") {
        setFilterPriority(priority)
      } else {
        setFilterPriority("all")
      }

      if (
        sort === "due-asc" ||
        sort === "due-desc" ||
        sort === "created-desc" ||
        sort === "priority-desc" ||
        sort === "project-asc" ||
        sort === "status-asc" ||
        sort === "title-asc"
      ) {
        setSortKey(sort)
      } else {
        setSortKey("due-asc")
      }

      setHideDone(hideDoneParam === "1" || hideDoneParam === "true")
    })
  }, [searchParams, projects, selectedProjectFilterId])

  const scopedTasks = useMemo(() => {
    if (pageProjectFilterId === ALL_PROJECTS_FILTER) return tasks
    return tasks.filter((t) => t.projectId === pageProjectFilterId)
  }, [tasks, pageProjectFilterId])

  const filteredTasks = useMemo(() => {
    let filtered = scopedTasks

    if (hideDone) {
      filtered = filtered.filter((t) => t.status !== "done")
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter)
    }

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

    const next = [...filtered]
    next.sort((a, b) => {
      switch (sortKey) {
        case "due-desc":
          return cmpDue(b.dueDate, a.dueDate)
        case "created-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "priority-desc": {
          const pa = PRIORITY_ORDER[a.priority]
          const pb = PRIORITY_ORDER[b.priority]
          if (pa !== pb) return pa - pb
          return cmpDue(a.dueDate, b.dueDate)
        }
        case "project-asc": {
          const pc = cmpText(a.projectName, b.projectName)
          if (pc !== 0) return pc
          return cmpText(a.title, b.title)
        }
        case "status-asc": {
          const statusOrder: Record<TaskStatus, number> = {
            todo: 0,
            "in-progress": 1,
            review: 2,
            done: 3,
          }
          const sc = statusOrder[a.status] - statusOrder[b.status]
          if (sc !== 0) return sc
          return cmpDue(a.dueDate, b.dueDate)
        }
        case "title-asc":
          return cmpText(a.title, b.title)
        case "due-asc":
        default:
          return cmpDue(a.dueDate, b.dueDate)
      }
    })

    return next
  }, [scopedTasks, activeTab, filterPriority, searchQuery, hideDone, statusFilter, sortKey])

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

  const sortIcon = (active: boolean, descending = false) => {
    if (!active) return <ArrowsDownUp size={13} className="text-muted-foreground/70" />
    return descending ? <CaretDown size={13} className="text-foreground" /> : <CaretUp size={13} className="text-foreground" />
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and track all your tasks</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click a task title to open details (description, links, tags).
          </p>
          {pageProjectFilterId !== ALL_PROJECTS_FILTER && (
            <p className="text-xs text-muted-foreground mt-1">
              Showing tasks for:{" "}
              <span className="font-medium text-foreground">
                {projects.find((p) => p.id === pageProjectFilterId)?.name}
              </span>
            </p>
          )}
        </div>
        <Button className="w-full gap-2 sm:w-auto" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          New Task
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="sticky top-0 z-20 grid w-full grid-cols-2 gap-1 rounded-lg bg-background/95 py-1 backdrop-blur sm:max-w-md sm:grid-cols-4">
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
          <div className="sticky top-12 z-20 space-y-4 rounded-lg border bg-background/95 p-3 backdrop-blur">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Project</Label>
                <Select
                  value={pageProjectFilterId}
                  onValueChange={(v) => {
                    if (v == null) return
                    setPageProjectFilterId(v)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PROJECTS_FILTER}>All projects</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    if (v == null) return
                    setStatusFilter(v as typeof statusFilter)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="todo">To do</SelectItem>
                    <SelectItem value="in-progress">In progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hide-done"
                    checked={hideDone}
                    onCheckedChange={(checked) => setHideDone(checked === true)}
                  />
                  <Label htmlFor="hide-done" className="text-xs text-muted-foreground">
                    Hide done
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
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
                  if (v != null) setFilterPriority(v as typeof filterPriority)
                }}
              >
                <SelectTrigger className="w-full sm:w-40">
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
              <Button
                type="button"
                variant="outline"
                className="w-full shrink-0 gap-2 sm:w-auto"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                Add task
              </Button>
            </div>
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
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[56rem] text-sm">
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
                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 hover:text-foreground text-muted-foreground"
                            onClick={() => setSortKey("project-asc")}
                          >
                            <span>Project</span>
                            {sortIcon(sortKey === "project-asc")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Links</th>
                        <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 hover:text-foreground text-muted-foreground"
                            onClick={() => setSortKey("priority-desc")}
                          >
                            <span>Priority</span>
                            {sortIcon(sortKey === "priority-desc", true)}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 hover:text-foreground text-muted-foreground"
                            onClick={() => setSortKey("status-asc")}
                          >
                            <span>Status</span>
                            {sortIcon(sortKey === "status-asc")}
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 hover:text-foreground text-muted-foreground"
                            onClick={() =>
                              setSortKey((current) =>
                                current === "due-asc" ? "due-desc" : "due-asc"
                              )
                            }
                          >
                            <span>Due</span>
                            {sortIcon(sortKey === "due-asc" || sortKey === "due-desc", sortKey === "due-desc")}
                          </button>
                        </th>
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
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground md:hidden">
                              <p>Project: {task.projectName ?? "—"}</p>
                              <p className="capitalize">Priority: {task.priority}</p>
                              <p>Due: {task.dueDate ?? "—"}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            {task.projectName ?? "—"}
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell align-top">
                            <ResourceLinks links={task.links} compact />
                          </td>
                          <td className="px-4 py-2 hidden lg:table-cell">
                            <Select
                              value={task.priority}
                              onValueChange={(v) => {
                                if (v != null) updateTask(task.id, { priority: v as Priority })
                              }}
                            >
                              <SelectTrigger className="h-7 w-auto min-w-[6.5rem] rounded-full border-border/70 bg-muted/40 px-2.5 py-0 text-xs capitalize">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRIORITY_OPTIONS.map((priority) => (
                                  <SelectItem key={priority} value={priority} className="capitalize">
                                    {priority}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2 align-middle">
                            <TaskStatusSelect
                              size="compact"
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
                              className={
                                task.pinnedToLineup
                                  ? "text-primary hover:text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                              aria-label={`${task.pinnedToLineup ? "Unpin" : "Pin"} task to taskbar: ${task.title}`}
                              title={task.pinnedToLineup ? "Pinned to taskbar" : "Pin to taskbar"}
                              onClick={() =>
                                task.pinnedToLineup
                                  ? updateTask(task.id, { pinnedToLineup: false })
                                  : pinTaskToLineup(task.id)
                              }
                            >
                              <PushPin size={18} weight={task.pinnedToLineup ? "fill" : "regular"} />
                            </Button>
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
