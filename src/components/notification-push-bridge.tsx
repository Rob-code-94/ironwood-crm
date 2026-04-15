"use client"

import { useEffect, useRef } from "react"
import { useWorkspace } from "@/lib/workspace/context"
import { ensurePushSubscription, registerReminderServiceWorker } from "@/lib/notifications/push-client"

export function NotificationPushBridge() {
  const { notifications, notificationPreferences, tasks } = useWorkspace()
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!notificationPreferences.pushEnabled) return
    void registerReminderServiceWorker()
    void ensurePushSubscription()
  }, [notificationPreferences.pushEnabled])

  useEffect(() => {
    if (!notificationPreferences.pushEnabled) return
    if (!("Notification" in window) || Notification.permission !== "granted") return
    const doneTaskIds = new Set(tasks.filter((task) => task.status === "done").map((task) => task.id))
    const pending = notifications.filter(
      (notification) =>
        !notification.read &&
        !(notification.sourceType === "task" && doneTaskIds.has(notification.sourceId))
    )
    for (const item of pending) {
      if (seenRef.current.has(item.id)) continue
      seenRef.current.add(item.id)
      if ("serviceWorker" in navigator) {
        fetch("/api/notifications/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            body: item.message,
            tag: item.id,
            url: `/tasks?taskId=${item.sourceId}`,
          }),
        }).catch(() => undefined)
        navigator.serviceWorker.ready
          .then((registration) =>
            registration.active?.postMessage({
              type: "REMINDER_NOTIFICATION",
              title: item.title,
              body: item.message,
              tag: item.id,
              url: `/tasks?taskId=${item.sourceId}`,
            })
          )
          .catch(() => undefined)
      } else {
        new Notification(item.title, { body: item.message, tag: item.id })
      }
    }
  }, [notifications, notificationPreferences.pushEnabled, tasks])

  return null
}
