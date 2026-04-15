import { NextResponse } from "next/server"

export const runtime = "nodejs"

type DispatchPayload = {
  title?: string
  body?: string
}

export async function POST(req: Request) {
  let payload: DispatchPayload = {}
  try {
    payload = (await req.json()) as DispatchPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }
  const title = payload.title?.trim()
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 422 })
  }
  return NextResponse.json({
    ok: true,
    mode: "fallback-client",
    title,
    body: payload.body?.trim() ?? "",
  })
}
