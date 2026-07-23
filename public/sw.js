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
