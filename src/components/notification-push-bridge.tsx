"use client"

import { useEffect, useRef } from "react"
import { useWorkspace } from "@/lib/workspace/context"

export function NotificationPushBridge() {
  const { notifications, notificationPreferences } = useWorkspace()
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!notificationPreferences.pushEnabled) return
    if (!("Notification" in window) || Notification.permission !== "granted") return
    const pending = notifications.filter((n) => !n.read)
    for (const item of pending) {
      if (seenRef.current.has(item.id)) continue
      seenRef.current.add(item.id)
      if ("serviceWorker" in navigator) {
        fetch("/api/notifications/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: item.title, body: item.message }),
        }).catch(() => undefined)
        navigator.serviceWorker.ready
          .then((registration) =>
            registration.active?.postMessage({
              type: "REMINDER_NOTIFICATION",
              title: item.title,
              body: item.message,
              tag: item.id,
            })
          )
          .catch(() => undefined)
      } else {
        new Notification(item.title, { body: item.message, tag: item.id })
      }
    }
  }, [notifications, notificationPreferences.pushEnabled])

  return null
}
