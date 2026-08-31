"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * (1) Registra el service worker (/sw.js) para habilitar el PWA instalable.
 * (2) Mantiene el <link rel="manifest"> apuntando a /api/manifest?start=<ruta
 *     actual>, para que al "Agregar a inicio" la app abra donde se ancló.
 * (3) Detecta cuando hay un DEPLOY nuevo (cambia el BUILD_ID) y muestra un banner
 *     "Actualizar" — NO auto-recarga, para no interrumpir a media comanda. Así el PWA,
 *     aunque quede abierto todo el servicio, se entera de los cambios y el usuario
 *     recarga cuando quiere. (El SW es passthrough: un reload trae código fresco.)
 */
export function PwaRegister({ buildId }: { buildId?: string }) {
  const pathname = usePathname();
  const [updateReady, setUpdateReady] = useState(false);

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

  useEffect(() => {
    // El build que selló el HTML que el navegador tiene cargado. Es la
    // referencia correcta: dice qué código está corriendo aquí, no qué versión
    // respondió el servidor la primera vez.
    const loaded = buildId && buildId !== "dev" ? buildId : null;
    // Respaldo para desarrollo, donde la constante puede no existir: se guarda
    // el primer valor visto y se detecta el cambio en caliente.
    let initial: string | null = null;
    let stopped = false;
    const check = async () => {
      try {
        const d = await fetch("/api/version", { cache: "no-store" }).then((r) => r.json());
        if (!d?.build) return;
        if (loaded) {
          // Detecta el desfase ya en la PRIMERA consulta: sirve tanto para un
          // deploy con la app abierta como para una app abierta con el paquete
          // viejo en caché, que es el caso que antes pasaba desapercibido.
          if (d.build !== loaded) setUpdateReady(true);
          return;
        }
        if (initial === null) initial = d.build;
        else if (d.build !== initial) setUpdateReady(true);
      } catch {
        /* sin red: se reintenta en el siguiente ciclo */
      }
    };
    check();
    const id = setInterval(() => { if (!stopped && typeof document !== "undefined" && !document.hidden) check(); }, 120000);
    const onVis = () => { if (typeof document !== "undefined" && !document.hidden) check(); };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearInterval(id);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
    };
  }, [buildId]);

  if (!updateReady) return null;
  return (
    <button onClick={() => window.location.reload()} style={banner} aria-label="Actualizar a la nueva versión">
      {/* SVG en vez de emoji: los emoji los dibuja cada sistema operativo con
          su propia tipografía —tamaño, color y trazo distintos en iOS, Android
          y Windows— y rompían la estética del aviso. Este hereda currentColor
          y el grosor del resto de los iconos. */}
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" style={{ flexShrink: 0 }}
      >
        <path d="M3 12a9 9 0 0 1 15.2-6.5L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15.2 6.5L3 16" />
        <path d="M3 21v-5h5" />
      </svg>
      Nueva versión disponible · toca para actualizar
    </button>
  );
}

const banner: React.CSSProperties = {
  position: "fixed", left: "50%", bottom: 16, transform: "translateX(-50%)", zIndex: 9999,
  background: "var(--sl-gold)", color: "var(--sl-on-accent)", border: "none", borderRadius: 999,
  padding: "11px 20px", fontWeight: 800, fontSize: "0.86rem", cursor: "pointer",
  boxShadow: "0 6px 24px rgba(0,0,0,0.5)", fontFamily: "inherit", maxWidth: "92vw", whiteSpace: "nowrap",
  // El icono es ahora un SVG y necesita alinearse con el texto: como emoji
  // quedaba centrado por la línea base de la fuente.
  display: "inline-flex", alignItems: "center", gap: 8,
};
