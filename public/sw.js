// TraineFy Service Worker — push notifications locais
// DEVE estar em public/sw.js para ser servido corretamente

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Recebe postMessage do app e dispara notificação via SW
// Isso garante funcionamento com tela bloqueada em todos os browsers
self.addEventListener("message", e => {
  if (e.data?.type === "PUSH") {
    const { title, body } = e.data;
    e.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        vibrate: [200, 100, 200],
        silent: false,
        requireInteraction: false,
        tag: "trainefy",
      })
    );
  }
});

// Toque na notificação → abre/foca o app
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
