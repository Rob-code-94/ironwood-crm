"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ModelSelector } from "@/components/ModelSelector"
import { CrmAiSettingsCard } from "@/components/crm-ai-settings-card"
import { useCrmAssistantUi } from "@/components/crm-assistant-provider"
import {
  getStoredAgents,
  setActiveAgentId,
  getActiveAgentId,
  createAgent,
  updateAgent,
  deleteAgent,
  type Agent,
} from "@/lib/agents"
import { DEFAULT_CRM_MODEL, type CrmAiModelId } from "@/lib/crm-ai-settings"
import { CRM_ASSISTANT_THREAD_STORAGE_KEY } from "@/lib/crm-assistant-storage"
import { Bot, PlusCircle, Trash2, Pencil, CheckCircle, MessageSquare, Sparkles, Key } from "lucide-react"
import { toast } from "sonner"

type SimpleChatMessage = { role: "user" | "assistant"; content: string }
type StoredThread = { messages?: SimpleChatMessage[] }

function ThreadSection() {
  const { resetThread } = useCrmAssistantUi()
  const [history, setHistory] = useState<SimpleChatMessage[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CRM_ASSISTANT_THREAD_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as StoredThread
        const messages = (parsed.messages ?? [])
          .filter((msg): msg is SimpleChatMessage => msg && typeof msg.content === "string")
          .slice(-10)
          .reverse()
        setHistory(messages)
      }
    } catch {}
  }, [])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4" />
          Thread Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          onClick={() => {
            resetThread()
            setHistory([])
            toast.success("Thread cleared")
          }}
        >
          New Thread
        </Button>
        {history.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Recent messages (last 10)</p>
            {history.map((msg, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 text-xs ${msg.role === "user" ? "bg-muted text-right" : "bg-primary/5"}`}>
                <span className="font-medium capitalize text-muted-foreground">{msg.role}: </span>
                {(msg.content || "").slice(0, 120)}{(msg.content || "").length > 120 ? "…" : ""}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No messages yet. Start chatting in the right panel.</p>
        )}
      </CardContent>
    </Card>
  )
}

const BLANK_FORM = { name: "", model: DEFAULT_CRM_MODEL as CrmAiModelId, systemPrompt: "" }

function AgentsSection() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(BLANK_FORM)

  useEffect(() => {
    setAgents(getStoredAgents())
    setActiveId(getActiveAgentId())
  }, [])

  function reload() {
    setAgents(getStoredAgents())
    setActiveId(getActiveAgentId())
  }

  function handleSave() {
    if (!form.name.trim()) { toast.error("Agent name required"); return }
    if (editingId) {
      updateAgent(editingId, form)
      toast.success("Agent updated")
    } else {
      createAgent(form)
      toast.success("Agent created")
    }
    setShowForm(false)
    setEditingId(null)
    setForm(BLANK_FORM)
    reload()
  }

  function handleEdit(agent: Agent) {
    setEditingId(agent.id)
    setForm({ name: agent.name, model: agent.model, systemPrompt: agent.systemPrompt })
    setShowForm(true)
  }

  function handleDelete(id: string) {
    deleteAgent(id)
    toast.success("Agent deleted")
    reload()
  }

  function handleSetActive(id: string) {
    const newId = activeId === id ? null : id
    setActiveAgentId(newId)
    setActiveId(newId)
    toast.success(newId ? "Agent activated" : "Agent deactivated")
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            Agent Presets
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(BLANK_FORM) }}>
            <PlusCircle className="size-3.5" />
            New Agent
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">{editingId ? "Edit Agent" : "New Agent"}</p>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input placeholder="e.g. Deal Analyzer" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model</Label>
              <ModelSelector value={form.model} onChange={m => setForm(f => ({ ...f, model: m as CrmAiModelId }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">System Prompt</Label>
              <Textarea
                placeholder="You are a deal analysis expert..."
                value={form.systemPrompt}
                onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); setForm(BLANK_FORM) }}>Cancel</Button>
            </div>
          </div>
        )}
        {agents.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground">No agents yet. Create one to save a named AI persona with a custom model and prompt.</p>
        )}
        {agents.map(agent => (
          <div key={agent.id} className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${activeId === agent.id ? "border-primary/40 bg-primary/5" : ""}`}>
            <Bot className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{agent.name}</span>
                <Badge variant="secondary" className="text-xs">{agent.model}</Badge>
                {activeId === agent.id && <Badge className="text-xs">Active</Badge>}
              </div>
              {agent.systemPrompt && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{agent.systemPrompt.slice(0, 80)}…</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="size-7" title={activeId === agent.id ? "Deactivate" : "Set Active"} onClick={() => handleSetActive(agent.id)}>
                <CheckCircle className={`size-3.5 ${activeId === agent.id ? "text-primary" : "text-muted-foreground"}`} />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => handleEdit(agent)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => handleDelete(agent.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function AssistantPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3">
          <Bot className="size-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Assistant</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Manage your AI assistant — configure agents, view chat history, and set up your API key. The chat panel is on the right.
        </p>
      </div>

      <ThreadSection />
      <AgentsSection />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="size-4" />
            API Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CrmAiSettingsCard />
        </CardContent>
      </Card>
    </div>
  )
}
