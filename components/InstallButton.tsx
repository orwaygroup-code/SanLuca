"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

/**
 * Botón "Anclar a inicio". Comportamiento:
 *  - Chrome/Android: dispara el instalador nativo, usando el manifest vigente →
 *    la app queda anclada abriendo la PÁGINA donde se instaló (start_url dinámico).
 *  - iOS/otros con Web Share: abre la hoja de compartir del sistema (donde está
 *    "Agregar a pantalla de inicio").
 * Se oculta si la app ya corre instalada, o si no hay forma de instalar/compartir.
 */
export function InstallButton({ style }: { style?: React.CSSProperties }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return; // ya instalada → no mostrar

    const shareOk = typeof navigator !== "undefined" && typeof navigator.share === "function";
    setCanShare(shareOk);
    setVisible(shareOk);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const handle = async () => {
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* usuario cerró */ }
      setDeferred(null);
      setVisible(false);
    } else if (canShare) {
      try { await navigator.share({ title: "San Luca", url: window.location.href }); } catch { /* cancelado */ }
    }
  };

  return (
    <button type="button" onClick={handle} style={style} aria-label="Anclar a inicio">
      Anclar
    </button>
  );
}
