"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, CheckSquare, Files, ListChecks, Plus } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/task-badges"
import { ResourceLinks } from "@/components/resource-links"
import { parseKeyValueLines, recordToKeyValueLines } from "@/lib/kv-lines"
import { toast } from "sonner"
import type { ProjectLifecycleStatus } from "@/lib/types"

const statusColor: Record<ProjectLifecycleStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  planning: "secondary",
  completed: "outline",
  archived: "outline",
}

export function ProjectDetailView() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  const { projects, tasks, updateProject } = useWorkspace()
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [customFieldsDraft, setCustomFieldsDraft] = useState("")

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id])

  useEffect(() => {
    if (project) setCustomFieldsDraft(recordToKeyValueLines(project.customFields))
  }, [project?.id])

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === id),
    [tasks, id]
  )

  if (!project) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} className="mr-2" />
            Projects
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Project not found. It may have been removed.
          </CardContent>
        </Card>
      </div>
    )
  }

  const st = project.status ?? "active"

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="shrink-0">
              <ArrowLeft size={16} className="mr-2" />
              Projects
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="size-3 rounded-full shrink-0 border border-border/50"
                style={{ backgroundColor: project.color }}
              />
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <Badge variant={statusColor[st]} className="capitalize">
                {st}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          render={<Link href={`/projects/${id}/playbook`} />}
        >
          <ListChecks size={16} />
          Playbook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace labels</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Optional key-value pairs shown on the dashboard when this project is selected (IDs, codes, etc.).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cf">One <code className="text-xs">key: value</code> per line</Label>
            <Textarea
              id="cf"
              rows={4}
              value={customFieldsDraft}
              onChange={(e) => setCustomFieldsDraft(e.target.value)}
              className="font-mono text-sm"
              placeholder="External ID: ABC-123"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const parsed = parseKeyValueLines(customFieldsDraft)
              updateProject(id, {
                customFields: Object.keys(parsed).length ? parsed : undefined,
              })
              toast.success("Labels saved")
            }}
          >
            Save labels
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare size={18} />
              Tasks
            </CardTitle>
            <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
              <Plus size={14} className="mr-1" />
              Add Task
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Task</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Section</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Priority</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-sm">
                        No tasks yet for this project.
                      </td>
                    </tr>
                  ) : (
                    projectTasks.map((task, i) => (
                      <tr
                        key={task.id}
                        className={i < projectTasks.length - 1 ? "border-b" : ""}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">{task.title}</div>
                          <ResourceLinks links={task.links} compact className="mt-1" />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                          {task.section?.trim() || "—"}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <TaskPriorityBadge priority={task.priority} />
                        </td>
                        <td className="px-4 py-3">
                          <TaskStatusBadge status={task.status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {task.dueDate ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Files size={16} />
              Documents
            </CardTitle>
            <Button size="sm" variant="outline">
              <Plus size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">
              No documents uploaded yet.
            </p>
          </CardContent>
        </Card>
      </div>

      <CreateTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        defaultProjectId={id}
      />
    </div>
  )
}
