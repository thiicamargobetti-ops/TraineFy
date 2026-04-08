// TraineFy Service Worker — push notifications com tela bloqueada
// ARQUIVO DEVE ESTAR EM: public/sw.js

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Permite que o app force atualização do SW
self.addEventListener("message", e => {
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  // Dispara notificação via SW — único método que funciona com tela bloqueada
  if (e.data?.type === "PUSH") {
    const { title, body } = e.data;
    // e.waitUntil garante que o SW não é encerrado antes da notificação ser exibida
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
