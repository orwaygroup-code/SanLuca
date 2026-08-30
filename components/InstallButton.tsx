"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type BIPEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

// Áreas autenticadas donde tiene sentido anclar la app (no el sitio público).
const APP_PREFIXES = ["/staff", "/admin", "/crm"];

/**
 * Botón flotante "Anclar a inicio", visible SOLO en las áreas de la app
 * (staff/admin/crm). Comportamiento:
 *  - Chrome/Android: dispara el instalador nativo con el manifest vigente →
 *    la app queda anclada abriendo la PÁGINA donde se instaló (start_url dinámico).
 *  - iOS/otros con Web Share: abre la hoja de compartir del sistema (donde está
 *    "Agregar a pantalla de inicio").
 * Se oculta si la app ya corre instalada, o si no hay forma de instalar/compartir.
 */
export function InstallButton() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return; // ya instalada → no mostrar

    const shareOk = typeof navigator !== "undefined" && typeof navigator.share === "function";
    setCanShare(shareOk);
    setAvailable(shareOk);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setAvailable(true);
    };
    const onInstalled = () => setAvailable(false);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const inApp = APP_PREFIXES.some((p) => (pathname || "").startsWith(p));
  if (!inApp || !available) return null;

  const handle = async () => {
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* usuario cerró */ }
      setDeferred(null);
      setAvailable(false);
    } else if (canShare) {
      try { await navigator.share({ title: "San Luca", url: window.location.href }); } catch { /* cancelado */ }
    }
  };

  return (
    <button type="button" onClick={handle} aria-label="Anclar app a inicio" style={fab}>
      <span aria-hidden style={{ fontSize: "1rem", lineHeight: 1 }}>⬇</span>
      Anclar app
    </button>
  );
}

const fab: React.CSSProperties = {
  position: "fixed",
  // A la izquierda de la campana de notificaciones, que vive en right 16 y
  // mide 50 px: 16 + 50 + 12 de separación = 78. Ambos anclados abajo, así
  // que quedan alineados por su base.
  // (El flotante de WhatsApp no entra en juego: este botón solo se monta en
  // /staff, /admin y /crm — ver APP_PREFIXES — y aquel es de las públicas.)
  right: "78px",
  bottom: "max(16px, env(safe-area-inset-bottom))",
  zIndex: 50, // debajo de modales (80) y toasts (100)
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 44,
  padding: "11px 16px",
  borderRadius: 999,
  border: "1px solid #d9b25a",
  background: "#ba843c",
  color: "var(--sl-on-accent)",
  fontSize: "0.82rem",
  fontWeight: 800,
  fontFamily: "inherit",
  cursor: "pointer",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};
