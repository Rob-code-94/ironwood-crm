import { Badge } from "@/components/ui/badge"
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
  "default" | "secondary" | "outline" | "destructive"
> = {
  todo: "outline",
  "in-progress": "default",
  review: "secondary",
  done: "secondary",
}

export function TaskPriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant={priorityVariant[priority]} className="capitalize">
      {priority}
    </Badge>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant={statusVariant[status]} className="capitalize">
      {status.replace("-", " ")}
    </Badge>
  )
}
