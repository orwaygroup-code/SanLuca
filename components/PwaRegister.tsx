"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * (1) Registra el service worker (/sw.js) para habilitar el PWA instalable.
 * (2) Mantiene el <link rel="manifest"> apuntando a /api/manifest?start=<ruta
 *     actual>, para que al "Agregar a inicio" la app abra en la página donde el
 *     usuario la ancló (start_url dinámico), no en una ruta fija.
 * No renderiza nada.
 */
export function PwaRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* silencioso: la web funciona igual sin SW */
      });
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = `/api/manifest?start=${encodeURIComponent(pathname || "/staff/comandas")}`;
  }, [pathname]);

  return null;
}
