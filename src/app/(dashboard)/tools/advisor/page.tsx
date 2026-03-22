"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace, ALL_PROJECTS_FILTER } from "@/lib/workspace/context"
import { Robot, Trash } from "@phosphor-icons/react/dist/ssr"
import { toast } from "sonner"

type ChatMessage = { role: "user" | "assistant"; content: string }

export default function ToolsAdvisorPage() {
  const {
    projects,
    selectedProjectFilterId,
    appendSavedChatTurn,
    savedChatTurns,
    clearSavedChatTurns,
  } = useWorkspace()

  const [thread, setThread] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const projectIdForContext =
    selectedProjectFilterId !== ALL_PROJECTS_FILTER
      ? selectedProjectFilterId
      : undefined

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [thread, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput("")
    const userMsg: ChatMessage = { role: "user", content: text }
    const messagesForApi = [...thread, userMsg]
    setThread(messagesForApi)
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesForApi,
          system: systemPrompt.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setThread((t) => [
          ...t,
          {
            role: "assistant",
            content:
              typeof data.error === "string"
                ? data.error
                : "Request failed.",
          },
        ])
        toast.error(typeof data.error === "string" ? data.error : "Chat failed")
        return
      }
      const reply = typeof data.text === "string" ? data.text : ""
      setThread((t) => [...t, { role: "assistant", content: reply }])
      if (reply) {
        appendSavedChatTurn({
          question: text,
          answer: reply,
          projectId: projectIdForContext,
        })
        toast.success("Saved to history")
      }
    } catch {
      setThread((t) => [
        ...t,
        { role: "assistant", content: "Network error — try again." },
      ])
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Robot size={28} className="text-muted-foreground" />
          Advisor
        </h1>
        <p className="text-muted-foreground mt-1">
          Server-side Gemini (no API key in localStorage). Set{" "}
          <code className="text-xs bg-muted px-1 rounded">GOOGLE_API_KEY</code> in{" "}
          <code className="text-xs bg-muted px-1 rounded">.env.local</code> or use Settings → AI
          assistant → session key (httpOnly cookie). History syncs with your workspace (local save).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Tag new Q&A with project (sidebar switcher)</Label>
            <p className="text-xs text-muted-foreground">
              Current:{" "}
              {projectIdForContext
                ? projects.find((p) => p.id === projectIdForContext)?.name ?? "—"
                : "All projects"}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sys">Custom system prompt (optional)</Label>
            <Textarea
              id="sys"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              placeholder="Override default assistant behavior for this session…"
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col min-h-[420px]">
        <CardHeader>
          <CardTitle className="text-base">Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-3 rounded-md border bg-muted/20 p-3 min-h-[240px]">
            {thread.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet. Ask a question below.
              </p>
            )}
            {thread.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <p className="text-xs text-muted-foreground">Thinking…</p>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something…"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            />
            <Button type="button" onClick={send} disabled={loading}>
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Saved Q&A ({savedChatTurns.length})</CardTitle>
          {savedChatTurns.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                clearSavedChatTurns()
                toast.success("History cleared")
              }}
            >
              <Trash size={14} />
              Clear
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3 max-h-[320px] overflow-y-auto">
          {savedChatTurns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved turns yet.</p>
          ) : (
            savedChatTurns.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 text-sm space-y-2">
                <p className="text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString()}
                  {t.projectId && (
                    <>
                      {" · "}
                      {projects.find((p) => p.id === t.projectId)?.name ?? t.projectId}
                    </>
                  )}
                </p>
                <p className="font-medium">{t.question}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{t.answer}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
