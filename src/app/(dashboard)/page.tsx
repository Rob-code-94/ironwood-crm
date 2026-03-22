"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreateProjectModal } from "@/components/create-project-modal"
import { MiniCalendar } from "@/components/mini-calendar"
import {
  CheckSquare,
  FolderOpen,
  UsersThree,
  CalendarBlank,
  TrendUp,
  ArrowUp,
  ArrowDown,
} from "@phosphor-icons/react/dist/ssr"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/task-badges"
import type { Task, TaskStatus } from "@/lib/types"

const STATUS_LABELS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in-progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const { tasks, projects, contacts, selectedProjectFilterId } = useWorkspace()

  const contextProject = useMemo(() => {
    if (selectedProjectFilterId === ALL_PROJECTS_FILTER) return undefined
    return projects.find((p) => p.id === selectedProjectFilterId)
  }, [projects, selectedProjectFilterId])

  const contextFields = contextProject?.customFields
  const contextFieldEntries = useMemo(
    () =>
      contextFields && Object.keys(contextFields).length
        ? Object.entries(contextFields)
        : [],
    [contextFields]
  )

  const activeProjects = useMemo(
    () => projects.filter((p) => (p.status ?? "active") === "active").length,
    [projects]
  )

  const upcomingEvents = useMemo(
    () => tasks.filter((t) => t.dueDate && t.dueDate >= todayISO()).length,
    [tasks]
  )

  const statusCounts = useMemo(() => {
    const m: Record<TaskStatus, number> = {
      todo: 0,
      "in-progress": 0,
      review: 0,
      done: 0,
    }
    for (const t of tasks) {
      m[t.status] += 1
    }
    return m
  }, [tasks])

  const statusRows = useMemo(() => {
    const total = tasks.length || 1
    return STATUS_LABELS.map(({ key, label }) => {
      const count = statusCounts[key]
      return { label, count, pct: Math.round((count / total) * 100) }
    })
  }, [tasks.length, statusCounts])

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 5)
  }, [tasks])

  const stats = [
    {
      title: "Total Tasks",
      value: String(tasks.length),
      change: "Across all projects",
      trend: "up" as const,
      icon: CheckSquare,
    },
    {
      title: "Active Projects",
      value: String(activeProjects),
      change: "Lifecycle: active",
      trend: "up" as const,
      icon: FolderOpen,
    },
    {
      title: "Contacts",
      value: String(contacts.length),
      change: "In CRM",
      trend: "up" as const,
      icon: UsersThree,
    },
    {
      title: "Upcoming Deadlines",
      value: String(upcomingEvents),
      change: "Tasks with future due dates",
      trend: upcomingEvents >= 5 ? ("down" as const) : ("up" as const),
      icon: CalendarBlank,
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s your overview for today.</p>
          {contextProject && (
            <p className="text-xs text-muted-foreground mt-1">
              Project context:{" "}
              <span className="font-medium text-foreground">{contextProject.name}</span>
            </p>
          )}
        </div>
        <CreateProjectModal />
      </div>

      {contextFieldEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Project labels</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              {contextFieldEntries.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-medium break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon size={18} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {stat.trend === "up" ? (
                  <ArrowUp size={12} className="text-green-500" />
                ) : (
                  <ArrowDown size={12} className="text-red-500" />
                )}
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendUp size={18} />
                  Activity Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-center justify-center rounded-lg bg-muted/40">
                  <p className="text-sm text-muted-foreground">Chart will render here</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tasks by Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statusRows.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{item.label}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare size={18} />
                Recent Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Task</th>
                      <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Project</th>
                      <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Priority</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTasks.map((task: Task, i: number) => (
                      <tr
                        key={task.id}
                        className={i < recentTasks.length - 1 ? "border-b" : ""}
                      >
                        <td className="px-4 py-3 font-medium">{task.title}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {task.projectName ?? "—"}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <TaskPriorityBadge priority={task.priority} />
                        </td>
                        <td className="px-4 py-3">
                          <TaskStatusBadge status={task.status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {task.dueDate ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <MiniCalendar />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-2">
                <a href="/tasks" className="px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors block">
                  View All Tasks
                </a>
                <a href="/projects" className="px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors block">
                  All Projects
                </a>
                <a href="/documents" className="px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors block">
                  Documents
                </a>
                <a href="/calendar" className="px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors block">
                  Calendar
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Open tasks</span>
                <Badge variant="default">
                  {tasks.filter((t) => t.status !== "done").length}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tasks completed</span>
                <Badge variant="secondary">
                  {tasks.filter((t) => t.status === "done").length}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">In review</span>
                <Badge variant="outline">
                  {tasks.filter((t) => t.status === "review").length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
