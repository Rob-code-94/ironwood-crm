import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Priority, TaskStatus } from "@/lib/types"

export const priorityVariant: Record<
  Priority,
  "default" | "secondary" | "outline" | "destructive"
> = {
  urgent: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
}

export const statusVariant: Record<
  TaskStatus,
  "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "info"
> = {
  todo: "outline",
  "in-progress": "default",
  review: "warning",
  done: "success",
}

export const statusLabel: Record<TaskStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  review: "In review",
  done: "Done",
}

export function TaskPriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant={priorityVariant[priority]} className="capitalize">
      {priority}
    </Badge>
  )
}

export function TaskStatusBadge({
  status,
  size = "default",
  className,
}: {
  status: TaskStatus
  size?: "default" | "sm"
  className?: string
}) {
  return (
    <Badge variant={statusVariant[status]} size={size} className={cn("shrink-0", className)}>
      {statusLabel[status]}
    </Badge>
  )
}
