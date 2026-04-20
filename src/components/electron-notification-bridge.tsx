"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useWorkspace } from "@/lib/workspace/context"
import { getElectron } from "@/lib/electron/client"

/**
 * When running inside the Electron desktop shell, this component:
 *   1. Forwards new in-app reminders to the OS notification center via IPC,
 *      so they appear like Calendar/Mail notifications even if the window is
 *      hidden in the background.
 *   2. Keeps the Dock / taskbar badge in sync with unread reminder count.
 *   3. Honors clicks on those notifications by routing the renderer to the
 *      relevant task or calendar entry.
 *
 * Outside of Electron this component is a no-op.
 */
export function ElectronNotificationBridge() {
  const { notifications, tasks } = useWorkspace()
  const router = useRouter()
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const bridge = getElectron()
    if (!bridge) return
    return bridge.navigation.onNavigate((url) => {
      try {
        const parsed = url.startsWith("http")
          ? new URL(url)
          : new URL(url, window.location.origin)
        router.push(parsed.pathname + parsed.search + parsed.hash)
      } catch {
        router.push(url)
      }
    })
  }, [router])

  useEffect(() => {
    const bridge = getElectron()
    if (!bridge) return
    const doneTaskIds = new Set(
      tasks.filter((task) => task.status === "done").map((task) => task.id)
    )
    const pending = notifications.filter(
      (notification) =>
        !notification.read &&
        !(notification.sourceType === "task" && doneTaskIds.has(notification.sourceId))
    )
    void bridge.notifications.setBadge(pending.length)
    for (const item of pending) {
      if (seenRef.current.has(item.id)) continue
      seenRef.current.add(item.id)
      const url =
        item.sourceType === "task"
          ? `/tasks?taskId=${encodeURIComponent(item.sourceId)}`
          : `/calendar?eventId=${encodeURIComponent(item.sourceId)}`
      void bridge.notifications.show({
        title: item.title,
        body: item.message,
        tag: item.id,
        url,
      })
    }
  }, [notifications, tasks])

  return null
}
