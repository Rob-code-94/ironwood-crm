/**
 * Resolve Google Gemini API key: env first, then optional httpOnly session cookie
 * (set via POST /api/ai/session-key for local/dev convenience).
 */
export function getGoogleApiKeyFromRequest(req: Request): string | undefined {
  return getGoogleApiKeyWithSource(req).apiKey
}

export function getGoogleApiKeyWithSource(req: Request): {
  apiKey?: string
  source: "env_google_api_key" | "env_google_generative_ai_api_key" | "env_gemini_api_key" | "session_cookie" | "none"
} {
  // Accept common env names (tutorials often use GEMINI_API_KEY; Google docs vary).
  const envCandidates: Array<{
    source: "env_google_api_key" | "env_google_generative_ai_api_key" | "env_gemini_api_key"
    value: string | undefined
  }> = [
    { source: "env_google_api_key", value: process.env.GOOGLE_API_KEY },
    { source: "env_google_generative_ai_api_key", value: process.env.GOOGLE_GENERATIVE_AI_API_KEY },
    { source: "env_gemini_api_key", value: process.env.GEMINI_API_KEY },
  ]
  for (const candidate of envCandidates) {
    const trimmed = candidate.value?.trim()
    if (trimmed) return { apiKey: trimmed, source: candidate.source }
  }
  const cookie = req.headers.get("cookie") ?? ""
  const m = cookie.match(/(?:^|;\s*)iw_gemini_key=([^;]*)/)
  if (!m?.[1]) return { source: "none" }
  try {
    const decoded = decodeURIComponent(m[1].trim())
    if (!decoded) return { source: "none" }
    return { apiKey: decoded, source: "session_cookie" }
  } catch {
    return { source: "none" }
  }
}
