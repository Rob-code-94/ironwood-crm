import { NextResponse } from "next/server"
import { getGoogleApiKeyFromRequest } from "@/lib/ai-request"
import { resolveGeminiModel } from "@/lib/gemini-client"
import { parseCommandWithGemini } from "@/lib/command-executor"

type Body = {
  command?: string
  commandType?: string
  model?: string
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

  try {
    const parsed = await parseCommandWithGemini({
      apiKey,
      model,
      command,
      commandTypeHint: typeof body.commandType === "string" ? body.commandType : undefined,
      signal: req.signal,
    })

    const tasks = parsed.tasks.map((t) => ({
      id: `task-${crypto.randomUUID()}`,
      title: t.title,
      dueDate: t.dueDate,
      description: t.description,
      section: t.section,
      links: t.links,
    }))

    const projects = parsed.projects.map((p) => ({
      id: `project-${crypto.randomUUID()}`,
      name: p.name,
      description: p.description,
      color: p.color,
      category: p.category,
    }))

    return NextResponse.json({
      success: parsed.success,
      tasks,
      projects,
      message: parsed.message,
      commandType: parsed.commandType,
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
