/** Client-only preferences for CRM AI (never store API keys here). */

export const CRM_AI_MODEL_KEY = "crm_ai_model"
export const CRM_AI_SYSTEM_PROMPT_KEY = "crm_ai_system_prompt"

/**
 * Text / chat / reasoning models only (no Imagen, Veo, Lyria, etc.).
 * IDs follow the public Gemini API model list; preview IDs may change—see deprecations in the docs.
 * @see https://ai.google.dev/gemini-api/docs/models
 */
export const CRM_AI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
  "gemini-1.5-pro",
] as const

export type CrmAiModelId = (typeof CRM_AI_MODELS)[number]

export const DEFAULT_CRM_MODEL: CrmAiModelId = "gemini-2.5-flash"

/** Short labels for the Settings UI (value sent to the API is still the model id). */
export const CRM_AI_MODEL_LABELS: Record<CrmAiModelId, string> = {
  "gemini-2.5-flash-lite": "2.5 Flash-Lite — fastest, most economical",
  "gemini-2.5-flash": "2.5 Flash — default, strong price/performance",
  "gemini-2.5-pro": "2.5 Pro — harder reasoning & coding",
  "gemini-3.1-pro-preview": "3.1 Pro (preview) — strongest Gemini 3 reasoning",
  "gemini-3.1-flash-preview": "3.1 Flash (preview) — fast Gemini 3",
  "gemini-3.1-flash-lite-preview": "3.1 Flash-Lite (preview) — lightest Gemini 3",
  "gemini-3-flash-preview": "3 Flash (preview) — earlier Gemini 3 flash; check docs",
  "gemini-1.5-pro": "1.5 Pro — legacy fallback if others unavailable",
}

export function isCrmAiModelId(v: string): v is CrmAiModelId {
  return (CRM_AI_MODELS as readonly string[]).includes(v)
}

export function getStoredCrmAiModel(): CrmAiModelId {
  if (typeof window === "undefined") return DEFAULT_CRM_MODEL
  const raw = localStorage.getItem(CRM_AI_MODEL_KEY)
  if (raw && isCrmAiModelId(raw)) return raw
  /** Migrate off deprecated 2.0 / old defaults */
  if (raw === "gemini-2.0-flash" || raw === "gemini-1.5-flash") {
    return DEFAULT_CRM_MODEL
  }
  return DEFAULT_CRM_MODEL
}

export function getStoredCrmSystemPrompt(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(CRM_AI_SYSTEM_PROMPT_KEY) ?? ""
}

export function setStoredCrmAiModel(model: CrmAiModelId) {
  localStorage.setItem(CRM_AI_MODEL_KEY, model)
}

export function setStoredCrmSystemPrompt(prompt: string) {
  localStorage.setItem(CRM_AI_SYSTEM_PROMPT_KEY, prompt)
}
