"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (/sw.js) para habilitar el PWA instalable.
 * No renderiza nada. Falla en silencio si el navegador no soporta SW.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* silencioso: el PWA es progresivo, la web funciona igual sin SW */
      });
    }
  }, []);
  return null;
}
