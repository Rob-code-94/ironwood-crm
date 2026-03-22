"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCrmAssistantUi } from "@/components/crm-assistant-provider"

export type { CreatedCommandTask } from "@/lib/crm-assistant-chat"

/** Settings chrome for the global CRM assistant (thread lives in the right sidebar). */
export function ChatInterface() {
  const { resetThread } = useCrmAssistantUi()

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="shrink-0 space-y-0 border-b bg-muted/15 py-4">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">CRM Assistant</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={resetThread}>
            New Thread
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 text-sm text-muted-foreground">
        <p>
          Messages and composer are in the <strong className="text-foreground">right panel</strong>.
          Use the header button to show or hide it, or drag the handle to resize.
        </p>
        <p>
          The assistant automatically detects when you want to create tasks or projects. Just ask naturally
          (e.g., <strong className="text-foreground">"create a task"</strong>) and it will ask for confirmation
          before taking action.
        </p>
        <p>
          <strong className="text-foreground">New Thread</strong> clears the chat history for this assistant.
          Configure API keys and system prompts in{" "}
          <a href="/assistant/settings" className="underline hover:text-foreground">
            AI Settings
          </a>.
        </p>
      </CardContent>
    </Card>
  )
}
