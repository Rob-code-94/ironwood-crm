"use client"

import Link from "next/link"
import { RiPlantLine } from "@remixicon/react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

/** Static app identity in the sidebar header (replaces demo multi-team switcher). */
export function SidebarBrand() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip="Ironwood Planner"
          render={
            <Link
              href="/"
              className="flex size-full min-w-0 items-center gap-2 overflow-hidden"
              aria-label="Ironwood Planner home"
            />
          }
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <RiPlantLine className="size-4 shrink-0" aria-hidden />
          </div>
          <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">Ironwood</span>
            <span className="truncate text-xs text-muted-foreground">Planner</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
