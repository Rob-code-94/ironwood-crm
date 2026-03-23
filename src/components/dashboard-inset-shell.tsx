"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react"
import { usePanelRef } from "react-resizable-panels"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { AssistantSidebar } from "@/components/assistant-ui/assistant-sidebar"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { MessageSquare } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type AssistantPanelContextValue = {
  togglePanel: () => void
  expandPanel: () => void
  collapsePanel: () => void
}

const AssistantPanelContext = createContext<AssistantPanelContextValue | null>(
  null
)

export function useAssistantPanel() {
  const ctx = useContext(AssistantPanelContext)
  if (!ctx) {
    throw new Error("useAssistantPanel must be used within DashboardInsetShell")
  }
  return ctx
}

type DashboardInsetShellProps = {
  children: ReactNode
  defaultSidebarOpen: boolean
  sidebarStyle?: React.CSSProperties
}

export function DashboardInsetShell({
  children,
  defaultSidebarOpen,
  sidebarStyle,
}: DashboardInsetShellProps) {
  const assistantPanelRef = usePanelRef()

  const getSavedPanelSize = useCallback(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("crm-assistant-panel-size") : null
    return saved ? Math.max(22, Math.min(78, parseFloat(saved))) : 40
  }, [])

  const togglePanel = useCallback(() => {
    const p = assistantPanelRef.current
    if (!p) return
    const pct = p.getSize().asPercentage
    const tooNarrow = pct < 16
    if (p.isCollapsed() || tooNarrow) {
      p.resize(getSavedPanelSize())
    } else {
      p.collapse()
    }
  }, [assistantPanelRef, getSavedPanelSize])

  const expandPanel = useCallback(() => {
    const p = assistantPanelRef.current
    if (!p) return
    if (p.isCollapsed() || p.getSize().asPercentage < 16) {
      p.resize(getSavedPanelSize())
    }
  }, [assistantPanelRef, getSavedPanelSize])

  const collapsePanel = useCallback(() => {
    assistantPanelRef.current?.collapse()
  }, [assistantPanelRef])

  const panelApi = useMemo(
    () => ({ togglePanel, expandPanel, collapsePanel }),
    [togglePanel, expandPanel, collapsePanel]
  )

  return (
    <SidebarProvider
      defaultOpen={defaultSidebarOpen}
      className="h-svh max-h-svh overflow-hidden"
      style={
        sidebarStyle ??
        ({
          "--sidebar-width": "calc(var(--spacing) * 72)",
        } as React.CSSProperties)
      }
    >
      <AppSidebar variant="inset" className="hidden md:flex" />
      <AssistantPanelContext.Provider value={panelApi}>
        <SidebarInset className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
          <AssistantSidebar assistantPanelRef={assistantPanelRef}>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
                  <MobileNav />
                  <Separator
                    orientation="vertical"
                    className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                  />
                  <span className="truncate text-sm font-medium text-muted-foreground">
                    Ironwood Planner
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={togglePanel}
                          aria-label="Toggle CRM assistant panel"
                        >
                          <MessageSquare className="size-4" />
                        </Button>
                      }
                    />
                    <TooltipContent side="bottom">CRM assistant</TooltipContent>
                  </Tooltip>
                  <ThemeSwitcher />
                </div>
              </header>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-auto">{children}</div>
              </div>
            </div>
          </AssistantSidebar>
        </SidebarInset>
      </AssistantPanelContext.Provider>
    </SidebarProvider>
  )
}
