"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useCrmAssistantUi } from "@/components/crm-assistant-provider"

export type { CreatedCommandTask } from "@/lib/crm-assistant-chat"

/** Settings chrome for the global CRM assistant (thread lives in the right sidebar). */
export function ChatInterface() {
  const { commandMode, setCommandMode, resetThread } = useCrmAssistantUi()

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="shrink-0 space-y-0 border-b bg-muted/15 py-4">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">CRM assistant</CardTitle>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="cmd-mode"
                checked={commandMode}
                onCheckedChange={setCommandMode}
              />
              <Label htmlFor="cmd-mode" className="cursor-pointer text-sm font-normal">
                Command mode
              </Label>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={resetThread}>
              New thread
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 text-sm text-muted-foreground">
        <p>
          Messages and composer are in the <strong className="text-foreground">right panel</strong>.
          Use the header button to show or hide it, or drag the handle to resize.
        </p>
        <p>
          <strong className="text-foreground">Command mode</strong> parses one message at a time and
          can add <strong className="text-foreground">tasks</strong> and{" "}
          <strong className="text-foreground">projects</strong> to your workspace (same data you edit
          manually).
        </p>
        <p>
          <strong className="text-foreground">New thread</strong> clears saved chat history for this
          assistant.
        </p>
      </CardContent>
    </Card>
  )
}
