"use client"

import { Bell } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { NotificationsPanel } from "@/components/notifications-panel"
import { useWorkspace } from "@/lib/workspace/context"

export function NotificationBell() {
  const { notifications, tasks } = useWorkspace()
  const doneTaskIds = new Set(tasks.filter((task) => task.status === "done").map((task) => task.id))
  const unread = notifications.filter(
    (notification) =>
      !notification.read &&
      !(notification.sourceType === "task" && doneTaskIds.has(notification.sourceId))
  ).length
  const icon = (
    <span className="relative inline-flex size-[18px] items-center justify-center">
      <Bell size={18} className="shrink-0" aria-hidden />
      {unread > 0 ? (
        <span
          className="pointer-events-none absolute -right-2 -top-1 inline-flex h-4 min-h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground shadow-sm tabular-nums"
          aria-hidden
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </span>
  )
  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 shrink-0"
      aria-label="Open notifications"
    />
  )

  return (
    <div className="flex shrink-0 justify-center pe-1">
      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger render={triggerButton}>{icon}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(26rem,calc(100vw-2rem))] p-0">
            <NotificationsPanel />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger render={triggerButton}>{icon}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[80vh] px-0 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
          >
            <NotificationsPanel embedInCard={false} className="max-h-[70vh] overflow-y-auto px-4" />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
