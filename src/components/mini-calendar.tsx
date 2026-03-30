"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Plus,
  Calendar as CalendarIcon,
} from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import { CreateTaskDialog } from "@/components/create-task-dialog"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { toIsoDateLocal } from "@/lib/due-date-utils"

function dueDatesByDayForMonth(
  tasks: { dueDate?: string }[],
  year: number,
  monthIndex: number
): Map<number, number> {
  const map = new Map<number, number>()
  for (const t of tasks) {
    if (!t.dueDate) continue
    const parts = t.dueDate.split("-").map(Number)
    if (parts.length !== 3 || parts.some(Number.isNaN)) continue
    const [y, m, d] = parts
    if (y === year && m - 1 === monthIndex) {
      map.set(d, (map.get(d) ?? 0) + 1)
    }
  }
  return map
}

export function MiniCalendar() {
  const { tasks } = useWorkspace()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)

  const y = currentDate.getFullYear()
  const monthIndex = currentDate.getMonth()

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i)

  const dueByDay = useMemo(
    () => dueDatesByDayForMonth(tasks, y, monthIndex),
    [tasks, y, monthIndex]
  )

  const todayIso = toIsoDateLocal(new Date())

  const tasksForSelectedDay = useMemo(() => {
    if (!selectedDayIso) return []
    return tasks.filter((t) => t.dueDate === selectedDayIso)
  }, [tasks, selectedDayIso])

  const detailTask = useMemo(
    () => (detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null),
    [tasks, detailTaskId]
  )

  const handlePrevMonth = () => {
    setCurrentDate(new Date(y, monthIndex - 1))
    setSelectedDayIso(null)
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(y, monthIndex + 1))
    setSelectedDayIso(null)
  }

  const selectDay = (day: number) => {
    const iso = toIsoDateLocal(new Date(y, monthIndex, day))
    setSelectedDayIso((prev) => (prev === iso ? null : iso))
    setDetailTaskId(null)
  }

  const taskDueDaysInMonth = dueByDay.size

  const selectedLabel = selectedDayIso
    ? new Date(
        Number(selectedDayIso.slice(0, 4)),
        Number(selectedDayIso.slice(5, 7)) - 1,
        Number(selectedDayIso.slice(8, 10))
      ).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarBlank size={16} />
            {monthName}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              className="h-7 w-7 p-0"
              type="button"
              aria-label="Previous month"
            >
              <CaretLeft size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              className="h-7 w-7 p-0"
              type="button"
              aria-label="Next month"
            >
              <CaretRight size={14} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="py-1 text-center text-xs font-semibold text-muted-foreground"
            >
              {day.slice(0, 1)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="h-8" />
          ))}
          {days.map((day) => {
            const n = dueByDay.get(day) ?? 0
            const iso = toIsoDateLocal(new Date(y, monthIndex, day))
            const isSelected = selectedDayIso === iso
            const isToday = iso === todayIso
            return (
              <button
                key={day}
                type="button"
                onClick={() => selectDay(day)}
                aria-pressed={isSelected}
                aria-label={
                  n > 0
                    ? `${day} — ${n} task${n === 1 ? "" : "s"} due`
                    : `${monthName.split(" ")[0]} ${day}`
                }
                className={`relative flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                } ${isToday && !isSelected ? "ring-1 ring-primary/60" : ""}`}
              >
                {day}
                {n > 0 && (
                  <div
                    className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                      isSelected ? "bg-primary-foreground" : "bg-primary"
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>

        {selectedDayIso && selectedLabel && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground">{selectedLabel}</p>
            {tasksForSelectedDay.length > 0 ? (
              <ul className="max-h-28 space-y-1 overflow-y-auto text-xs">
                {tasksForSelectedDay.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="w-full truncate text-left text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      onClick={() => setDetailTaskId(t.id)}
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No tasks due this day.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={14} />
                Add task
              </Button>
              <Link
                href={`/calendar?date=${selectedDayIso}`}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs/5 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <CalendarIcon size={14} />
                Open in calendar
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-1 pt-2 text-center text-xs text-muted-foreground">
          <p>Today: {new Date().toLocaleDateString()}</p>
          <p>
            {taskDueDaysInMonth === 0
              ? "No task due dates this month"
              : `${taskDueDaysInMonth} day(s) with tasks due`}
          </p>
          {!selectedDayIso && (
            <p className="text-[11px]">Select a day for quick add and links.</p>
          )}
        </div>
      </CardContent>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDueDate={selectedDayIso ?? undefined}
      />
      <TaskDetailDialog
        task={detailTask}
        open={detailTaskId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTaskId(null)
        }}
      />
    </Card>
  )
}
