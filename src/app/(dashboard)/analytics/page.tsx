"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ChartLine,
  ChartBar,
  TrendUp,
  Target,
  Users,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import type { Priority, ProjectLifecycleStatus } from "@/lib/types"

function projectLabelStatus(status?: ProjectLifecycleStatus): string {
  if (status === "completed") return "Done"
  if (status === "planning") return "Planning"
  if (status === "archived") return "Archived"
  return "Active"
}

export default function AnalyticsPage() {
  const { projects, tasks } = useWorkspace()

  const completedProjects = useMemo(
    () => projects.filter((p) => p.status === "completed").length,
    [projects]
  )

  const completionRatePct = useMemo(() => {
    if (projects.length === 0) return 0
    return Math.round((completedProjects / projects.length) * 100)
  }, [projects.length, completedProjects])

  const avgProgress = useMemo(() => {
    if (projects.length === 0) return 0
    const sum = projects.reduce((s, p) => s + (p.progress ?? 0), 0)
    return Math.round(sum / projects.length)
  }, [projects])

  const doneTasks = useMemo(
    () => tasks.filter((t) => t.status === "done").length,
    [tasks]
  )

  const productivityPct = useMemo(() => {
    if (tasks.length === 0) return 0
    return Math.round((doneTasks / tasks.length) * 100)
  }, [tasks.length, doneTasks])

  const uniqueAssignees = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks) {
      if (t.assignee?.trim()) s.add(t.assignee.trim())
    }
    return s.size
  }, [tasks])

  const metrics = useMemo(
    () => [
      {
        title: "Project completion",
        value: projects.length === 0 ? "—" : `${completionRatePct}%`,
        change:
          projects.length === 0
            ? "Add projects to see completion rate"
            : `${completedProjects} of ${projects.length} marked completed`,
        icon: CheckCircle,
        color: "text-green-500",
      },
      {
        title: "Task completion",
        value: tasks.length === 0 ? "—" : `${productivityPct}%`,
        change:
          tasks.length === 0
            ? "Add tasks to see throughput"
            : `${doneTasks} of ${tasks.length} tasks done`,
        icon: TrendUp,
        color: "text-blue-500",
      },
      {
        title: "Avg. project progress",
        value: projects.length === 0 ? "—" : `${avgProgress}%`,
        change:
          projects.length === 0
            ? "Progress bars fill as you edit projects"
            : "Mean of project progress fields",
        icon: Target,
        color: "text-purple-500",
      },
      {
        title: "People with tasks",
        value: tasks.length === 0 ? "—" : String(uniqueAssignees),
        change:
          uniqueAssignees === 0
            ? "Assign tasks to teammates to track here"
            : "Unique assignees on tasks",
        icon: Users,
        color: "text-orange-500",
      },
    ],
    [
      projects.length,
      completionRatePct,
      completedProjects,
      tasks.length,
      productivityPct,
      doneTasks,
      avgProgress,
      uniqueAssignees,
    ]
  )

  const teamPerformance = useMemo(() => {
    const m = new Map<string, { completed: number; pending: number }>()
    for (const t of tasks) {
      const name = t.assignee?.trim() || "Unassigned"
      if (!m.has(name)) m.set(name, { completed: 0, pending: 0 })
      const row = m.get(name)!
      if (t.status === "done") row.completed += 1
      else row.pending += 1
    }
    return Array.from(m.entries()).map(([name, v]) => {
      const total = v.completed + v.pending
      return {
        name,
        completed: v.completed,
        pending: v.pending,
        percentage: total === 0 ? 0 : Math.round((100 * v.completed) / total),
      }
    })
  }, [tasks])

  const projectStats = useMemo(
    () =>
      projects.map((p) => {
        const progress = p.progress ?? 0
        let status = "Planning"
        if (p.status === "completed") status = "Done"
        else if (progress >= 70) status = "On Track"
        else if (progress >= 30) status = "In progress"
        else status = "Early"
        return { name: p.name, progress, status, lifecycle: projectLabelStatus(p.status) }
      }),
    [projects]
  )

  const priorityCounts = useMemo(() => {
    const order: Priority[] = ["urgent", "high", "medium", "low"]
    const colors: Record<Priority, string> = {
      urgent: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-green-500",
    }
    const counts: Record<Priority, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    }
    for (const t of tasks) {
      counts[t.priority] += 1
    }
    return order.map((label) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      count: counts[label],
      color: colors[label],
    }))
  }, [tasks])

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Metrics from your workspace (projects, tasks, assignees)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon size={18} className={metric.color} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{metric.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={18} />
              By assignee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No tasks yet, or no assignees set. Add tasks with an assignee name to see breakdowns.
              </p>
            ) : (
              teamPerformance.map((member) => (
                <div key={member.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{member.name}</p>
                    <Badge variant="secondary" className="text-xs">
                      {member.percentage}%
                    </Badge>
                  </div>
                  <Progress value={member.percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {member.completed} completed · {member.pending} open
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target size={18} />
              Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {projectStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Create projects from the dashboard or Projects page.
              </p>
            ) : (
              projectStats.map((project) => (
                <div key={project.name} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {project.lifecycle}
                    </Badge>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {project.progress}% · {project.status}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartLine size={18} />
            Task completion timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center rounded-lg bg-muted/40">
            <p className="text-sm text-muted-foreground">
              Chart hook-up can go here — data is live in the workspace for tasks and projects.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartBar size={18} />
            Tasks by priority
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No tasks — counts will appear when you add tasks with priorities.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              {priorityCounts.map((item) => (
                <div key={item.label} className="text-center">
                  <div
                    className={`h-24 ${item.color} rounded-lg mb-2 flex items-center justify-center text-white font-bold text-xl`}
                  >
                    {item.count}
                  </div>
                  <p className="text-sm font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
