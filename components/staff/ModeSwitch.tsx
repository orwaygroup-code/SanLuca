"use client";

import { useRouter, usePathname } from "next/navigation";
import { C } from "@/components/staff/ui";

/**
 * Switch Mesero/Manager — una sola cuenta, dos vistas. Solo para Capitán/Manager
 * (roles que además atienden mesas). "Mesero" = /staff/comandas (SUS propias mesas,
 * vía ?mine=1). "Manager" = /staff/capitan (piso en vivo / supervisión).
 * Los meseros normales no lo ven (rol WAITER → null).
 */
export function ModeSwitch({ role }: { role?: string }) {
  const router = useRouter();
  const path = usePathname() ?? "";
  if (role !== "CAPTAIN" && role !== "MANAGER") return null;

  const mesero = path.startsWith("/staff/comandas");
  return (
    <div style={sw.wrap} role="tablist" aria-label="Cambiar entre Mesero y Manager">
      <button role="tab" aria-selected={mesero} style={{ ...sw.btn, ...(mesero ? sw.on : {}) }} onClick={() => router.push("/staff/comandas")}>Mesero</button>
      <button role="tab" aria-selected={!mesero} style={{ ...sw.btn, ...(!mesero ? sw.on : {}) }} onClick={() => router.push("/staff/capitan")}>Manager</button>
    </div>
  );
}

const sw: Record<string, React.CSSProperties> = {
  wrap: { display: "inline-flex", gap: 3, padding: 3, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, borderRadius: 999 },
  btn: { padding: "6px 14px", borderRadius: 999, border: "none", background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  on: { background: C.gold, color: "#16201f" },
};
