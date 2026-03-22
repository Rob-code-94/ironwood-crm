/**
 * Gemini “tool combination” (built-in tools + custom function calling in one flow) is documented at:
 * https://ai.google.dev/gemini-api/docs/tool-combination
 *
 * Highlights for future implementation:
 * - Preview feature; docs state support for **Gemini 3** models when combining tools.
 * - Requires `includeServerSideToolInvocations` / `includeServerSideToolInvocations: true` so
 *   server-side tool `toolCall` / `toolResponse` parts round-trip with the conversation.
 * - You must return **all** response parts on later turns, including `id`, `toolType`, and
 *   **`thoughtSignature`** fields, or the model can error.
 * - Useful built-ins for a CRM assistant (text-focused): **Google Search** (grounding), **URL context**,
 *   **File search** (if you index docs). Skip image/video generators unless you add those product surfaces.
 *
 * This app currently uses `@google/generative-ai` with plain `generateContentStream` / chat history.
 * Full tool-combination flows may require the newer **@google/genai** client or REST, per Google’s samples.
 *
 * Model catalog and deprecations: https://ai.google.dev/gemini-api/docs/models
 */
export const GEMINI_DOCS = {
  models: "https://ai.google.dev/gemini-api/docs/models",
  toolCombination: "https://ai.google.dev/gemini-api/docs/tool-combination",
  quickstart: "https://ai.google.dev/gemini-api/docs/quickstart",
} as const
