"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

/**
 * Sidebar lateral unificado del panel admin (realm sl_session ADMIN/HOSTES).
 * Lo provee `app/admin/layout.tsx` a TODAS las páginas /admin/*. Reemplaza al
 * antiguo AdminNav horizontal. Solo links a páginas que YA existen + "Ir al CRM".
 *
 * Active state: la coincidencia de ruta MÁS LARGA gana (estar en
 * /admin/dashboard NO activa Reservas "/admin"). Hover y active vía estado
 * inline (sin CSS externo). Iconos: SVG inline minimal (sin librería).
 */

interface AdminSidebarProps {
  userName?: string;
  onLogout: () => void;
  /** Cierra el drawer en mobile al navegar (opcional; solo lo pasa el layout móvil). */
  onNavigate?: () => void;
}

const GOLD = "#ba843c";
const CREAM = "#f5f1e8";
const DIM = "rgba(245,241,232,0.55)";
const FAINT = "rgba(245,241,232,0.32)";

type IconName =
  | "chart-bar" | "clipboard-text" | "map-2" | "calendar" | "history"
  | "star" | "users" | "settings" | "message-circle" | "external" | "logout";

interface NavLink { href: string; label: string; icon: IconName; external?: boolean }

const GROUPS: { title: string; items: NavLink[] }[] = [
  { title: "Operación", items: [
    { href: "/admin/dashboard", label: "Dashboard", icon: "chart-bar" },
    { href: "/admin/comandas", label: "Comandas", icon: "clipboard-text" },
    { href: "/admin/mapa", label: "Mapa de mesas", icon: "map-2" },
  ]},
  { title: "Reservas", items: [
    { href: "/admin", label: "Reservas", icon: "calendar" },
    { href: "/admin/historial", label: "Historial", icon: "history" },
    { href: "/admin/fechas-especiales", label: "Fechas especiales", icon: "star" },
  ]},
  { title: "Administración", items: [
    { href: "/admin/employees", label: "Empleados", icon: "users" },
    { href: "/admin/settings", label: "Ajustes", icon: "settings" },
  ]},
  { title: "CRM", items: [
    { href: "/crm", label: "Ir al CRM", icon: "message-circle", external: true },
  ]},
];

// Solo rutas internas (el CRM externo nunca debe ganar el active state en /admin/*).
const INTERNAL_HREFS = GROUPS.flatMap((g) => g.items.filter((i) => !i.external).map((i) => i.href));

function routeMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Active = coincide y ninguna otra ruta interna es una coincidencia más larga. */
function isActive(pathname: string, href: string): boolean {
  if (!routeMatches(pathname, href)) return false;
  return !INTERNAL_HREFS.some(
    (other) => other !== href && other.length > href.length && routeMatches(pathname, other),
  );
}

function Icon({ name }: { name: IconName }) {
  const common: React.SVGProps<SVGSVGElement> = {
    width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (name) {
    case "chart-bar":
      return (<svg {...common}><line x1="4" y1="20" x2="4" y2="13" /><line x1="10" y1="20" x2="10" y2="6" /><line x1="16" y1="20" x2="16" y2="10" /><line x1="3" y1="20" x2="21" y2="20" /></svg>);
    case "clipboard-text":
      return (<svg {...common}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V5H9z" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></svg>);
    case "map-2":
      return (<svg {...common}><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z" /><line x1="9" y1="4" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="20" /></svg>);
    case "calendar":
      return (<svg {...common}><rect x="4" y="5" width="16" height="16" rx="2" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="8" y1="3" x2="8" y2="6" /><line x1="16" y1="3" x2="16" y2="6" /></svg>);
    case "history":
      return (<svg {...common}><path d="M3.5 9a9 9 0 1 1-1 4" /><path d="M3 5v4h4" /><path d="M12 8v4.5l3 2" /></svg>);
    case "star":
      return (<svg {...common}><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.6l5.8-.8z" /></svg>);
    case "users":
      return (<svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6" /><path d="M18 14.6a5.5 5.5 0 0 1 3.5 5.4" /></svg>);
    case "settings":
      return (<svg {...common}><line x1="4" y1="8" x2="20" y2="8" /><circle cx="9" cy="8" r="2.2" /><line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.2" /></svg>);
    case "message-circle":
      return (<svg {...common}><path d="M4 12a8 8 0 1 1 3.4 6.5L4 19.5l1-3.3A7.9 7.9 0 0 1 4 12z" /></svg>);
    case "external":
      return (<svg {...common} width={13} height={13}><path d="M14 5h5v5" /><path d="M19 5l-7 7" /><path d="M18 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>);
    case "logout":
      return (<svg {...common}><path d="M9 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /><path d="M16 16l4-4-4-4" /><line x1="20" y1="12" x2="9" y2="12" /></svg>);
  }
}

function NavItem({ link, active, onNavigate }: { link: NavLink; active: boolean; onNavigate?: () => void }) {
  const [hover, setHover] = useState(false);
  const bg = active ? "rgba(186,132,60,0.16)" : hover ? "rgba(186,132,60,0.08)" : "transparent";
  const color = active ? GOLD : hover ? CREAM : DIM;
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 11,
        padding: "9px 14px 9px 13px",
        borderLeft: `3px solid ${active ? GOLD : "transparent"}`,
        background: bg, color,
        textDecoration: "none", fontSize: "0.82rem", fontWeight: active ? 700 : 600,
        letterSpacing: "0.01em", borderRadius: "0 8px 8px 0",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <span style={{ display: "flex", flexShrink: 0 }}><Icon name={link.icon} /></span>
      <span style={{ flex: 1 }}>{link.label}</span>
      {link.external && <span style={{ display: "flex", opacity: 0.6 }}><Icon name="external" /></span>}
    </Link>
  );
}

export function AdminSidebar({ userName, onLogout, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname() ?? "";
  return (
    <aside
      style={{
        height: "100vh", display: "flex", flexDirection: "column",
        background: "#131c1b", borderRight: "1px solid rgba(255,255,255,0.08)", width: "100%",
      }}
    >
      {/* Header fijo arriba */}
      <div style={{ flexShrink: 0, padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: "0.72rem", letterSpacing: "0.26em", color: GOLD, fontWeight: 800 }}>SAN LUCA · ADMIN</div>
        {userName && <div style={{ marginTop: 6, fontSize: "0.8rem", color: DIM, fontWeight: 600 }}>Hola, {userName}</div>}
      </div>

      {/* Grupos (scroll independiente) */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "14px 8px 14px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div style={{ padding: "0 14px 6px 16px", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", color: FAINT, fontWeight: 700 }}>
              {g.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {g.items.map((link) => (
                <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer fijo abajo */}
      <div style={{ flexShrink: 0, padding: "12px 14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={onLogout}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 9, color: DIM, fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <Icon name="logout" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
