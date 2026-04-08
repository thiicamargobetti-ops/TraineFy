// TraineFy Service Worker — push notifications locais
// Versão: 1.0.0

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Recebe mensagem do app principal e dispara notificação
self.addEventListener("message", e => {
  if (e.data?.type === "PUSH") {
    const { title, body } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      vibrate: [200, 100, 200],
      silent: false,
      requireInteraction: false,
      tag: "trainefy-hiit",
    });
  }
});

// Toque na notificação → foca/abre o app
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
