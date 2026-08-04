"use client";

import { useEffect, useState } from "react";

/**
 * Pantalla de carga: muestra el logo "San Luca" sobre el fondo de marca al abrir la
 * app y se desvanece cuando la página terminó de cargar (o tras un mínimo visible).
 * Se monta una vez en el layout raíz → aparece en la carga inicial, no en cada
 * navegación de cliente.
 */
export function SplashScreen() {
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const start = () => setFading(true);
    // Un mínimo visible para que no "parpadee", y desvanece al terminar la carga.
    const min = window.setTimeout(start, document.readyState === "complete" ? 300 : 700);
    window.addEventListener("load", start, { once: true });
    return () => { window.clearTimeout(min); window.removeEventListener("load", start); };
  }, []);

  useEffect(() => {
    if (!fading) return;
    const t = window.setTimeout(() => setHidden(true), 520);
    return () => window.clearTimeout(t);
  }, [fading]);

  if (hidden) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9999, background: "#1a2224",
        display: "grid", placeItems: "center", padding: 24,
        opacity: fading ? 0 : 1, transition: "opacity 0.5s ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-carga.svg" alt="San Luca Ristorante" style={{ width: "min(72vw, 380px)", height: "auto" }} />
    </div>
  );
}
