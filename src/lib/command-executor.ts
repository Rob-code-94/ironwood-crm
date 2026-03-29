import { GoogleGenerativeAI } from "@google/generative-ai"
import type { CrmAiModelId } from "@/lib/crm-ai-settings"

export type ParsedCommandTaskLink = {
  label: string
  href: string
}

export type ParsedCommandTask = {
  title: string
  dueDate?: string
  description?: string
  /** Group in UI (e.g. document section / phase name) */
  section?: string
  links?: ParsedCommandTaskLink[]
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

const COMMAND_PARSE_PROMPT = `You are Ironwood Planner's command parser. The app has projects, tasks, CRM (contacts, companies, deals), documents, and tools. Given a natural language command (often including pasted document or page text), respond with ONLY valid JSON (no markdown, no code fences) matching this shape:
{
  "commandType": "create-tasks" | "create-project" | "format-document" | "generate-report" | "unknown",
  "tasks": [ {
    "title": string,
    "dueDate"?: string (ISO YYYY-MM-DD if known),
    "description"?: string,
    "section"?: string (checklist group / phase / category from the source, e.g. "Broker Applications"),
    "links"?: [ { "label": string, "href": string } ] (urls as https://..., phone as tel:+1..., email as mailto:)
  } ],
  "projects": [ { "name": string, "description"?: string, "color"?: string (CSS hex like #6366f1), "category"?: string } ],
  "message": string (short human summary)
}
Rules:
- From briefs, specs, HTML, or markdown: infer a sensible project name/description when the user wants a project; use "create-project" for projects only, "create-tasks" for tasks only, or the most specific type when both are requested.
- Map obvious groupings (headings, phases, tables) to task "section". Put portal URLs, phones, and emails in "links" when tied to a task.
- If the user asks to create tasks, fill "tasks" with concrete titles; use "create-tasks".
- If they ask to create or add a project (or multiple), fill "projects" with names; use "create-project".
- If both apply, fill both arrays; prefer "create-project" as commandType when a new container is the primary goal, else "create-tasks".
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
          .map((t) => {
            const rawLinks = Array.isArray(t.links) ? t.links : []
            const links = rawLinks
              .filter(
                (l) =>
                  l &&
                  typeof l.label === "string" &&
                  l.label.trim() &&
                  typeof l.href === "string" &&
                  l.href.trim()
              )
              .map((l) => ({ label: l.label.trim(), href: l.href.trim() }))
            return {
              title: t.title.trim(),
              dueDate: typeof t.dueDate === "string" ? t.dueDate : undefined,
              description: typeof t.description === "string" ? t.description : undefined,
              section: typeof t.section === "string" && t.section.trim() ? t.section.trim() : undefined,
              links: links.length ? links : undefined,
            }
          })
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
