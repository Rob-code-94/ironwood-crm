"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  computeWeeklyTotal,
  defaultCalculatorConfig,
} from "@/lib/tools/calculator-config"
import { Calculator } from "@phosphor-icons/react/dist/ssr"

export default function ToolsCalculatorPage() {
  const cfg = defaultCalculatorConfig
  const [rateId, setRateId] = useState(cfg.rateOptions[0]?.id ?? "")
  const [sliderValues, setSliderValues] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    for (const s of cfg.sliders) m[s.id] = s.defaultValue
    return m
  })

  const selected = cfg.rateOptions.find((r) => r.id === rateId) ?? cfg.rateOptions[0]
  const weekly = useMemo(
    () =>
      selected
        ? computeWeeklyTotal(selected.unitRate, sliderValues, cfg.sliders)
        : 0,
    [selected, sliderValues, cfg.sliders]
  )

  const monthly = Math.round(weekly * 4.3)
  const annual = Math.round(weekly * 52)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Calculator size={28} className="text-muted-foreground" />
          {cfg.title}
        </h1>
        <p className="text-muted-foreground mt-1">{cfg.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base rate</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {cfg.rateOptions.map((r) => (
            <Button
              key={r.id}
              type="button"
              variant={rateId === r.id ? "default" : "outline"}
              size="sm"
              className="h-auto py-2 px-3 flex-col items-start text-left"
              onClick={() => setRateId(r.id)}
            >
              <span className="font-medium">{r.label}</span>
              <span className="text-xs opacity-80 font-normal">
                ${r.unitRate}
                {r.unitLabel}
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {cfg.sliders.map((s) => (
            <div key={s.id} className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>{s.label}</Label>
                <span className="text-muted-foreground font-medium">
                  {sliderValues[s.id] ?? s.defaultValue}
                </span>
              </div>
              <input
                type="range"
                className="w-full accent-primary"
                min={s.min}
                max={s.max}
                step={s.step}
                value={sliderValues[s.id] ?? s.defaultValue}
                onChange={(e) =>
                  setSliderValues((prev) => ({
                    ...prev,
                    [s.id]: Number(e.target.value),
                  }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Weekly", value: weekly },
          { label: "Monthly (~4.3×)", value: monthly },
          { label: "Annual (×52)", value: annual },
        ].map((row) => (
          <Card key={row.label}>
            <CardContent className="pt-6 text-center">
              <p className="text-xs text-muted-foreground font-medium">{row.label}</p>
              <p className="text-xl font-bold text-primary mt-1">
                ${row.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
