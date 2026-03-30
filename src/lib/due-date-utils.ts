/** Local calendar date as YYYY-MM-DD (not UTC midnight — avoids TZ skew for “today”). */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function isoDateAddDaysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toIsoDateLocal(d)
}

export function isoDateAddDays(iso: string, days: number): string {
  const parts = iso.split("-").map(Number)
  const y = parts[0]
  const m = parts[1]
  const day = parts[2]
  if (!y || !m || !day) return isoDateAddDaysFromToday(days)
  const d = new Date(y, m - 1, day)
  d.setDate(d.getDate() + days)
  return toIsoDateLocal(d)
}

export function nextMondayIso(): string {
  const d = new Date()
  const day = d.getDay()
  let add = (8 - day) % 7
  if (add === 0) add = 7
  d.setDate(d.getDate() + add)
  return toIsoDateLocal(d)
}

/** Next Sunday from today (inclusive if today is Sunday). */
export function endOfWeekSundayIso(): string {
  const d = new Date()
  const day = d.getDay()
  const add = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + add)
  return toIsoDateLocal(d)
}

export type DueDatePreset = { label: string; getIso: () => string }

export const DUE_DATE_QUICK_PRESETS: DueDatePreset[] = [
  { label: "Today", getIso: () => isoDateAddDaysFromToday(0) },
  { label: "Tomorrow", getIso: () => isoDateAddDaysFromToday(1) },
  { label: "+3", getIso: () => isoDateAddDaysFromToday(3) },
  { label: "+7", getIso: () => isoDateAddDaysFromToday(7) },
  { label: "+10", getIso: () => isoDateAddDaysFromToday(10) },
  { label: "Next Mon", getIso: nextMondayIso },
  { label: "Week end", getIso: endOfWeekSundayIso },
]

/** HTML time (HH:MM) to a short display label; falls back to raw. */
export function formatCalendarTimeLabel(time?: string): string {
  if (!time?.trim()) return "All day"
  const [h, min] = time.split(":").map((x) => Number(x))
  if (!Number.isFinite(h) || !Number.isFinite(min)) return time
  const d = new Date()
  d.setHours(h, min, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}
