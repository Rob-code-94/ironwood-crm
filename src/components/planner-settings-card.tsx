"use client"

import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/lib/workspace/context"
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr"

const PRESETS: { value: string; label: string }[] = [
  { value: "none", label: "No default" },
  { value: "0", label: "Today" },
  { value: "1", label: "Tomorrow" },
  { value: "3", label: "In 3 days" },
  { value: "7", label: "In 7 days" },
  { value: "10", label: "In 10 days" },
]

export function PlannerSettingsCard() {
  const {
    taskDefaultDueOffsetDays,
    setTaskDefaultDueOffsetDays,
    notificationPreferences,
    updateNotificationPreferences,
  } = useWorkspace()
  const selectValue =
    taskDefaultDueOffsetDays == null
      ? "none"
      : PRESETS.some((p) => p.value === String(taskDefaultDueOffsetDays))
        ? String(taskDefaultDueOffsetDays)
        : "none"

  useEffect(() => {
    if (
      taskDefaultDueOffsetDays != null &&
      !PRESETS.some((p) => p.value === String(taskDefaultDueOffsetDays))
    ) {
      setTaskDefaultDueOffsetDays(null)
    }
  }, [taskDefaultDueOffsetDays, setTaskDefaultDueOffsetDays])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarBlank size={18} />
          Planner and dates
        </CardTitle>
        <CardDescription>
          How dates behave in this workspace (stored locally or via workspace sync).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Task due dates and calendar event days use your browser&apos;s local calendar
          (YYYY-MM-DD). Event times are for your reference only; they are not pushed to Google
          Calendar or other services.
        </p>
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="default-due-offset">Default due date when creating a task</Label>
          <Select
            value={selectValue}
            onValueChange={(v) => {
              if (v == null) return
              if (v === "none") setTaskDefaultDueOffsetDays(null)
              else {
                const n = Number(v)
                if (Number.isFinite(n) && n >= 0 && n <= 365) setTaskDefaultDueOffsetDays(n)
              }
            }}
          >
            <SelectTrigger id="default-due-offset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">Reminder notifications</p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm">In-app reminders</p>
              <p className="text-xs text-muted-foreground">Show due reminders in the notification center.</p>
            </div>
            <Switch
              checked={notificationPreferences.inAppEnabled}
              onCheckedChange={(checked) => updateNotificationPreferences({ inAppEnabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm">Browser push-style alerts</p>
              <p className="text-xs text-muted-foreground">Display system notifications when reminders trigger.</p>
            </div>
            <Switch
              checked={notificationPreferences.pushEnabled}
              onCheckedChange={(checked) => updateNotificationPreferences({ pushEnabled: checked })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!("Notification" in window)) return
                await Notification.requestPermission()
              }}
            >
              Enable permission
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!("serviceWorker" in navigator)) return
                await navigator.serviceWorker.register("/reminder-sw.js")
              }}
            >
              Register worker
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
