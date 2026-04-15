self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("message", (event) => {
  const data = event.data || {}
  if (data.type !== "REMINDER_NOTIFICATION") return
  const title = data.title || "Reminder"
  const body = data.body || ""
  self.registration.showNotification(title, {
    body,
    tag: data.tag || "ironwood-reminder",
  })
})
