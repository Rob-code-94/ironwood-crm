"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ModelSelector } from "@/components/ModelSelector"
import {
  DEFAULT_CRM_MODEL,
  getStoredCrmAiModel,
  getStoredCrmSystemPrompt,
  setStoredCrmAiModel,
  setStoredCrmSystemPrompt,
  type CrmAiModelId,
} from "@/lib/crm-ai-settings"
import { GEMINI_DOCS } from "@/lib/gemini-tools"
import { toast } from "sonner"
import { Key, Robot } from "@phosphor-icons/react"

export function CrmAiSettingsCard() {
  const [model, setModel] = useState<CrmAiModelId>(DEFAULT_CRM_MODEL)
  const [systemPrompt, setSystemPrompt] = useState("")
  const [sessionKey, setSessionKey] = useState("")

  useEffect(() => {
    setModel(getStoredCrmAiModel())
    setSystemPrompt(getStoredCrmSystemPrompt())
  }, [])

  function savePreferences() {
    setStoredCrmAiModel(model)
    setStoredCrmSystemPrompt(systemPrompt)
    toast.success("AI preferences saved (model & prompt in this browser).")
  }

  async function saveSessionKey() {
    const key = sessionKey.trim()
    if (!key) {
      toast.error("Paste an API key first.")
      return
    }
    const res = await fetch("/api/ai/session-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    })
    if (!res.ok) {
      toast.error("Could not store session key.")
      return
    }
    setSessionKey("")
    toast.success("Session key stored in an httpOnly cookie (not in localStorage).")
  }

  async function clearSessionKey() {
    await fetch("/api/ai/session-key", { method: "DELETE" })
    toast.success("Session key cleared.")
  }

  return (
    <Card className="scroll-mt-6" id="gemini-api-key">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Robot size={22} />
          AI assistant (Gemini)
        </CardTitle>
        <CardDescription>
          Prefer <code className="rounded bg-muted px-1 py-0.5 text-xs">GOOGLE_API_KEY</code> in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> (persists until you
          rotate the key at Google). Alternatively paste a key below (stored in a long-lived
          httpOnly cookie for this machine). Model and system prompt live in this browser&apos;s{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">localStorage</code>. Never commit
          keys to git — get a key from the{" "}
          <a
            className="font-medium text-foreground underline underline-offset-2"
            href={GEMINI_DOCS.quickstart}
            rel="noreferrer"
            target="_blank"
          >
            Gemini quickstart
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Alert variant="default" className="border-primary/25 bg-primary/5">
          <Key className="size-5 shrink-0 text-primary" weight="duotone" />
          <AlertTitle className="text-base">Add your Gemini API key</AlertTitle>
          <AlertDescription className="space-y-4 text-foreground/90">
            <p>
              Paste the key from{" "}
              <a
                className="font-medium underline underline-offset-2"
                href="https://aistudio.google.com/apikey"
                rel="noreferrer"
                target="_blank"
              >
                Google AI Studio
              </a>
              . It is saved in an <strong>httpOnly cookie</strong> for this browser only (not in
              localStorage and not visible to page scripts).
            </p>
            <div className="space-y-2">
              <Label htmlFor="session-gemini-key" className="text-foreground">
                Gemini API key
              </Label>
              <Input
                id="session-gemini-key"
                type="password"
                autoComplete="off"
                placeholder="AIza…"
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
                className="font-mono text-sm"
                suppressHydrationWarning
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveSessionKey}>
                Save API key
              </Button>
              <Button type="button" variant="outline" onClick={clearSessionKey}>
                Remove key from this browser
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Model &amp; instructions</h3>
            <p className="text-xs text-muted-foreground">
              Choose a model and optional system prompt, then save.
            </p>
          </div>
          <ModelSelector id="settings-crm-model" value={model} onChange={setModel} />
          <div className="space-y-2">
            <Label htmlFor="crm-system-prompt">Custom system prompt</Label>
            <Textarea
              id="crm-system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              placeholder="Optional instructions that apply to CRM chat and Advisor when using this browser…"
              className="text-sm"
            />
          </div>
          <Button type="button" variant="secondary" onClick={savePreferences}>
            Save model &amp; prompt
          </Button>
        </div>

        <Separator />
        <p className="text-xs text-muted-foreground">
          Full model list and deprecations:{" "}
          <a
            className="underline underline-offset-2"
            href={GEMINI_DOCS.models}
            rel="noreferrer"
            target="_blank"
          >
            ai.google.dev/models
          </a>
          .
        </p>
      </CardContent>
    </Card>
  )
}
