import { NextResponse } from "next/server"

type Body = {
  apiKey?: string
}

/** Browsers often cap cookie lifetime (~400 days); avoids the previous 30-day expiry surprise. */
const GEMINI_KEY_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400

/**
 * Stores Gemini API key in an httpOnly cookie (long-lived for local dev).
 * Prefer GOOGLE_API_KEY in .env.local so you never depend on this cookie.
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
    maxAge: GEMINI_KEY_COOKIE_MAX_AGE_SEC,
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
