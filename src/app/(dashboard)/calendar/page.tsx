"use client"

import { startTransition, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CalendarPlus, Trash } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import { formatCalendarTimeLabel, toIsoDateLocal } from "@/lib/due-date-utils"
import { ReminderControls } from "@/components/reminder-controls"
import { buildIcsFileContent, toGoogleCalendarUrl } from "@/lib/reminders"
import { toast } from "sonner"

type CalEvent = {
  id: string
  title: string
  date: Date
  time: string
  rawTime?: string
  status: string
  description?: string
}

function isTaskBackedEvent(id: string) {
  return id.startsWith("task-")
}

function parseLocalDateParam(value: string | null): Date | undefined {
  if (!value?.trim()) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return undefined
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return undefined
  }
  return dt
}

export default function CalendarPage() {
  const searchParams = useSearchParams()
  const { tasks, calendarEvents, addCalendarEvent, deleteCalendarEvent } = useWorkspace()
  const dateFromQuery = searchParams.get("date")
  const parsedFromQuery = useMemo(
    () => parseLocalDateParam(dateFromQuery),
    [dateFromQuery]
  )
  const [date, setDate] = useState<Date | undefined>(() => new Date())

  useEffect(() => {
    if (!parsedFromQuery) return
    startTransition(() => {
      setDate(parsedFromQuery)
    })
  }, [parsedFromQuery])
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: "",
    time: "",
    description: "",
    inviteesRaw: "",
  })
  const [eventReminderMinutes, setEventReminderMinutes] = useState(60)
  const [eventRecurrence, setEventRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none")

  const taskEvents = useMemo((): CalEvent[] => {
    return tasks
      .filter((t) => t.dueDate)
      .map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        date: new Date(`${t.dueDate}T12:00:00`),
        time: "Due date",
        rawTime: undefined,
        status:
          t.priority === "urgent"
            ? "urgent"
            : t.priority === "high"
              ? "high"
              : "medium",
        description: t.projectName
          ? `Task · ${t.projectName}`
          : "Workspace task",
      }))
  }, [tasks])

  const storedCalEvents = useMemo((): CalEvent[] => {
    return calendarEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: new Date(`${e.date}T12:00:00`),
      time: formatCalendarTimeLabel(e.time),
      rawTime: e.time,
      status: "event",
      description: e.description,
    }))
  }, [calendarEvents])

  const allEvents = useMemo(
    () => [...storedCalEvents, ...taskEvents],
    [storedCalEvents, taskEvents]
  )

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !newEvent.title.trim()) return
    addCalendarEvent({
      title: newEvent.title.trim(),
      date: toIsoDateLocal(date),
      time: newEvent.time.trim() || undefined,
      description: newEvent.description.trim() || undefined,
      reminders: [
        {
          id: crypto.randomUUID(),
          minutesBefore: eventReminderMinutes,
          channels: ["in_app", "push"],
        },
      ],
      recurrence: eventRecurrence === "none" ? undefined : { frequency: eventRecurrence },
      invitees: newEvent.inviteesRaw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    })
    toast.success("Event saved to workspace")
    setNewEvent({ title: "", time: "", description: "", inviteesRaw: "" })
    setEventReminderMinutes(60)
    setEventRecurrence("none")
    setEventDialogOpen(false)
  }
  const exportEventToIcs = (event: CalEvent) => {
    const content = buildIcsFileContent({
      uid: event.id,
      title: event.title,
      description: event.description,
      date: toIsoDateLocal(event.date),
      time: event.rawTime,
    })
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${event.title.replace(/\s+/g, "-").toLowerCase() || "event"}.ics`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }


  const selectedDateEvents = allEvents.filter(
    (event) => event.date.toDateString() === date?.toDateString()
  )

  const statusColor: Record<string, string> = {
    urgent: "destructive",
    high: "default",
    medium: "secondary",
    low: "outline",
    event: "outline",
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-1">
          Task due dates and workspace events (saved with your data).
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
            <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
              <DialogTrigger
                render={
                  <Button variant="default" className="mt-4 w-full gap-2" type="button" />
                }
              >
                <CalendarPlus size={16} />
                Add Event
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create Event</DialogTitle>
                  <DialogDescription>
                    Add a new event for {date?.toLocaleDateString()}. It is stored in your workspace.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddEvent} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-title">Event Title</Label>
                    <Input
                      id="event-title"
                      placeholder="e.g., Team Meeting"
                      value={newEvent.title}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, title: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-time">Time</Label>
                    <Input
                      id="event-time"
                      type="time"
                      value={newEvent.time}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, time: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-description">Description</Label>
                    <Textarea
                      id="event-description"
                      placeholder="Add event details..."
                      value={newEvent.description}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                    />
                  </div>
                  <ReminderControls
                    minutesBefore={eventReminderMinutes}
                    onMinutesBeforeChange={setEventReminderMinutes}
                    recurrence={eventRecurrence}
                    onRecurrenceChange={setEventRecurrence}
                    inviteesRaw={newEvent.inviteesRaw}
                    onInviteesRawChange={(v) => setNewEvent((prev) => ({ ...prev, inviteesRaw: v }))}
                  />

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEventDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create Event</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <div className="space-y-4 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Events for {date?.toLocaleDateString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{event.title}</h3>
                            <Badge
                              variant={
                                statusColor[event.status] as
                                  | "default"
                                  | "secondary"
                                  | "outline"
                                  | "destructive"
                              }
                            >
                              {event.status}
                            </Badge>
                          </div>
                          <p className="mb-2 text-sm text-muted-foreground">{event.time}</p>
                          {event.description && (
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <a
                              href={toGoogleCalendarUrl({
                                title: event.title,
                                description: event.description,
                                date: toIsoDateLocal(event.date),
                                time: event.rawTime,
                              })}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary underline underline-offset-2"
                            >
                              Add to Google Calendar
                            </a>
                            <button
                              type="button"
                              className="text-xs text-primary underline underline-offset-2"
                              onClick={() => exportEventToIcs(event)}
                            >
                              Download Apple Calendar file
                            </button>
                          </div>
                        </div>
                        {!isTaskBackedEvent(event.id) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label="Delete event"
                            onClick={() => {
                              deleteCalendarEvent(event.id)
                              toast.success("Event removed")
                            }}
                          >
                            <Trash size={18} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No events or task due dates on this day
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              {allEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Add calendar events above or create tasks with due dates — they will show here.
                </p>
              ) : (
                <div className="space-y-3">
                  {allEvents
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .slice(0, 12)
                    .map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start justify-between gap-4 rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.date.toLocaleDateString()} · {event.time}
                          </p>
                        </div>
                        <Badge
                          variant={
                            statusColor[event.status] as
                              | "default"
                              | "secondary"
                              | "outline"
                              | "destructive"
                          }
                        >
                          {event.status}
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
