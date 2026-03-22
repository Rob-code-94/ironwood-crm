"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"

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
    () =>
      dueDatesByDayForMonth(
        tasks,
        currentDate.getFullYear(),
        currentDate.getMonth()
      ),
    [tasks, currentDate]
  )

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const taskDueDaysInMonth = dueByDay.size

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarBlank size={16} />
            {monthName}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              className="h-7 w-7 p-0"
            >
              <CaretLeft size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              className="h-7 w-7 p-0"
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
              className="text-xs font-semibold text-muted-foreground text-center py-1"
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
            return (
              <button
                key={day}
                type="button"
                className="h-8 w-8 text-xs rounded-md hover:bg-muted relative flex items-center justify-center"
              >
                {day}
                {n > 0 && (
                  <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>

        <div className="text-xs text-center text-muted-foreground pt-2 space-y-1">
          <p>Today: {new Date().toLocaleDateString()}</p>
          <p>
            {taskDueDaysInMonth === 0
              ? "No task due dates this month"
              : `${taskDueDaysInMonth} day(s) with tasks due`}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
