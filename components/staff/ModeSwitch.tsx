"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { C } from "@/components/staff/ui";

/**
 * Switch Mesero/Manager — una sola cuenta, dos vistas. Solo para Capitán/Manager
 * (roles que además atienden mesas). "Mesero" = /staff/comandas (SUS propias mesas).
 * "Manager": si el usuario tiene acceso al panel (User ADMIN ligado) va a /admin/piso —
 * el piso DENTRO del panel, con su menú lateral; si no (ej. DAVID), a /staff/capitan.
 * Los meseros normales no lo ven (rol WAITER → null).
 */
export function ModeSwitch({ role }: { role?: string }) {
  const router = useRouter();
  const path = usePathname() ?? "";
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (role !== "CAPTAIN" && role !== "MANAGER") return;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setHasAdmin(!!(d?.authenticated && (d.user?.role === "ADMIN" || d.user?.role === "HOSTES"))))
      .catch(() => setHasAdmin(false));
  }, [role]);

  if (role !== "CAPTAIN" && role !== "MANAGER") return null;

  const mesero = path.startsWith("/staff/comandas");
  // Antes de que resuelva el fetch, si ya estamos en /admin asumimos admin (para no
  // parpadear a /staff/capitan). "Manager" con sidebar = /admin/piso.
  const isAdmin = hasAdmin ?? path.startsWith("/admin");
  const managerHref = isAdmin ? "/admin/piso" : "/staff/capitan";

  return (
    <div style={sw.wrap} role="tablist" aria-label="Cambiar entre Mesero y Manager">
      <button role="tab" aria-selected={mesero} style={{ ...sw.btn, ...(mesero ? sw.on : {}) }} onClick={() => router.push("/staff/comandas")}>Mesero</button>
      <button role="tab" aria-selected={!mesero} style={{ ...sw.btn, ...(!mesero ? sw.on : {}) }} onClick={() => router.push(managerHref)}>Manager</button>
    </div>
  );
}

const sw: Record<string, React.CSSProperties> = {
  wrap: { display: "inline-flex", gap: 3, padding: 3, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, borderRadius: 999 },
  btn: { padding: "6px 14px", borderRadius: 999, border: "none", background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  on: { background: C.gold, color: "#16201f" },
};
