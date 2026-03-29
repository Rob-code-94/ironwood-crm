import { NextResponse } from "next/server"
import { getGoogleApiKeyFromRequest } from "@/lib/ai-request"
import { resolveGeminiModel } from "@/lib/gemini-client"
import { parseCommandWithGemini } from "@/lib/command-executor"
import type { CommandProjectCatalogEntry } from "@/lib/project-catalog"

type Body = {
  command?: string
  commandType?: string
  model?: string
  projectsCatalog?: CommandProjectCatalogEntry[]
}

function normalizeProjectsCatalog(raw: unknown): CommandProjectCatalogEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const out: CommandProjectCatalogEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === "string" ? o.id.trim() : ""
    const name = typeof o.name === "string" ? o.name.trim() : ""
    if (!id || !name) continue
    const description =
      typeof o.description === "string" && o.description.trim() ? o.description.trim() : undefined
    out.push({ id, name, description })
    if (out.length >= 200) break
  }
  return out
}

function projectLabelForTask(
  projectId: string | undefined,
  catalog: CommandProjectCatalogEntry[]
): string {
  if (!projectId) return "General"
  const hit = catalog.find((c) => c.id === projectId)
  return hit ? hit.name : "General"
}

export async function POST(req: Request) {
  const apiKey = getGoogleApiKeyFromRequest(req)
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Gemini is not configured. Set GOOGLE_API_KEY or a session key in Settings.",
      },
      { status: 503 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const command = typeof body.command === "string" ? body.command.trim() : ""
  if (!command) {
    return NextResponse.json({ error: "command string required" }, { status: 400 })
  }

  const model = resolveGeminiModel(body.model)
  const projectsCatalog = normalizeProjectsCatalog(body.projectsCatalog)

  try {
    const parsed = await parseCommandWithGemini({
      apiKey,
      model,
      command,
      commandTypeHint: typeof body.commandType === "string" ? body.commandType : undefined,
      signal: req.signal,
      ...(projectsCatalog.length > 0 ? { projectsCatalog } : {}),
    })

    const tasks = parsed.tasks.map((t) => {
      const pid =
        typeof t.projectId === "string" && t.projectId.trim() ? t.projectId.trim() : undefined
      return {
        id: `task-${crypto.randomUUID()}`,
        title: t.title,
        dueDate: t.dueDate,
        description: t.description,
        section: t.section,
        links: t.links,
        ...(projectsCatalog.length > 0
          ? {
              projectId: pid,
              projectLabel: projectLabelForTask(pid, projectsCatalog),
            }
          : {}),
      }
    })

    const projects = parsed.projects.map((p) => ({
      id: `project-${crypto.randomUUID()}`,
      name: p.name,
      description: p.description,
      color: p.color,
      category: p.category,
    }))

    const modelOutputPreview =
      !parsed.success && typeof parsed.raw === "string" && parsed.raw.trim()
        ? parsed.raw.trim().slice(0, 4000)
        : undefined

    return NextResponse.json({
      success: parsed.success,
      tasks,
      projects,
      message: parsed.message,
      commandType: parsed.commandType,
      ...(modelOutputPreview ? { modelOutputPreview } : {}),
    })
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Command failed",
        tasks: [],
        projects: [],
      },
      { status: 502 }
    )
  }
}
