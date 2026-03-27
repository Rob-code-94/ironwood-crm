"use client"

import type { ReactNode } from "react"
import { ActiveClientProvider } from "@/components/iwc-assistant/active-client-context"
import { ClientWorkspaceBridge } from "@/components/iwc-assistant/client-workspace-bridge"
import { IwcAssistantRoot } from "@/components/iwc-assistant/iwc-assistant-root"

export function AppAssistantShell({ children }: { children: ReactNode }) {
  return (
    <ActiveClientProvider>
      <ClientWorkspaceBridge />
      {children}
      <IwcAssistantRoot />
    </ActiveClientProvider>
  )
}
