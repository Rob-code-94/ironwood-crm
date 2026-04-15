import { NextResponse } from "next/server"
import { buildIcsFileContent } from "@/lib/reminders"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const title = url.searchParams.get("title")?.trim() ?? ""
  const date = url.searchParams.get("date")?.trim() ?? ""
  const description = url.searchParams.get("description")?.trim() ?? ""
  const time = url.searchParams.get("time")?.trim() ?? undefined
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "title and date (YYYY-MM-DD) are required." }, { status: 422 })
  }
  const body = buildIcsFileContent({
    uid: crypto.randomUUID(),
    title,
    description,
    date,
    time,
  })
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${title.replace(/\s+/g, "-").toLowerCase()}.ics"`,
    },
  })
}
