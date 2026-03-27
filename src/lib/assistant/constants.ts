export const ASSISTANT_MODEL_STORAGE_KEY = "iwc-assistant-default-model"

export const ASSISTANT_GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", thinking: true },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", thinking: true },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", thinking: false },
] as const

export type GeminiModelId = (typeof ASSISTANT_GEMINI_MODELS)[number]["id"]

export const VALID_MODEL_IDS: ReadonlySet<string> = new Set(
  ASSISTANT_GEMINI_MODELS.map((m) => m.id)
)

export const THINKING_MODELS: ReadonlySet<string> = new Set(
  ASSISTANT_GEMINI_MODELS.filter((m) => m.thinking).map((m) => m.id)
)
