"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/lib/types"

const STATUSES: TaskStatus[] = ["todo", "in-progress", "review", "done"]

type TaskStatusSelectProps = {
  value: TaskStatus
  onChange: (status: TaskStatus) => void
  /** `compact` for dense dashboard / project tables */
  size?: "default" | "compact"
  /** Prefer `top` in tall scroll areas so the list is not clipped below the viewport */
  contentSide?: "top" | "bottom"
  className?: string
}

export function TaskStatusSelect({
  value,
  onChange,
  size = "default",
  contentSide = "bottom",
  className,
}: TaskStatusSelectProps) {
  const triggerClass =
    size === "compact"
      ? "h-auto min-h-8 w-[min(100%,8.75rem)] max-w-[9rem] py-1.5 text-xs"
      : "h-auto min-h-9 w-[min(100%,10rem)] max-w-[10rem] py-2"

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v != null) onChange(v as TaskStatus)
      }}
    >
      <SelectTrigger className={cn(triggerClass, className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent side={contentSide}>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s.replace("-", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
