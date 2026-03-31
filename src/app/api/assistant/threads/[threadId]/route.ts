import { NextResponse } from "next/server"
import {
  deleteThreadPersistent,
  getThreadPersistent,
  updateThreadPersistent,
} from "@/lib/assistant/thread-store"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params
  const thread = await getThreadPersistent(threadId)
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    status: thread.status,
    remoteId: thread.remoteId,
    title: thread.title,
    externalId: undefined,
    ...(thread.repository !== undefined ? { repository: thread.repository } : {}),
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params
  const body = (await req.json().catch(() => ({}))) as {
    title?: string
    status?: string
    repository?: unknown
  }
  const ok = await updateThreadPersistent(threadId, {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.status === "regular" || body.status === "archived"
      ? { status: body.status }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(body, "repository")
      ? { repository: body.repository as unknown | null }
      : {}),
  })
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params
  await deleteThreadPersistent(threadId)
  return NextResponse.json({ ok: true })
}
