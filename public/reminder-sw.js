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
    data: {
      url: data.url || "/tasks",
    },
  })
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  const title = payload.title || "Reminder"
  const body = payload.body || ""
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload.tag || "ironwood-reminder",
      data: {
        url: payload.url || "/tasks",
      },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || "/tasks"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
      return undefined
    })
  )
})

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager.getSubscription().then((subscription) => {
      if (!subscription) return
      return fetch("/api/notifications/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      })
    })
  })
})
