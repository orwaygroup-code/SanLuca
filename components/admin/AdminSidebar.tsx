"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/**
 * Sidebar lateral unificado del panel admin (realm sl_session ADMIN/HOSTES).
 * Lo provee `app/admin/layout.tsx` a TODAS las páginas /admin/*. Comparte el
 * lenguaje visual del realm /staff (paleta `C`, marca SL, activo con relleno
 * dorado) para que Ricardo tenga una sola identidad al entrar por PIN.
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

type IconName =
  | "chart-bar" | "clipboard-text" | "map-2" | "calendar" | "history"
  | "star" | "users" | "settings" | "message-circle" | "external" | "logout" | "grid" | "chevron" | "cash";

interface NavLink { href: string; label: string; icon: IconName; external?: boolean }

const GROUPS: { title: string; items: NavLink[] }[] = [
  { title: "Operación", items: [
    { href: "/admin/dashboard", label: "Dashboard", icon: "chart-bar" },
    { href: "/admin/meseros", label: "Meseros", icon: "users" },
    { href: "/admin/piso", label: "Piso en vivo", icon: "grid" },
    { href: "/admin/comandas", label: "Auditoría", icon: "clipboard-text" },
  ]},
  { title: "Reservas", items: [
    { href: "/admin", label: "Reservas", icon: "calendar" },
    { href: "/admin/historial", label: "Historial", icon: "history" },
    { href: "/admin/fechas-especiales", label: "Fechas especiales", icon: "star" },
  ]},
  { title: "Reportes de venta", items: [
    { href: "/admin/reportes", label: "Reportes", icon: "chart-bar" },
    { href: "/admin/reportes/historial", label: "Historial de venta", icon: "history" },
    { href: "/admin/reportes/cierres", label: "Cierres de turno", icon: "cash" },
  ]},
  { title: "Administración", items: [
    { href: "/admin/employees", label: "Empleados", icon: "users" },
    { href: "/admin/creditos", label: "Créditos de personal", icon: "clipboard-text" },
    { href: "/admin/menu", label: "Productos", icon: "clipboard-text" },
    { href: "/admin/extras", label: "Extras", icon: "star" },
    { href: "/admin/settings", label: "Ajustes", icon: "settings" },
  ]},
];

// CRM = sección desplegable (submenú en el MISMO menú, mismo tab; ya no abre
// pestaña nueva). Sus páginas viven en /crm (con su propio shell + enlace de
// regreso "Panel").
// Caja = sección desplegable que abre la vista de Operación EMBEBIDA en el panel admin
// (/admin/caja?tab=…), sin cambiar de panel. Cada item cambia la pestaña vía ?tab.
const CAJA_LINKS: NavLink[] = [
  { href: "/admin/caja?tab=mesas", label: "Mesas", icon: "grid" },
  { href: "/admin/caja?tab=llegadas", label: "Llegadas", icon: "calendar" },
  { href: "/admin/caja?tab=llevar", label: "Llevar", icon: "clipboard-text" },
  { href: "/admin/caja?tab=monitor", label: "Monitor", icon: "chart-bar" },
  { href: "/admin/caja?tab=propinas", label: "Propinas", icon: "star" },
];

const CRM_LINKS: NavLink[] = [
  { href: "/crm", label: "Inicio", icon: "chart-bar" },
  { href: "/crm/whatsapp", label: "Inbox", icon: "message-circle" },
  { href: "/crm/tags", label: "Tags", icon: "star" },
  { href: "/crm/marketing", label: "Marketing", icon: "chart-bar" },
  { href: "/crm/usuarios", label: "Usuarios", icon: "users" },
  { href: "/crm/arco", label: "ARCO", icon: "clipboard-text" },
  { href: "/crm/kpi", label: "KPI's", icon: "chart-bar" },
  { href: "/crm/configuracion", label: "Configuración", icon: "settings" },
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
    case "grid":
      return (<svg {...common}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>);
    case "chevron":
      return (<svg {...common} width={15} height={15}><polyline points="6 9 12 15 18 9" /></svg>);
    case "cash":
      return (<svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><line x1="6" y1="9" x2="6" y2="9" /><line x1="18" y1="15" x2="18" y2="15" /></svg>);
  }
}

function NavItem({ link, active, onNavigate }: { link: NavLink; active: boolean; onNavigate?: () => void }) {
  const [hover, setHover] = useState(false);
  // Activo = relleno dorado con tinta oscura (como el riel de /staff); sin franja
  // lateral (el estándar de diseño prohíbe el border-left > 1px como estructura).
  const bg = active ? "var(--sl-ink-accent)" : hover ? "rgba(255,255,255,0.05)" : "transparent";
  const color = active ? "#16201f" : hover ? "var(--sl-on-ink)" : "var(--sl-on-ink-dim)";
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 11,
        minHeight: 44, padding: "9px 13px",
        background: bg, color,
        textDecoration: "none", fontSize: "0.82rem", fontWeight: active ? 800 : 600,
        letterSpacing: "0.01em", borderRadius: 10,
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
  const [crmOpen, setCrmOpen] = useState(pathname.startsWith("/crm"));
  const [cajaOpen, setCajaOpen] = useState(pathname.startsWith("/admin/caja"));
  return (
    <aside
      style={{
        height: "100vh", display: "flex", flexDirection: "column",
        background: "var(--sl-ink)", borderRight: `1px solid var(--sl-ink-line)`, width: "100%",
      }}
    >
      {/* Header fijo arriba: marca SL + usuario (identidad unificada con /staff) */}
      <div style={{ flexShrink: 0, padding: "18px 16px 16px", borderBottom: `1px solid var(--sl-ink-line)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--sl-ink-accent)", color: "var(--sl-on-ink-accent)", display: "grid", placeItems: "center", fontWeight: 900, letterSpacing: "0.02em" }}>SL</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.62rem", letterSpacing: "0.22em", color: "var(--sl-ink-accent)", fontWeight: 800 }}>PANEL · ADMIN</div>
            {userName && <div style={{ fontSize: "0.78rem", color: "var(--sl-on-ink-dim)", fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>}
          </div>
        </div>
      </div>

      {/* Grupos (scroll independiente) */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 16 }}>
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div style={{ padding: "0 6px 6px", fontSize: "0.62rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--sl-on-ink-faint)", fontWeight: 700 }}>
              {g.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {g.items.map((link) => (
                <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}

        {/* Caja — desplegable: abre la vista de Operación EMBEBIDA en el panel (/admin/caja) */}
        <div>
          <button
            type="button"
            onClick={() => setCajaOpen((v) => !v)}
            aria-expanded={cajaOpen}
            style={{
              display: "flex", alignItems: "center", gap: 11, width: "100%",
              minHeight: 44, padding: "9px 13px", borderRadius: 10, border: "none",
              background: "transparent", color: cajaOpen || pathname.startsWith("/admin/caja") ? "var(--sl-on-ink)" : "var(--sl-on-ink-dim)", cursor: "pointer",
              fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.01em",
            }}
          >
            <span style={{ display: "flex", flexShrink: 0 }}><Icon name="cash" /></span>
            <span style={{ flex: 1, textAlign: "left" }}>Caja</span>
            <span style={{ display: "flex", transform: cajaOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><Icon name="chevron" /></span>
          </button>
          {cajaOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
              {CAJA_LINKS.map((link) => (
                <NavItem key={link.href} link={link} active={false} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>

        {/* CRM — grupo desplegable: mismo menú, mismo tab (ya no abre pestaña nueva) */}
        <div>
          <button
            type="button"
            onClick={() => setCrmOpen((v) => !v)}
            aria-expanded={crmOpen}
            style={{
              display: "flex", alignItems: "center", gap: 11, width: "100%",
              minHeight: 44, padding: "9px 13px", borderRadius: 10, border: "none",
              background: "transparent", color: crmOpen ? "var(--sl-on-ink)" : "var(--sl-on-ink-dim)", cursor: "pointer",
              fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.01em",
            }}
          >
            <span style={{ display: "flex", flexShrink: 0 }}><Icon name="message-circle" /></span>
            <span style={{ flex: 1, textAlign: "left" }}>CRM</span>
            <span style={{ display: "flex", transform: crmOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><Icon name="chevron" /></span>
          </button>
          {crmOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
              {CRM_LINKS.map((link) => (
                <NavItem key={link.href} link={link} active={pathname === link.href} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Footer fijo abajo */}
      <div style={{ flexShrink: 0, padding: "12px 14px 16px", borderTop: `1px solid var(--sl-ink-line)`, display: "flex", alignItems: "center", gap: 8 }}>
        <ThemeToggle size={44} />
        <button
          onClick={onLogout}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            minHeight: 44, padding: "10px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10, color: "var(--sl-on-ink-dim)", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <Icon name="logout" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
