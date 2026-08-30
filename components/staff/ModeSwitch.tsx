"use client";

import { useRouter, usePathname } from "next/navigation";
import { C } from "@/components/staff/ui";

/**
 * Switch Mesero/Manager — una sola cuenta, dos vistas. Solo para Capitán/Manager
 * (roles que además atienden mesas). "Mesero" = /staff/comandas (SUS propias mesas).
 * "Manager": si el usuario tiene acceso al panel (User ADMIN ligado) va a /admin/piso —
 * el piso DENTRO del panel, con su menú lateral / hamburguesa en móvil; si no (ej.
 * DAVID), a /staff/capitan. Los meseros normales no lo ven (rol WAITER → null).
 *
 * El destino de "Manager" se resuelve AL HACER CLIC (await), no en segundo plano: así
 * en móvil (toque rápido) nunca cae al fallback antes de saber si eres admin.
 */
const MANAGER_HOME_KEY = "sl_manager_home";

export function ModeSwitch({ role }: { role?: string }) {
  const router = useRouter();
  const path = usePathname() ?? "";
  if (role !== "CAPTAIN" && role !== "MANAGER") return null;

  const mesero = path.startsWith("/staff/comandas");

  // Destino de "Manager" recordado durante la sesión del navegador.
  //
  // Sin esto, volver de Mesero a Manager repetía la consulta a /api/auth/me y,
  // si no resolvía como admin, caía a /staff/capitan — una vista SIN menú de
  // hamburguesa. El usuario salía del panel y regresaba a otro sitio, con la
  // sensación de que el menú había desaparecido. Recordando de dónde salió,
  // regresa siempre al mismo lugar.
  const remember = (dest: string) => {
    try { sessionStorage.setItem(MANAGER_HOME_KEY, dest); } catch { /* almacenamiento no disponible */ }
  };

  const goMesero = () => {
    if (path.startsWith("/admin")) remember("/admin/piso");
    router.push("/staff/comandas");
  };

  const goManager = async () => {
    // Si ya estamos en /admin, el usuario es admin → piso con menú lateral, sin fetch.
    if (path.startsWith("/admin")) { remember("/admin/piso"); router.push("/admin/piso"); return; }

    try {
      const saved = sessionStorage.getItem(MANAGER_HOME_KEY);
      if (saved === "/admin/piso" || saved === "/staff/capitan") { router.push(saved); return; }
    } catch { /* almacenamiento no disponible → se resuelve por fetch */ }

    let admin = false;
    try {
      const d = await fetch("/api/auth/me", { credentials: "same-origin" }).then((r) => r.json());
      admin = !!(d?.authenticated && (d.user?.role === "ADMIN" || d.user?.role === "HOSTES"));
    } catch { /* sin acceso admin → piso staff */ }
    const dest = admin ? "/admin/piso" : "/staff/capitan";
    remember(dest);
    router.push(dest);
  };

  return (
    <div style={sw.wrap} role="tablist" aria-label="Cambiar entre Mesero y Manager">
      <button role="tab" aria-selected={mesero} style={{ ...sw.btn, ...(mesero ? sw.on : {}) }} onClick={goMesero}>Mesero</button>
      <button role="tab" aria-selected={!mesero} style={{ ...sw.btn, ...(!mesero ? sw.on : {}) }} onClick={goManager}>Manager</button>
    </div>
  );
}

const sw: Record<string, React.CSSProperties> = {
  wrap: { display: "inline-flex", gap: 3, padding: 3, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, borderRadius: 999 },
  btn: { padding: "6px 14px", borderRadius: 999, border: "none", background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  on: { background: C.gold, color: "#16201f" },
};
