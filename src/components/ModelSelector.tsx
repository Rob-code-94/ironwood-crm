"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CRM_AI_MODEL_LABELS,
  CRM_AI_MODELS,
  type CrmAiModelId,
} from "@/lib/crm-ai-settings"

type ModelSelectorProps = {
  value: CrmAiModelId
  onChange: (model: CrmAiModelId) => void
  id?: string
}

export function ModelSelector({ value, onChange, id }: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Gemini model</Label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v && (CRM_AI_MODELS as readonly string[]).includes(v)) {
            onChange(v as CrmAiModelId)
          }
        }}
      >
        <SelectTrigger id={id} className="w-full max-w-md">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          {CRM_AI_MODELS.map((m) => (
            <SelectItem key={m} value={m}>
              <div className="flex flex-col gap-0.5 py-0.5">
                <span>{CRM_AI_MODEL_LABELS[m]}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{m}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
