"use client"

import { Bell } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NotificationsPanel } from "@/components/notifications-panel"
import { useWorkspace } from "@/lib/workspace/context"

export function NotificationBell() {
  const { notifications } = useWorkspace()
  const unread = notifications.filter((n) => !n.read).length
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Open notifications" />
        }
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[26rem] p-0">
        <NotificationsPanel />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
