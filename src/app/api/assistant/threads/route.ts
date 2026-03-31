import { NextResponse } from "next/server"
import {
  createThreadPersistent,
  listThreadsPersistent,
} from "@/lib/assistant/thread-store"

export async function GET() {
  const threads = (await listThreadsPersistent())
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
  const thread = await createThreadPersistent()
  return NextResponse.json({ remoteId: thread.remoteId, externalId: undefined })
}
