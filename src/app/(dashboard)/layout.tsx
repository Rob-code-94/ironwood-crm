import { cookies } from "next/headers"
import { Toaster } from "@/components/ui/sonner"
import { WorkspaceProvider } from "@/lib/workspace/context"
import { CrmAssistantProvider } from "@/components/crm-assistant-provider"
import { DashboardInsetShell } from "@/components/dashboard-inset-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  /** Nav sidebar: hidden (offcanvas) until opened; only stays open when cookie is exactly "true". */
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

  return (
    <WorkspaceProvider>
      <CrmAssistantProvider>
        <DashboardInsetShell defaultSidebarOpen={defaultOpen}>
          {children}
        </DashboardInsetShell>
      </CrmAssistantProvider>
      <Toaster />
    </WorkspaceProvider>
  )
}
