/**
 * Resolve Google Gemini API key: env first, then optional httpOnly session cookie
 * (set via POST /api/ai/session-key for local/dev convenience).
 */
export function getGoogleApiKeyFromRequest(req: Request): string | undefined {
  // Accept both common env names so all API routes behave consistently.
  const envCandidates = [
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ]
  for (const candidate of envCandidates) {
    const trimmed = candidate?.trim()
    if (trimmed) return trimmed
  }
  const cookie = req.headers.get("cookie") ?? ""
  const m = cookie.match(/(?:^|;\s*)iw_gemini_key=([^;]*)/)
  if (!m?.[1]) return undefined
  try {
    return decodeURIComponent(m[1].trim())
  } catch {
    return undefined
  }
}
