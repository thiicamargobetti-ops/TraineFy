// TraineFy Service Worker
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("message", e => {
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Notificação agendada com delay — funciona com tela bloqueada
  // porque o setTimeout roda dentro do SW, não na página React
  if (e.data?.type === "PUSH_DELAYED") {
    const { title, body, fireAt } = e.data;
    const delay = Math.max(0, fireAt - Date.now());
    e.waitUntil(
      new Promise(resolve => {
        setTimeout(() => {
          self.registration.showNotification(title, {
            body,
            icon: "/favicon.svg",
            badge: "/favicon.svg",
            vibrate: [200, 100, 200],
            silent: false,
            requireInteraction: false,
            tag: "trainefy-rest",
          }).then(resolve).catch(resolve);
        }, delay);
      })
    );
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
