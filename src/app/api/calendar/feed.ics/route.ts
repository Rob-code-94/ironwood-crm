import { NextResponse } from "next/server"
import { buildWorkspaceIcsFeed } from "@/lib/reminders"
import { readWorkspaceSnapshotFromBackend } from "@/lib/workspace/snapshot-server-read"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")?.trim()
  const expectedToken = process.env.IRONWOOD_CALENDAR_FEED_TOKEN?.trim()
  if (!expectedToken || !token || token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized feed token." }, { status: 401 })
  }

  const result = await readWorkspaceSnapshotFromBackend()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const body = buildWorkspaceIcsFeed({
    tasks: result.snapshot.tasks,
    events: result.snapshot.calendarEvents ?? [],
    host: url.host,
  })

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": 'inline; filename="ironwood-feed.ics"',
    },
  })
}
