"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, X, CheckCircle, WarningCircle, Info } from "@phosphor-icons/react/dist/ssr"

interface Notification {
  id: string
  title: string
  message: string
  type: "success" | "warning" | "info"
  timestamp: string
  read: boolean
}

const typeConfig = {
  success: { icon: CheckCircle, bgColor: "bg-green-50", borderColor: "border-green-200" },
  warning: { icon: WarningCircle, bgColor: "bg-yellow-50", borderColor: "border-yellow-200" },
  info: { icon: Info, bgColor: "bg-blue-50", borderColor: "border-blue-200" },
}

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const handleClearAll = () => {
    setNotifications([])
  }

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
              onClick={handleClearAll}
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
              const config = typeConfig[notification.type]
              const Icon = config.icon

              return (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${config.bgColor} ${config.borderColor} cursor-pointer hover:shadow-sm transition-shadow ${
                    !notification.read ? "border-l-4" : ""
                  }`}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon size={18} className="mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {notification.timestamp}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDismiss(notification.id)
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
