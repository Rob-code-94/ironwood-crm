"use client"

import { useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash } from "@phosphor-icons/react/dist/ssr"
import type { Task, TaskStatus } from "@/lib/types"
import { ALL_PROJECTS_FILTER, useWorkspace } from "@/lib/workspace/context"
import { priorityVariant } from "@/components/task-badges"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { ResourceLinks } from "@/components/resource-links"

const COLUMN_ORDER: { id: TaskStatus; title: string; color: string }[] = [
  { id: "todo", title: "To Do", color: "bg-slate-100" },
  { id: "in-progress", title: "In Progress", color: "bg-blue-100" },
  { id: "review", title: "Review", color: "bg-yellow-100" },
  { id: "done", title: "Done", color: "bg-green-100" },
]
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
}

export function KanbanBoard() {
  const {
    tasks,
    moveTaskToStatus,
    deleteTask,
    selectedProjectFilterId,
  } = useWorkspace()
  const [draggedTask, setDraggedTask] = useState<{
    taskId: string
    sourceStatus: TaskStatus
  } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>("todo")

  const visibleTasks = useMemo(() => {
    if (selectedProjectFilterId === ALL_PROJECTS_FILTER) return tasks
    return tasks.filter((t) => t.projectId === selectedProjectFilterId)
  }, [tasks, selectedProjectFilterId])

  const columns = useMemo(() => {
    return COLUMN_ORDER.map((col) => ({
      ...col,
      tasks: visibleTasks.filter((t) => t.status === col.id),
    }))
  }, [visibleTasks])

  const handleDragStart = (
    e: React.DragEvent,
    taskId: string,
    sourceStatus: TaskStatus
  ) => {
    setDraggedTask({ taskId, sourceStatus })
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault()
    if (!draggedTask) return
    if (draggedTask.sourceStatus === targetStatus) {
      setDraggedTask(null)
      return
    }
    moveTaskToStatus(draggedTask.taskId, targetStatus)
    setDraggedTask(null)
  }

  return (
    <>
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="w-[17.5rem] flex-shrink-0 rounded-lg bg-muted/30 p-4 sm:w-80"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${column.color}`} />
                <h3 className="font-semibold text-sm">{column.title}</h3>
                <Badge variant="secondary" className="text-xs">
                  {column.tasks.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => {
                  setCreateDefaultStatus(column.id)
                  setCreateOpen(true)
                }}
              >
                <Plus size={14} />
              </Button>
            </div>

            <div
              className="space-y-3 min-h-[200px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {column.tasks.map((task) => (
                <KanbanTaskCard
                  key={task.id}
                  task={task}
                  columnStatus={column.id}
                  onDragStart={handleDragStart}
                  onDelete={() => deleteTask(task.id)}
                  onMoveTask={moveTaskToStatus}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStatus={createDefaultStatus}
      />
    </>
  )
}

function KanbanTaskCard({
  task,
  columnStatus,
  onDragStart,
  onDelete,
  onMoveTask,
}: {
  task: Task
  columnStatus: TaskStatus
  onDragStart: (e: React.DragEvent, taskId: string, sourceStatus: TaskStatus) => void
  onDelete: () => void
  onMoveTask: (taskId: string, status: TaskStatus) => void
}) {
  return (
    <Card
      className="cursor-grab bg-card transition-shadow hover:shadow-md active:cursor-grabbing"
      draggable
      onDragStart={(e) => onDragStart(e, task.id, columnStatus)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-medium leading-snug">{task.title}</p>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash size={14} />
          </button>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground">{task.description}</p>
        )}

        {task.projectName && (
          <p className="text-xs text-muted-foreground">{task.projectName}</p>
        )}

        <ResourceLinks links={task.links} compact className="pt-1" />

        <div className="flex items-center justify-between pt-2">
          <Badge
            variant={priorityVariant[task.priority]}
            className="text-xs capitalize"
          >
            {task.priority}
          </Badge>
          <Select value={task.status} onValueChange={(value) => onMoveTask(task.id, value as TaskStatus)}>
            <SelectTrigger className="h-7 w-[7.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_ORDER.map((column) => (
                <SelectItem key={column.id} value={column.id} className="text-xs">
                  {STATUS_LABEL[column.id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {task.assignee && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <span>Assigned to</span>
            <span className="font-medium">{task.assignee}</span>
          </div>
        )}

        {task.dueDate && (
          <div className="text-xs text-muted-foreground">
            Due: {task.dueDate}
            {task.reminders?.[0] ? ` · reminder ${task.reminders[0].minutesBefore}m before` : ""}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
