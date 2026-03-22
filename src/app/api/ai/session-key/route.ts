import { NextResponse } from "next/server"

type Body = {
  apiKey?: string
}

/**
 * Stores Gemini API key in an httpOnly cookie for this browser session.
 * Prefer GOOGLE_API_KEY in production; this exists so Settings can "paste key" without localStorage.
 */
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : ""
  if (!apiKey) {
    return NextResponse.json({ error: "apiKey required" }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set("iw_gemini_key", encodeURIComponent(apiKey), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set("iw_gemini_key", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  return res
}
