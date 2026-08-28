/*
 * Service worker mínimo de San Luca — habilita la instalación del PWA.
 * Passthrough de red: NO cachea respuestas, porque las comandas son datos EN
 * VIVO (cachear tickets/mesas mostraría info vieja). Solo existe para que el
 * navegador ofrezca "Instalar app".
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Sin respondWith → el navegador hace la petición normal a la red.
});

// ── Web Push: muestra la notificación aunque la app esté cerrada ──
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (e) { d = { title: "San Luca", body: event.data ? event.data.text() : "" }; }
  const title = d.title || "San Luca";
  const options = {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: d.url || "/" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación: enfoca una ventana existente (y navega) o abre una nueva.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) { try { c.navigate(url); } catch (e) {} return c.focus(); } }
      return self.clients.openWindow(url);
    }),
  );
});
