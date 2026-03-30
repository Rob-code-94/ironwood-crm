import { cookies } from "next/headers"
import { Toaster } from "@/components/ui/sonner"
import { WorkspaceProvider } from "@/lib/workspace/context"
import { DashboardInsetShell } from "@/components/dashboard-inset-shell"
import { AppAssistantShell } from "@/components/iwc-assistant/app-assistant-shell"

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
      <AppAssistantShell>
        <DashboardInsetShell defaultSidebarOpen={defaultOpen}>
          {children}
        </DashboardInsetShell>
      </AppAssistantShell>
      <Toaster />
    </WorkspaceProvider>
  )
}
