import { GoogleGenerativeAI } from "@google/generative-ai"
import type { CrmAiModelId } from "@/lib/crm-ai-settings"

export type ParsedCommandTask = {
  title: string
  dueDate?: string
  description?: string
}

export type ParsedCommandProject = {
  name: string
  description?: string
  color?: string
  category?: string
}

export type ExecuteCommandResult = {
  success: boolean
  commandType: string
  tasks: ParsedCommandTask[]
  projects: ParsedCommandProject[]
  message: string
  raw?: string
}

const COMMAND_PARSE_PROMPT = `You are Ironwood Planner's command parser. The app has projects, tasks, CRM (contacts, companies, deals), documents, and tools. Given a natural language command, respond with ONLY valid JSON (no markdown, no code fences) matching this shape:
{
  "commandType": "create-tasks" | "create-project" | "format-document" | "generate-report" | "unknown",
  "tasks": [ { "title": string, "dueDate"?: string (ISO YYYY-MM-DD if known), "description"?: string } ],
  "projects": [ { "name": string, "description"?: string, "color"?: string (CSS hex like #6366f1), "category"?: string } ],
  "message": string (short human summary)
}
Rules:
- If the user asks to create tasks, fill "tasks" with concrete titles; use "create-tasks".
- If they ask to create or add a project (or multiple), fill "projects" with names; use "create-project".
- If both apply, use the most specific commandType and fill both arrays as needed.
- Use "unknown" and empty arrays only when nothing actionable is requested.`

export async function parseCommandWithGemini(options: {
  apiKey: string
  model: CrmAiModelId
  command: string
  commandTypeHint?: string
  signal?: AbortSignal
}): Promise<ExecuteCommandResult> {
  const genAI = new GoogleGenerativeAI(options.apiKey)
  const model = genAI.getGenerativeModel({
    model: options.model,
    systemInstruction: COMMAND_PARSE_PROMPT,
  })

  const hint = options.commandTypeHint
    ? `Preferred command type hint: ${options.commandTypeHint}\n`
    : ""

  const res = await model.generateContent(`${hint}Command:\n${options.command}`, {
    signal: options.signal,
  })

  const raw = res.response.text().trim()
  try {
    const json = JSON.parse(raw) as {
      commandType?: string
      tasks?: ParsedCommandTask[]
      projects?: ParsedCommandProject[]
      message?: string
    }
    const tasks = Array.isArray(json.tasks)
      ? json.tasks
          .filter((t) => t && typeof t.title === "string" && t.title.trim())
          .map((t) => ({
            title: t.title.trim(),
            dueDate: typeof t.dueDate === "string" ? t.dueDate : undefined,
            description: typeof t.description === "string" ? t.description : undefined,
          }))
      : []

    const projects = Array.isArray(json.projects)
      ? json.projects
          .filter((p) => p && typeof p.name === "string" && p.name.trim())
          .map((p) => ({
            name: p.name.trim(),
            description: typeof p.description === "string" ? p.description : undefined,
            color: typeof p.color === "string" ? p.color : undefined,
            category: typeof p.category === "string" ? p.category : undefined,
          }))
      : []

    const commandType = typeof json.commandType === "string" ? json.commandType : "unknown"
    const actionable =
      commandType !== "unknown" && (tasks.length > 0 || projects.length > 0)

    return {
      success: actionable,
      commandType,
      tasks,
      projects,
      message: typeof json.message === "string" ? json.message : "Parsed command.",
      raw,
    }
  } catch {
    return {
      success: false,
      commandType: "unknown",
      tasks: [],
      projects: [],
      message: "Could not parse model output as JSON.",
      raw,
    }
  }
}
