export const CRM_ASSISTANT_THREAD_STORAGE_KEY = "ironwood.crmAssistant.thread.v1"

export function clearCrmAssistantThreadStorage() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(CRM_ASSISTANT_THREAD_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
