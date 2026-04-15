"use client"

import { type ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { NotificationBell } from "@/components/notification-bell"
import { NotificationPushBridge } from "@/components/notification-push-bridge"
import { TaskLineupBar } from "@/components/task-lineup-bar"
import { ThemeSwitcher } from "@/components/theme-switcher"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

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
      <NotificationPushBridge />
      <SidebarInset className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <TaskLineupBar />
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
              <NotificationBell />
              <ThemeSwitcher />
            </div>
          </header>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
