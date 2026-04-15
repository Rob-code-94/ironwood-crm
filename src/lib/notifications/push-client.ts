"use client"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export async function registerReminderServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration("/reminder-sw.js")
  if (existing) return existing
  return navigator.serviceWorker.register("/reminder-sw.js")
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied"
  if (Notification.permission !== "default") return Notification.permission
  return Notification.requestPermission()
}

export async function ensurePushSubscription(): Promise<boolean> {
  const registration = await registerReminderServiceWorker()
  if (!registration || !("PushManager" in window)) return false

  const permission = await ensureNotificationPermission()
  if (permission !== "granted") return false

  const keyRes = await fetch("/api/notifications/public-key")
  if (!keyRes.ok) return false
  const keyPayload = (await keyRes.json()) as { publicKey?: string }
  if (!keyPayload.publicKey) return false

  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
    }))

  const saveRes = await fetch("/api/notifications/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  })
  return saveRes.ok
}

export async function removePushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration("/reminder-sw.js")
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await fetch("/api/notifications/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  await subscription.unsubscribe()
}
