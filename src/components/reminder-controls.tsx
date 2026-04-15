"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ReminderControlsProps = {
  minutesBefore: number
  onMinutesBeforeChange: (value: number) => void
  recurrence: "none" | "daily" | "weekly" | "monthly"
  onRecurrenceChange: (value: "none" | "daily" | "weekly" | "monthly") => void
  inviteesRaw: string
  onInviteesRawChange: (value: string) => void
}

export function ReminderControls({
  minutesBefore,
  onMinutesBeforeChange,
  recurrence,
  onRecurrenceChange,
  inviteesRaw,
  onInviteesRawChange,
}: ReminderControlsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Reminder</Label>
        <Select
          value={String(minutesBefore)}
          onValueChange={(v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n >= 0) onMinutesBeforeChange(n)
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">At time of due/event</SelectItem>
            <SelectItem value="5">5 minutes before</SelectItem>
            <SelectItem value="15">15 minutes before</SelectItem>
            <SelectItem value="60">1 hour before</SelectItem>
            <SelectItem value="1440">1 day before</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Repeat</Label>
        <Select value={recurrence} onValueChange={(v) => onRecurrenceChange(v as typeof recurrence)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Does not repeat</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="invitees">Invite people (comma-separated emails)</Label>
        <Input
          id="invitees"
          value={inviteesRaw}
          onChange={(e) => onInviteesRawChange(e.target.value)}
          placeholder="teammate@example.com, partner@example.com"
        />
      </div>
    </div>
  )
}
