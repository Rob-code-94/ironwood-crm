"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/** Entry point for CRM assistant help text (chat UI is on the AI assistant page). */
export function ChatInterface() {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="shrink-0 space-y-0 border-b bg-muted/15 py-4">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">CRM Assistant</CardTitle>
          <Button variant="outline" size="sm" render={<Link href="/assistant" />}>
            Open AI assistant
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 text-sm text-muted-foreground">
        <p>
          Configure your API key, agents, and prompts on the{" "}
          <Link href="/assistant" className="font-medium text-foreground underline hover:text-foreground">
            AI assistant
          </Link>{" "}
          page. The assistant can create tasks and projects when you ask in natural language.
        </p>
        <p>
          For model and key setup, use{" "}
          <Link href="/assistant/settings" className="underline hover:text-foreground">
            AI assistant settings
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  )
}
