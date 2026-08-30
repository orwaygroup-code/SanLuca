"use client";

import { useEffect } from "react";

/**
 * Refuerzo del bloqueo de zoom.
 *
 * El `userScalable: false` del viewport (app/layout.tsx) basta en Android y
 * escritorio, pero Safari en iOS lo ignora a propósito desde iOS 10 por
 * accesibilidad. Para que la app se comporte igual en todos lados hace falta
 * cancelar a mano los dos gestos que quedan vivos:
 *
 *   - `gesturestart/change/end` → el pellizco de Safari en iOS.
 *   - doble toque → se corta con `touch-action: manipulation` en el CSS, y
 *     aquí con el segundo toque dentro de la ventana de 300 ms.
 *
 * Se registran como `passive: false` porque un listener pasivo no puede
 * llamar a preventDefault.
 */
export function NoZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();

    document.addEventListener("gesturestart", stop, { passive: false });
    document.addEventListener("gesturechange", stop, { passive: false });
    document.addEventListener("gestureend", stop, { passive: false });

    // Doble toque: si el segundo llega antes de 300 ms, se cancela el zoom.
    let lastTouch = 0;
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    };
    document.addEventListener("touchend", onTouchEnd, { passive: false });

    // Ctrl/⌘ + rueda: zoom del navegador en escritorio.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
      document.removeEventListener("gestureend", stop);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);

  return null;
}
