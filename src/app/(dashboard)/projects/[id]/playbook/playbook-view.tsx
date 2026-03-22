"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, ListChecks } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import { ResourceLinks } from "@/components/resource-links"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"

function sortInSection(a: Task, b: Task) {
  const oa = a.sortOrder ?? 9999
  const ob = b.sortOrder ?? 9999
  if (oa !== ob) return oa - ob
  return a.title.localeCompare(b.title)
}

export function PlaybookView() {
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : ""
  const { projects, tasks, updateTask } = useWorkspace()

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id])

  const sections = useMemo(() => {
    const list = tasks.filter((t) => t.projectId === id)
    const map = new Map<string, Task[]>()
    for (const t of list) {
      const sec = t.section?.trim() || "General"
      if (!map.has(sec)) map.set(sec, [])
      map.get(sec)!.push(t)
    }
    for (const arr of map.values()) {
      arr.sort(sortInSection)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [tasks, id])

  const total = tasks.filter((t) => t.projectId === id).length
  const done = tasks.filter((t) => t.projectId === id && t.status === "done").length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

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
            Project not found.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href={`/projects/${id}`}>
            <Button variant="ghost" size="sm" className="shrink-0">
              <ArrowLeft size={16} className="mr-2" />
              Project
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ListChecks size={24} className="text-muted-foreground" />
              Playbook
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {project.name} · {done}/{total} complete ({pct}%)
            </p>
          </div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden max-w-md">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No tasks for this project. Add tasks with a section name to group them here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {sections.map(([sectionName, sectionTasks]) => {
            const secDone = sectionTasks.filter((t) => t.status === "done").length
            return (
              <Card key={sectionName}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span>{sectionName}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {secDone}/{sectionTasks.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sectionTasks.map((task) => {
                    const checked = task.status === "done"
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "rounded-lg border p-3 flex gap-3 items-start",
                          checked && "bg-muted/30 opacity-80"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const on = v === true
                            updateTask(task.id, {
                              status: on ? "done" : "todo",
                            })
                          }}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <p
                            className={cn(
                              "font-medium text-sm",
                              checked && "line-through text-muted-foreground"
                            )}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {task.description}
                            </p>
                          )}
                          <ResourceLinks links={task.links} compact />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
