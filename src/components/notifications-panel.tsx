"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, ClockCountdown, X, CheckCircle, PushPin } from "@phosphor-icons/react/dist/ssr"
import { useWorkspace } from "@/lib/workspace/context"
import { cn } from "@/lib/utils"

export function NotificationsPanel({
  className,
  embedInCard = true,
}: {
  className?: string
  embedInCard?: boolean
}) {
  const {
    notifications,
    tasks,
    markNotificationRead,
    dismissNotification,
    clearNotifications,
    snoozeNotification,
    pinTaskToLineup,
  } = useWorkspace()
  const visibleNotifications = useMemo(() => {
    const doneTaskIds = new Set(tasks.filter((task) => task.status === "done").map((task) => task.id))
    return notifications.filter(
      (notification) =>
        !(notification.sourceType === "task" && doneTaskIds.has(notification.sourceId))
    )
  }, [notifications, tasks])
  const unreadCount = useMemo(
    () => visibleNotifications.reduce((count, notification) => count + (notification.read ? 0 : 1), 0),
    [visibleNotifications]
  )

  const content = (
    <>
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
          {visibleNotifications.length > 0 && (
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
        {visibleNotifications.length > 0 ? (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {visibleNotifications.map((notification) => {
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
    </>
  )

  if (!embedInCard) {
    return <div className={cn("w-full", className)}>{content}</div>
  }

  return (
    <Card className={cn("w-full max-w-md", className)}>
      {content}
    </Card>
  )
}
