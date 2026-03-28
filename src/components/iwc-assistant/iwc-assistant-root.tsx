"use client"

import { AssistantModal } from "@/components/assistant-ui/assistant-modal"
import { CrmAssistantProvider } from "@/components/crm-assistant-provider"

export function IwcAssistantRoot() {
  return (
    <CrmAssistantProvider>
      <AssistantModal />
    </CrmAssistantProvider>
  )
}
