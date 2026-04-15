"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, ClockCountdown, X, CheckCircle, PushPin } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"

const PINNED_TASKS_KEY = "ironwood_task_lineup_pinned_v1"
const TASK_PIN_EVENT = "ironwood-task-lineup-pin"

function pinTaskToLineup(taskId: string) {
  if (typeof window === "undefined") return
  let next: string[] = []
  try {
    const raw = localStorage.getItem(PINNED_TASKS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (Array.isArray(parsed)) next = parsed.filter((x): x is string => typeof x === "string")
  } catch {
    next = []
  }
  if (!next.includes(taskId)) {
    next.push(taskId)
    localStorage.setItem(PINNED_TASKS_KEY, JSON.stringify(next))
  }
  window.dispatchEvent(new CustomEvent(TASK_PIN_EVENT, { detail: { taskId } }))
}

export function NotificationsPanel() {
  const {
    notifications,
    markNotificationRead,
    dismissNotification,
    clearNotifications,
    snoozeNotification,
  } = useWorkspace()
  const unreadCount = useMemo(
    () => notifications.reduce((count, n) => count + (n.read ? 0 : 1), 0),
    [notifications]
  )

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={18} />
            <CardTitle className="text-lg">Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </div>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
                onClick={clearNotifications}
              className="text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length > 0 ? (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {notifications.map((notification) => {
              return (
                <div
                  key={notification.id}
                  className={`rounded-lg border border-border/70 bg-muted/30 p-3 transition-shadow hover:shadow-sm ${
                    !notification.read ? "border-l-4" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Bell size={18} className="mt-0.5 flex-shrink-0 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {!notification.read && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs"
                              onClick={() => markNotificationRead(notification.id)}
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Mark read
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => snoozeNotification(notification.id)}
                          >
                            <ClockCountdown size={14} className="mr-1" />
                            Snooze
                          </Button>
                          {notification.sourceType === "task" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => pinTaskToLineup(notification.sourceId)}
                            >
                              <PushPin size={14} className="mr-1" />
                              Pin to taskbar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        dismissNotification(notification.id)
                      }}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bell size={32} className="mx-auto text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
