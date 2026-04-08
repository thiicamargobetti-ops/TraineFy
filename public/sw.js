// TraineFy Service Worker
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("message", e => {
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      const focused = clients.find(c => c.focus);
      if (focused) return focused.focus();
      return self.clients.openWindow("/");
    })
  );
});
