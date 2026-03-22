"use client"

import { useMemo, useState } from "react"
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
import { CalendarPlus } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"

type CalEvent = {
  id: string
  title: string
  date: Date
  time: string
  status: string
  description?: string
}

export default function CalendarPage() {
  const { tasks } = useWorkspace()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [events, setEvents] = useState<CalEvent[]>([])
  const [newEvent, setNewEvent] = useState({
    title: "",
    time: "",
    description: "",
  })

  const taskEvents = useMemo((): CalEvent[] => {
    return tasks
      .filter((t) => t.dueDate)
      .map((t) => ({
        id: `task-${t.id}`,
        title: t.title,
        date: new Date(`${t.dueDate}T12:00:00`),
        time: "Due date",
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

  const allEvents = useMemo(() => [...events, ...taskEvents], [events, taskEvents])

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault()
    if (date && newEvent.title) {
      const event: CalEvent = {
        id: Date.now().toString(),
        title: newEvent.title,
        date,
        time: newEvent.time || "10:00 AM",
        status: "medium",
        description: newEvent.description,
      }
      setEvents((prev) => [...prev, event])
      setNewEvent({ title: "", time: "", description: "" })
    }
  }

  const selectedDateEvents = allEvents.filter(
    (event) =>
      event.date.toDateString() === date?.toDateString()
  )

  const statusColor: Record<string, string> = {
    urgent: "destructive",
    high: "default",
    medium: "secondary",
    low: "outline",
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-1">Your events and task due dates from the workspace</p>
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
            <Dialog>
              <DialogTrigger
                render={
                  <Button variant="default" className="w-full mt-4 gap-2" />
                }
              >
                <CalendarPlus size={16} />
                Add Event
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create Event</DialogTitle>
                  <DialogDescription>
                    Add a new event to your calendar for{" "}
                    {date?.toLocaleDateString()}
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

                  <div className="flex gap-3 justify-end pt-4">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                    <Button type="submit">Create Event</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-4">
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
                      className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
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
                          <p className="text-sm text-muted-foreground mb-2">
                            {event.time}
                          </p>
                          {event.description && (
                            <p className="text-sm text-muted-foreground">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
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
                <p className="text-sm text-muted-foreground text-center py-6">
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
                        className="flex items-start justify-between gap-4 p-3 rounded-lg border"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{event.title}</p>
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
