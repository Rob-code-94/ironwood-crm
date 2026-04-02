"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { useWorkspace } from "@/lib/workspace/context"
import { ResourceLinks } from "@/components/resource-links"
import { TaskStatusBadge } from "@/components/task-badges"
import { groupProjectTasksIntoSections } from "@/lib/playbook-sections"
import { cn } from "@/lib/utils"

export function ProjectPlaybookPanel({ projectId }: { projectId: string }) {
  const { tasks, updateTask } = useWorkspace()
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)

  const detailTask = useMemo(
    () => (detailTaskId ? (tasks.find((t) => t.id === detailTaskId) ?? null) : null),
    [tasks, detailTaskId]
  )

  useEffect(() => {
    if (detailTaskId && !detailTask) setDetailTaskId(null)
  }, [detailTaskId, detailTask])

  const sections = useMemo(
    () => groupProjectTasksIntoSections(tasks, projectId),
    [tasks, projectId]
  )

  const total = tasks.filter((t) => t.projectId === projectId).length
  const done = tasks.filter((t) => t.projectId === projectId && t.status === "done").length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  return (
    <div className="space-y-6">
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
                          "rounded-lg border p-3 flex gap-3 items-start transition-colors",
                          checked && "bg-muted/30 opacity-80"
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const on = v === true
                              updateTask(task.id, {
                                status: on ? "done" : "todo",
                              })
                            }}
                          />
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetailTaskId(task.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setDetailTaskId(task.id)
                            }
                          }}
                          className={cn(
                            "flex-1 min-w-0 space-y-2 rounded-md -m-1 p-1 cursor-pointer text-left",
                            "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                            checked && "hover:bg-muted/40"
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2 gap-y-1">
                            <p
                              className={cn(
                                "font-medium text-sm min-w-0 flex-1 basis-[min(100%,12rem)]",
                                checked && "line-through text-muted-foreground"
                              )}
                            >
                              {task.title}
                            </p>
                            <TaskStatusBadge status={task.status} size="sm" />
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {task.description}
                            </p>
                          )}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <ResourceLinks links={task.links} compact />
                          </div>
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

      <TaskDetailDialog
        task={detailTask}
        open={detailTask !== null}
        onOpenChange={(next) => {
          if (!next) setDetailTaskId(null)
        }}
      />
    </div>
  )
}
