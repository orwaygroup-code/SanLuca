"use client";

import { useRouter, usePathname } from "next/navigation";

/**
 * Barra de navegación del panel admin de Ricardo (realm sl_session ADMIN).
 * Links a las páginas nuevas de Fase B.2 + nombre del usuario + cerrar sesión.
 */
const LINKS: { href: string; label: string }[] = [
  { href: "/admin", label: "Reservas" },
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/comandas", label: "Comandas" },
  { href: "/admin/employees", label: "Empleados" },
  { href: "/admin/settings", label: "Ajustes" },
];

export function AdminNav({ userName, onLogout }: { userName?: string; onLogout: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "12px 20px", borderBottom: "1px solid rgb(var(--sl-veil-rgb) / 0.08)", background: "var(--sl-ink)" }}>
      <span style={{ fontSize: "0.7rem", letterSpacing: "0.3em", color: "var(--sl-ink-accent)", fontWeight: 800, marginRight: 8 }}>SAN LUCA · ADMIN</span>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <button
            key={l.href}
            onClick={() => router.push(l.href)}
            style={{
              padding: "7px 13px", borderRadius: 8, fontSize: "0.76rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              background: active ? "rgb(var(--sl-ink-accent-rgb) / 0.85)" : "rgb(var(--sl-ink-accent-rgb) / 0.10)",
              border: `1px solid ${active ? "var(--sl-ink-accent)" : "rgb(var(--sl-ink-accent-rgb) / 0.30)"}`,
              color: active ? "#fff" : "var(--sl-ink-accent)", letterSpacing: "0.04em",
            }}
          >
            {l.label}
          </button>
        );
      })}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {userName && <span style={{ fontSize: "0.78rem", color: "rgb(var(--sl-on-ink-rgb) / 0.7)", fontWeight: 600 }}>{userName}</span>}
        <button onClick={onLogout} style={{ padding: "7px 13px", borderRadius: 8, border: "1px solid var(--sl-ink-line)", background: "transparent", color: "rgb(var(--sl-on-ink-rgb) / 0.7)", fontWeight: 600, fontSize: "0.76rem", cursor: "pointer", fontFamily: "inherit" }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
