"use client"

import { Button } from "@/components/ui/button"
import { DUE_DATE_QUICK_PRESETS } from "@/lib/due-date-utils"

type DueDateQuickChipsProps = {
  value: string
  onChange: (iso: string) => void
  className?: string
}

export function DueDateQuickChips({ value, onChange, className }: DueDateQuickChipsProps) {
  return (
    <div className={className ?? "flex flex-wrap gap-1.5 pt-1"}>
      {DUE_DATE_QUICK_PRESETS.map((p) => {
        const iso = p.getIso()
        const active = value === iso
        return (
          <Button
            key={p.label}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onChange(iso)}
          >
            {p.label}
          </Button>
        )
      })}
    </div>
  )
}
