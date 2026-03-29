import { NextResponse } from "next/server"

export const maxDuration = 60

const MAX_BYTES = 2 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

type Body = {
  url?: string
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === "localhost" || h.endsWith(".local")) return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  return false
}

function isUrlAllowed(urlStr: string): { ok: true; url: URL } | { ok: false; error: string } {
  let u: URL
  try {
    u = new URL(urlStr)
  } catch {
    return { ok: false, error: "Invalid URL" }
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "Only http(s) URLs are allowed" }
  }
  if (isPrivateOrLocalHost(u.hostname)) {
    return { ok: false, error: "URL host is not allowed" }
  }
  return { ok: true, url: u }
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function readResponseBodyLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) {
    return (await res.text()).slice(0, MAX_BYTES)
  }
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > MAX_BYTES) {
        const slice = value.slice(0, Math.max(0, MAX_BYTES - (total - value.byteLength)))
        chunks.push(slice)
        break
      }
      chunks.push(value)
    }
  }
  const all = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0))
  let off = 0
  for (const c of chunks) {
    all.set(c, off)
    off += c.byteLength
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(all)
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<string | null> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: [{ type: "markdown" }],
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean
    data?: { markdown?: string | null; html?: string | null }
    error?: string
  }

  if (!res.ok || !data?.success) {
    return null
  }

  const md = data.data?.markdown
  if (typeof md === "string" && md.trim()) return md.trim()

  const html = data.data?.html
  if (typeof html === "string" && html.trim()) return stripHtmlToText(html)

  return null
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const raw = typeof body.url === "string" ? body.url.trim() : ""
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }

  const allowed = isUrlAllowed(raw)
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: 400 })
  }

  const targetUrl = allowed.url.toString()
  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim()

  if (firecrawlKey) {
    try {
      const markdown = await scrapeWithFirecrawl(targetUrl, firecrawlKey)
      if (markdown) {
        return NextResponse.json({
          success: true,
          source: "firecrawl",
          url: targetUrl,
          markdown,
        })
      }
    } catch {
      /* fall through to direct fetch */
    }
  }

  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(targetUrl, {
      signal: ac.signal,
      headers: {
        "User-Agent": "IronwoodPlanner/1.0 (workspace ingest)",
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.1",
      },
      redirect: "follow",
    })
    clearTimeout(t)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed with status ${res.status}` },
        { status: 502 }
      )
    }

    const finalUrl = res.url
    try {
      const finalAllowed = isUrlAllowed(finalUrl)
      if (!finalAllowed.ok) {
        return NextResponse.json({ error: "Redirect to disallowed host" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid redirect URL" }, { status: 400 })
    }

    const bodyText = await readResponseBodyLimited(res)
    const ct = res.headers.get("content-type") ?? ""
    const text =
      ct.includes("html") || targetUrl.toLowerCase().endsWith(".html")
        ? stripHtmlToText(bodyText)
        : bodyText.replace(/\s+/g, " ").trim()

    return NextResponse.json({
      success: true,
      source: "fetch",
      url: finalUrl,
      markdown: text,
    })
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to fetch URL",
      },
      { status: 502 }
    )
  }
}
