/**
 * Resolve Google Gemini API key: env first, then optional httpOnly session cookie
 * (set via POST /api/ai/session-key for local/dev convenience).
 */
export function getGoogleApiKeyFromRequest(req: Request): string | undefined {
  const env = process.env.GOOGLE_API_KEY?.trim()
  if (env) return env
  const cookie = req.headers.get("cookie") ?? ""
  const m = cookie.match(/(?:^|;\s*)iw_gemini_key=([^;]*)/)
  if (!m?.[1]) return undefined
  try {
    return decodeURIComponent(m[1].trim())
  } catch {
    return undefined
  }
}
