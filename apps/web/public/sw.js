// Shows the game's pushes (packages/backend/convex/notify.ts) and opens their page when tapped.

// Takes over the open tabs right away, so a tap can move them to the push's page.
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  const message = event.data?.json()
  if (!message) return
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      // A newer bid replaces the last one's notification, and still alerts.
      renotify: true,
      icon: "/icon-192.png",
      data: message.url,
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data ?? "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) => {
      const open = windows[0]
      if (!open) return self.clients.openWindow(url)
      return open
        .focus()
        .then(() => open.navigate(url))
        .catch(() => self.clients.openWindow(url))
    })
  )
})
