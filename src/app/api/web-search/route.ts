import { NextResponse } from "next/server"

type Body = {
  query?: string
  limit?: number
}

export async function POST(req: Request) {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Firecrawl is not configured. Set FIRECRAWL_API_KEY in the server environment.",
      },
      { status: 503 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const query = typeof body.query === "string" ? body.query.trim() : ""
  const limit = typeof body.limit === "number" ? body.limit : 5
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 })

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit: Math.max(1, Math.min(10, limit)),
        // Scrape results so the caller can extract structured facts like phone numbers.
        scrapeOptions: {
          formats: [{ type: "markdown" }],
        },
      }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      data?: {
        web?: Array<{
          url: string
          title?: string
          description?: string
          category?: string
          markdown?: string | null
        }>
      }
      error?: string
    }

    if (!res.ok || !data?.success || !Array.isArray(data.data?.web)) {
      return NextResponse.json(
        {
          error:
            data?.error ||
            "Firecrawl search failed. Check your FIRECRAWL_API_KEY and retry.",
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      results: data.data.web.map((r) => ({
        url: r.url,
        title: typeof r.title === "string" ? r.title : undefined,
        description: typeof r.description === "string" ? r.description : undefined,
        category: typeof r.category === "string" ? r.category : undefined,
        markdown: typeof r.markdown === "string" ? r.markdown : undefined,
      })),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Firecrawl request failed" },
      { status: 502 }
    )
  }
}

