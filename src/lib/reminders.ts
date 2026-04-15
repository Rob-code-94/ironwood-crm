import type {
  CalendarEvent,
  NotificationPreferences,
  PlannerNotification,
  ReminderConfig,
  Task,
} from "@/lib/types"

type ReminderSource = {
  sourceType: "task" | "event"
  sourceId: string
  title: string
  date: string
  time?: string
  reminders?: ReminderConfig[]
}

function toLocalTimestamp(date: string, time?: string): number {
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    return new Date(`${date}T${time}:00`).getTime()
  }
  return new Date(`${date}T09:00:00`).getTime()
}

function leadLabel(minutesBefore: number): string {
  if (minutesBefore === 0) return "now"
  if (minutesBefore < 60) return `${minutesBefore}m`
  if (minutesBefore % 60 === 0) return `${minutesBefore / 60}h`
  return `${Math.floor(minutesBefore / 60)}h ${minutesBefore % 60}m`
}

function notificationKey(
  sourceType: "task" | "event",
  sourceId: string,
  reminderId: string,
  sourceDate: string
) {
  return `${sourceType}:${sourceId}:${sourceDate}:${reminderId}`
}

function notificationMessage(source: ReminderSource, minutesBefore: number): string {
  if (source.sourceType === "task") {
    if (minutesBefore === 0) return `Task due today (${source.date}).`
    return `Task due in ${leadLabel(minutesBefore)} (${source.date}).`
  }
  if (minutesBefore === 0) return `Event starts now (${source.date}).`
  return `Event starts in ${leadLabel(minutesBefore)} (${source.date}).`
}

export function defaultReminderConfig(minutesBefore: number): ReminderConfig[] {
  return [
    {
      id: crypto.randomUUID(),
      minutesBefore: Math.max(0, Math.floor(minutesBefore)),
      channels: ["in_app", "push"],
    },
  ]
}

export function deriveReminderSources(tasks: Task[], events: CalendarEvent[]): ReminderSource[] {
  const taskRows: ReminderSource[] = tasks
    .filter((task) => Boolean(task.dueDate))
    .map((task) => ({
      sourceType: "task" as const,
      sourceId: task.id,
      title: task.title,
      date: task.dueDate ?? "",
      reminders: task.reminders,
    }))
  const eventRows: ReminderSource[] = events.map((event) => ({
    sourceType: "event" as const,
    sourceId: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    reminders: event.reminders,
  }))
  return [...taskRows, ...eventRows]
}

function expandRecurringDates(baseDate: string, recurrence?: { frequency: string }): string[] {
  if (!recurrence) return [baseDate]
  const start = new Date(`${baseDate}T12:00:00`)
  if (Number.isNaN(start.getTime())) return [baseDate]
  const values: string[] = [baseDate]
  for (let i = 1; i <= 3; i += 1) {
    const next = new Date(start)
    if (recurrence.frequency === "daily") next.setDate(start.getDate() + i)
    else if (recurrence.frequency === "weekly") next.setDate(start.getDate() + i * 7)
    else if (recurrence.frequency === "monthly") next.setMonth(start.getMonth() + i)
    else continue
    values.push(next.toISOString().slice(0, 10))
  }
  return values
}

export function collectDueNotifications(
  tasks: Task[],
  events: CalendarEvent[],
  existing: PlannerNotification[],
  preferences: NotificationPreferences,
  now = Date.now()
): PlannerNotification[] {
  const existingIds = new Set(existing.map((n) => n.id))
  const next: PlannerNotification[] = []
  for (const source of deriveReminderSources(tasks, events)) {
    const reminderRows = source.reminders?.length
      ? source.reminders
      : defaultReminderConfig(preferences.defaultReminderMinutesBefore)
    const baseDates = expandRecurringDates(
      source.date,
      tasks.find((task) => task.id === source.sourceId)?.recurrence ??
        events.find((event) => event.id === source.sourceId)?.recurrence
    )
    for (const sourceDate of baseDates) {
      const baseTime = toLocalTimestamp(sourceDate, source.time)
      for (const reminder of reminderRows) {
        const minutes = Math.max(0, Math.floor(reminder.minutesBefore))
        const triggerAt = baseTime - minutes * 60_000
        const activeAt = reminder.snoozedUntil
          ? new Date(reminder.snoozedUntil).getTime()
          : triggerAt
        if (now < activeAt) continue
        if (reminder.dismissedAt) continue
        const id = notificationKey(source.sourceType, source.sourceId, reminder.id, sourceDate)
        if (existingIds.has(id)) continue
        next.push({
          id,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          sourceDate,
          title: source.title,
          message: notificationMessage({ ...source, date: sourceDate }, minutes),
          scheduledAt: new Date(triggerAt).toISOString(),
          createdAt: new Date(now).toISOString(),
          read: false,
        })
      }
    }
  }
  return next
}

export function withReminderSnoozedUntil(
  reminder: ReminderConfig,
  snoozeMinutes: number,
  now = Date.now()
): ReminderConfig {
  return {
    ...reminder,
    snoozedUntil: new Date(now + Math.max(1, snoozeMinutes) * 60_000).toISOString(),
    dismissedAt: undefined,
  }
}

export function toGoogleCalendarUrl(input: {
  title: string
  description?: string
  date: string
  time?: string
}) {
  const start = input.time ? `${input.date.replaceAll("-", "")}T${input.time.replace(":", "")}00` : input.date.replaceAll("-", "")
  const end = input.time ? `${input.date.replaceAll("-", "")}T${input.time.replace(":", "")}59` : input.date.replaceAll("-", "")
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${start}/${end}`,
    details: input.description ?? "",
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildIcsFileContent(input: {
  uid: string
  title: string
  description?: string
  date: string
  time?: string
}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  const dtStart = input.time
    ? `${input.date.replaceAll("-", "")}T${input.time.replace(":", "")}00`
    : input.date.replaceAll("-", "")
  const dtEnd = input.time
    ? `${input.date.replaceAll("-", "")}T${input.time.replace(":", "")}59`
    : input.date.replaceAll("-", "")
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ironwood Planner//EN",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${input.title.replaceAll("\n", " ")}`,
    `DESCRIPTION:${(input.description ?? "").replaceAll("\n", "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n")
}
