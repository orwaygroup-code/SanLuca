"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { label: "Inicio",        href: "/crm" },
  { label: "WhatsApp",      href: "/crm/whatsapp" },
  { label: "Marketing",     href: "/crm/marketing" },
  { label: "Usuarios",      href: "/crm/usuarios" },
  { label: "KPI's",         href: "/crm/kpi" },
];
const NAV_BOTTOM = [
  { label: "Configuración", href: "/crm/configuracion" },
];

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
    if (role !== "ADMIN") {
      router.replace("/login?mode=login&redirect=/crm");
      return;
    }
    setAuthorized(true);
  }, [router]);

  if (!authorized) {
    return <div style={loading}>Verificando acceso…</div>;
  }

  return (
    <div style={shell}>
      <aside style={aside}>
        <div style={brand}>
          <span style={brandSan}>SAN</span>
          <span style={brandLuca}>LUCA</span>
        </div>
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
      <main style={main}>{children}</main>
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

const shell: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  background: "#1c2628",
  color: "#f5f1e8",
  fontFamily: "inherit",
};
const aside: React.CSSProperties = {
  background: "#22302e",
  padding: "32px 28px",
  display: "flex",
  flexDirection: "column",
  borderRight: "1px solid rgba(255,255,255,0.04)",
};
const brand: React.CSSProperties = { display: "flex", flexDirection: "column", marginBottom: 48, lineHeight: 0.9 };
const brandSan: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 500, letterSpacing: "0.02em" };
const brandLuca: React.CSSProperties = { fontSize: "1.6rem", fontWeight: 500, letterSpacing: "0.02em" };
const nav: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const main: React.CSSProperties = { padding: "40px clamp(28px,4vw,56px)", overflow: "auto" };
const loading: React.CSSProperties = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  background: "#1c2628", color: "rgba(245,241,232,0.6)", fontFamily: "inherit",
};
