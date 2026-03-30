import { GoogleGenerativeAI } from "@google/generative-ai"
import type { CrmAiModelId } from "@/lib/crm-ai-settings"
import type { CommandProjectCatalogEntry } from "@/lib/project-catalog"

export type { CommandProjectCatalogEntry } from "@/lib/project-catalog"

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
  /**
   * When a project catalog was sent: exact id from that list, or omit / null for General (no project).
   */
  projectId?: string | null
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

/** Strip ```json fences and isolate `{ ... }` when models ignore JSON-only instructions. */
function candidatesForJsonParse(raw: string): string[] {
  const out: string[] = []
  let s = raw.trim()
  out.push(s)
  if (s.startsWith("```")) {
    s = s
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim()
    out.push(s)
  }
  const start = s.indexOf("{")
  const end = s.lastIndexOf("}")
  if (start !== -1 && end > start) {
    out.push(s.slice(start, end + 1))
  }
  return [...new Set(out)]
}

function parseCommandJsonPayload(raw: string): {
  commandType?: string
  tasks?: ParsedCommandTask[]
  projects?: ParsedCommandProject[]
  message?: string
} | null {
  for (const c of candidatesForJsonParse(raw)) {
    try {
      return JSON.parse(c) as {
        commandType?: string
        tasks?: ParsedCommandTask[]
        projects?: ParsedCommandProject[]
        message?: string
      }
    } catch {
      /* try next candidate */
    }
  }
  return null
}

const COMMAND_PARSE_BASE = `You are Ironwood Planner's command parser. The app has projects, tasks, CRM (contacts, companies, deals), documents, and tools. Given a natural language command (often including pasted document or page text), respond with ONLY valid JSON (no markdown, no code fences, no commentary before or after) matching this shape:
{
  "commandType": "create-tasks" | "create-project" | "format-document" | "generate-report" | "unknown",
  "tasks": [ {
    "title": string,
    "dueDate"?: string (ISO YYYY-MM-DD if known),
    "description"?: string,
    "section"?: string (checklist group / phase / category from the source, e.g. "Broker Applications"),
    "links"?: [ { "label": string, "href": string } ] (urls as https://..., phone as tel:+1..., email as mailto:),
    "projectId"?: string | null
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

const PROJECT_PLACEMENT_RULES = `
Project placement (ONLY when the user message includes an AVAILABLE_PROJECTS_JSON block):
- For each task, set "projectId" to EXACTLY one "id" from that JSON array if the task clearly belongs to that project (match name, description, and the user's wording).
- If the task is ambiguous, cross-cutting, or does not fit one project clearly, omit "projectId" or set it to null (General — not tied to a project).
- Never invent project ids; only use ids from AVAILABLE_PROJECTS_JSON.
- In "message", briefly state which project you chose per task (or General) so the user can confirm before anything is saved.`

function catalogIdSet(catalog: CommandProjectCatalogEntry[]): Set<string> {
  return new Set(catalog.map((c) => c.id).filter((id) => typeof id === "string" && id.trim()))
}

export async function parseCommandWithGemini(options: {
  apiKey: string
  model: CrmAiModelId
  command: string
  commandTypeHint?: string
  signal?: AbortSignal
  /** Existing workspace projects — enables per-task projectId in parser output */
  projectsCatalog?: CommandProjectCatalogEntry[]
}): Promise<ExecuteCommandResult> {
  const genAI = new GoogleGenerativeAI(options.apiKey)
  const hint = options.commandTypeHint
    ? `Preferred command type hint: ${options.commandTypeHint}\n`
    : ""

  const catalog = Array.isArray(options.projectsCatalog) ? options.projectsCatalog : []
  const allowedIds = catalogIdSet(catalog)
  const systemInstruction =
    catalog.length > 0
      ? `${COMMAND_PARSE_BASE}\n${PROJECT_PLACEMENT_RULES}`
      : COMMAND_PARSE_BASE

  const userPayload =
    catalog.length > 0
      ? `${hint}AVAILABLE_PROJECTS_JSON:\n${JSON.stringify(catalog)}\n\nCommand:\n${options.command}`
      : `${hint}Command:\n${options.command}`

  async function runGenerate(useJsonMime: boolean): Promise<string> {
    const model = genAI.getGenerativeModel({
      model: options.model,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: 8192,
        ...(useJsonMime ? { responseMimeType: "application/json" } : {}),
      },
    })
    const res = await model.generateContent(userPayload, {
      signal: options.signal,
    })
    return res.response.text().trim()
  }

  let raw: string
  try {
    raw = await runGenerate(true)
  } catch {
    raw = await runGenerate(false)
  }

  try {
    const json = parseCommandJsonPayload(raw)
    if (!json || typeof json !== "object") {
      throw new Error("parse failed")
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
            const rawPid = t.projectId
            let projectId: string | undefined
            if (allowedIds.size > 0) {
              if (typeof rawPid === "string" && rawPid.trim() && allowedIds.has(rawPid.trim())) {
                projectId = rawPid.trim()
              } else if (rawPid === null || rawPid === undefined) {
                projectId = undefined
              }
            }

            return {
              title: t.title.trim(),
              dueDate: typeof t.dueDate === "string" ? t.dueDate : undefined,
              description: typeof t.description === "string" ? t.description : undefined,
              section: typeof t.section === "string" && t.section.trim() ? t.section.trim() : undefined,
              links: links.length ? links : undefined,
              ...(allowedIds.size > 0 ? { projectId } : {}),
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
    }
  } catch {
    return {
      success: false,
      commandType: "unknown",
      tasks: [],
      projects: [],
      message:
        "Could not parse model output as JSON. The reply is shown below so you can see what Gemini returned—try again, use a shorter excerpt, or paste a smaller chunk of the file.",
      raw,
    }
  }
}
