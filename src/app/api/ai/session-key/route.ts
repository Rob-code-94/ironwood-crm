import { NextResponse } from "next/server"

type Body = {
  apiKey?: string
}

/** Browsers often cap cookie lifetime (~400 days); avoids the previous 30-day expiry surprise. */
const GEMINI_KEY_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

/**
 * Hosted production must use secure cookies, but packaged desktop runs on
 * http://127.0.0.1:<port> and needs a non-secure cookie to be sent at all.
 */
function shouldUseSecureCookie(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return false
  try {
    const hostname = new URL(req.url).hostname
    return !isLocalhost(hostname)
  } catch {
    return true
  }
}

function hasEnvGeminiKey(): boolean {
  const envCandidates = [
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GEMINI_API_KEY,
  ]
  return envCandidates.some((candidate) => Boolean(candidate?.trim()))
}

function hasSessionGeminiCookie(req: Request): boolean {
  const cookie = req.headers.get("cookie") ?? ""
  const m = cookie.match(/(?:^|;\s*)iw_gemini_key=([^;]*)/)
  return Boolean(m?.[1]?.trim())
}

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
    secure: shouldUseSecureCookie(req),
    path: "/",
    maxAge: GEMINI_KEY_COOKIE_MAX_AGE_SEC,
  })
  return res
}

export async function DELETE(req: Request) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set("iw_gemini_key", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(req),
    path: "/",
    maxAge: 0,
  })
  return res
}

export async function GET(req: Request) {
  const hasEnvKey = hasEnvGeminiKey()
  const hasSessionCookie = hasSessionGeminiCookie(req)
  return NextResponse.json({
    ok: true,
    hasEnvKey,
    hasSessionCookie,
    effectiveSource: hasEnvKey ? "env" : hasSessionCookie ? "session_cookie" : "none",
  })
}
