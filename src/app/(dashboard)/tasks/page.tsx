"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Plus, MagnifyingGlass, Funnel } from "@phosphor-icons/react/dist/ssr"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/task-badges"
import { ResourceLinks } from "@/components/resource-links"
import type { TaskStatus } from "@/lib/types"

const ASSIGNED_PROJECT_NAMES = new Set(["Internal Tools", "Client Portal"])

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function isOverdue(due?: string) {
  if (!due) return false
  return due < todayISO()
}

export default function TasksPage() {
  const searchParams = useSearchParams()
  const {
    tasks,
    projects,
    selectedProjectFilterId,
    updateTask,
  } = useWorkspace()

  const [searchQuery, setSearchQuery] = useState("")
  const [filterPriority, setFilterPriority] = useState("all")
  const [activeTab, setActiveTab] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    const f = searchParams.get("filter")
    if (f === "my") setActiveTab("my-tasks")
    else if (f === "assigned") setActiveTab("assigned")
    else if (f === "overdue") setActiveTab("overdue")
  }, [searchParams])

  const scopedTasks = useMemo(() => {
    if (selectedProjectFilterId === ALL_PROJECTS_FILTER) return tasks
    return tasks.filter((t) => t.projectId === selectedProjectFilterId)
  }, [tasks, selectedProjectFilterId])

  const getFilteredTasks = () => {
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
  }

  const filteredTasks = getFilteredTasks()

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
          </div>

          <Card>
            <CardContent className="pt-6">
              {filteredTasks.length > 0 ? (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Task</th>
                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Project</th>
                        <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Links</th>
                        <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Priority</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task, i) => (
                        <tr
                          key={task.id}
                          className={i < filteredTasks.length - 1 ? "border-b" : ""}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">{task.title}</div>
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
                          <td className="px-4 py-3">
                            <Select
                              value={task.status}
                              onValueChange={(v) => {
                                if (v != null)
                                  updateTask(task.id, { status: v as TaskStatus })
                              }}
                            >
                              <SelectTrigger className="h-8 w-[140px] border-0 shadow-none px-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(
                                  [
                                    "todo",
                                    "in-progress",
                                    "review",
                                    "done",
                                  ] as TaskStatus[]
                                ).map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s.replace("-", " ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                            {task.dueDate ?? "—"}
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
    </div>
  )
}
