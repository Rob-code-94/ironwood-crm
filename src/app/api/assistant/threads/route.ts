import { NextResponse } from "next/server"
import { createThread, listThreads } from "@/lib/assistant/thread-store"

export async function GET() {
  const threads = listThreads()
    .filter((t) => t.status !== "archived")
    .map((t) => ({
      status: t.status,
      remoteId: t.remoteId,
      title: t.title,
      externalId: undefined,
    }))
  return NextResponse.json({ threads })
}

export async function POST() {
  const thread = createThread()
  return NextResponse.json({ remoteId: thread.remoteId, externalId: undefined })
}
