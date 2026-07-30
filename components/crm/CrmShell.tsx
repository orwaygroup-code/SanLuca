"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";

const NAV = [
  { label: "Inicio",        href: "/crm" },
  { label: "Inbox",         href: "/crm/whatsapp" },
  { label: "Tags",          href: "/crm/tags" },
  { label: "Marketing",     href: "/crm/marketing" },
  { label: "Usuarios",      href: "/crm/usuarios" },
  { label: "ARCO",          href: "/crm/arco" },
  { label: "KPI's",         href: "/crm/kpi" },
];
const NAV_BOTTOM = [
  { label: "Configuración", href: "/crm/configuracion" },
];

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (session.loading) return;
    if (session.user?.role !== "ADMIN") {
      // Al login por PIN (no el correo): /staff/me re-emite la sesión de admin y
      // reenvía aquí. Evita el callejón sin salida y el loop de redirects.
      router.replace("/staff/login?next=/crm");
      return;
    }
    setAuthorized(true);
  }, [router, session.loading, session.user]);

  // Cerrar drawer cuando cambia la ruta
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  if (!authorized) {
    return <div style={loading}>Verificando acceso…</div>;
  }

  return (
    <div className={`crm-shell${drawerOpen ? " crm-shell--open" : ""}`}>
      <button
        type="button"
        className="crm-shell__hamburger"
        aria-label={drawerOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen((v) => !v)}
      >
        {drawerOpen ? "✕" : "☰"}
      </button>
      <div
        className="crm-shell__overlay"
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside className="crm-shell__aside">
        <div style={brand}>
          <span style={brandSan}>SAN</span>
          <span style={brandLuca}>LUCA</span>
        </div>
        <Link
          href="/admin"
          style={{
            display: "block", padding: "8px 0", marginBottom: 16, fontSize: "0.8rem", fontWeight: 700,
            letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(245,241,232,0.55)", textDecoration: "none",
          }}
        >
          ← Panel
        </Link>
        <nav style={nav}>
          {NAV.map((l) => (
            <NavLink key={l.href} href={l.href} active={pathname === l.href} label={l.label} />
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}>
          {NAV_BOTTOM.map((l) => (
            <NavLink key={l.href} href={l.href} active={pathname === l.href} label={l.label} />
          ))}
        </div>
      </aside>
      <main className="crm-shell__main">{children}</main>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "10px 0",
        fontSize: "0.95rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: active ? "#ba843c" : "rgba(245,241,232,0.7)",
        textDecoration: active ? "underline" : "none",
        textUnderlineOffset: 4,
        textDecorationColor: "#ba843c",
        transition: "color 0.18s",
      }}
    >
      {label}
    </Link>
  );
}

const brand: React.CSSProperties = { display: "flex", flexDirection: "column", marginBottom: 48, lineHeight: 0.9 };
const brandSan: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 500, letterSpacing: "0.02em" };
const brandLuca: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 500, letterSpacing: "0.02em" };
const nav: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const loading: React.CSSProperties = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  background: "#1c2628", color: "rgba(245,241,232,0.6)", fontFamily: "inherit",
};
