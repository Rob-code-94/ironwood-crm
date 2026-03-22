/**
 * Generic revenue / scenario calculator config.
 * Swap or extend this data for different businesses without changing the calculator UI.
 */
export type CalculatorRateOption = {
  id: string
  label: string
  description: string
  /** Base unit used in formula (e.g. hourly rate) */
  unitRate: number
  unitLabel: string
}

export type CalculatorSlider = {
  id: string
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
  /** Multiply weekly result by this factor (e.g. vehicles, multiload) */
  multiplierRole: "primary" | "secondary"
}

export const defaultCalculatorConfig = {
  title: "Scenario calculator",
  description:
    "Pick a base rate and adjust sliders. Replace options in calculator-config.ts for your own pricing model.",
  rateOptions: [
    {
      id: "a",
      label: "Standard hourly",
      description: "Example baseline rate",
      unitRate: 32,
      unitLabel: "/hr",
    },
    {
      id: "b",
      label: "Premium hourly",
      description: "Higher complexity or specialty work",
      unitRate: 62,
      unitLabel: "/hr",
    },
    {
      id: "c",
      label: "Flat trip equivalent",
      description: "Treated as hourly equivalent for math",
      unitRate: 55,
      unitLabel: "/hr eq.",
    },
    {
      id: "d",
      label: "Escort / premium trip",
      description: "Higher touch service",
      unitRate: 90,
      unitLabel: "/hr eq.",
    },
  ] satisfies CalculatorRateOption[],
  sliders: [
    {
      id: "hours",
      label: "Hours per week",
      min: 10,
      max: 80,
      step: 1,
      defaultValue: 40,
      multiplierRole: "primary",
    },
    {
      id: "units",
      label: "Parallel units (e.g. vehicles)",
      min: 1,
      max: 10,
      step: 1,
      defaultValue: 1,
      multiplierRole: "secondary",
    },
    {
      id: "efficiency",
      label: "Efficiency / load factor",
      min: 1,
      max: 4,
      step: 0.5,
      defaultValue: 1,
      multiplierRole: "secondary",
    },
  ] satisfies CalculatorSlider[],
}

export function computeWeeklyTotal(
  unitRate: number,
  sliderValues: Record<string, number>,
  sliders: CalculatorSlider[]
): number {
  let hours = 40
  let mult = 1
  for (const s of sliders) {
    const v = sliderValues[s.id] ?? s.defaultValue
    if (s.multiplierRole === "primary") hours = v
    else mult *= v
  }
  return unitRate * hours * mult
}
