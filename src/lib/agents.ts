import type { CrmAiModelId } from "@/lib/crm-ai-settings"
import { DEFAULT_CRM_MODEL } from "@/lib/crm-ai-settings"

export type Agent = {
  id: string
  name: string
  model: CrmAiModelId
  systemPrompt: string
  createdAt: string
}

const AGENTS_KEY = "ironwood_agents"
const ACTIVE_AGENT_KEY = "ironwood_active_agent"

export function getStoredAgents(): Agent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(AGENTS_KEY)
    return raw ? (JSON.parse(raw) as Agent[]) : []
  } catch {
    return []
  }
}

export function setStoredAgents(agents: Agent[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(AGENTS_KEY, JSON.stringify(agents))
}

export function getActiveAgentId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_AGENT_KEY)
}

export function setActiveAgentId(id: string | null): void {
  if (typeof window === "undefined") return
  if (id === null) {
    localStorage.removeItem(ACTIVE_AGENT_KEY)
  } else {
    localStorage.setItem(ACTIVE_AGENT_KEY, id)
  }
}

export function getActiveAgent(): Agent | null {
  const id = getActiveAgentId()
  if (!id) return null
  const agents = getStoredAgents()
  return agents.find((a) => a.id === id) ?? null
}

export function createAgent(data: Omit<Agent, "id" | "createdAt">): Agent {
  const agent: Agent = {
    ...data,
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
  }
  const agents = getStoredAgents()
  setStoredAgents([...agents, agent])
  return agent
}

export function updateAgent(id: string, data: Partial<Omit<Agent, "id" | "createdAt">>): void {
  const agents = getStoredAgents()
  setStoredAgents(agents.map((a) => (a.id === id ? { ...a, ...data } : a)))
}

export function deleteAgent(id: string): void {
  const agents = getStoredAgents()
  setStoredAgents(agents.filter((a) => a.id !== id))
  if (getActiveAgentId() === id) setActiveAgentId(null)
}

