self.addEventListener("push", (event) => {
  if (!event.data) return

  const payload = event.data.json()
  const url = payload.url || "/tareas"

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-512.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      data: { url },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/tareas"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
