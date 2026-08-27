"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { C, ROLE_LABEL } from "./ui";
import { Icon, type IconName } from "./icons";

/**
 * Riel vertical de navegación para las vistas de Perla (Operación / Reservas /
 * Historial). Una sola identidad, un solo lenguaje: aprovecha el ancho de la
 * pantalla de escritorio y libera el alto para el contenido. Los items de
 * "trabajo diario" (Mesas/Llegadas/Llevar/Monitor/Propinas) son pestañas locales
 * de Operación; Reservas/Historial navegan a sus páginas. En páginas que no son
 * Operación, tocar una pestaña regresa a /staff/operacion.
 */

export type OperTab = "mesas" | "llegadas" | "llevar" | "monitor" | "propinas";
export type RailActive = OperTab | "reservas" | "historial" | "cuentas" | "cocina";

export function StaffRail({
  active, counts, onTab, onRefresh, onHelp, onLogout, userName, role,
}: {
  active: RailActive;
  counts?: { llegadas?: number; llevar?: number };
  onTab?: (t: OperTab) => void;
  onRefresh?: () => void;
  onHelp?: () => void;
  onLogout: () => void;
  userName?: string;
  role?: string;
}) {
  const router = useRouter();
  // En Operación cambia de pestaña; fuera de ella, regresa a Operación.
  const goTab = (t: OperTab) => { if (onTab) onTab(t); else router.push("/staff/operacion"); };

  return (
    <nav style={rail.root}>
      <div style={rail.mark}>SL</div>

      {/* Volver al Panel admin — solo managers (vienen de /admin y no deben quedar atrapados en caja) */}
      {role === "MANAGER" && (
        <>
          <RailItem sm icon="chevron" label="Panel" onClick={() => router.push("/admin/dashboard")} />
          <div style={rail.div} />
        </>
      )}

      <div data-tour="tabs" style={rail.group}>
        <RailItem icon="plate" label="Mesas" active={active === "mesas"} onClick={() => goTab("mesas")} />
        <RailItem icon="arrive" label="Llegadas" count={counts?.llegadas} active={active === "llegadas"} onClick={() => goTab("llegadas")} />
        <RailItem icon="bag" label="Llevar" count={counts?.llevar} active={active === "llevar"} onClick={() => goTab("llevar")} />
      </div>

      <div style={rail.div} />

      <div style={rail.group}>
        <RailItem sm icon="calendar" label="Reservas" active={active === "reservas"} onClick={() => router.push("/staff/reservas")} />
        <RailItem sm icon="history" label="Historial" active={active === "historial"} onClick={() => router.push("/staff/historial")} />
        <RailItem sm icon="card" label="Cuentas" active={active === "cuentas"} onClick={() => router.push("/staff/cuentas")} />
        <RailItem sm icon="alert" label="86 / 101" active={active === "cocina"} onClick={() => router.push("/staff/cocina")} />
        <RailItem sm icon="pulse" label="Monitor" dataTour="monitor" active={active === "monitor"} onClick={() => goTab("monitor")} />
        <RailItem sm icon="coins" label="Propinas" active={active === "propinas"} onClick={() => goTab("propinas")} />
      </div>

      <div style={rail.grow} />

      {userName && (
        <div style={rail.user}>
          <div style={rail.userName}>{userName.split(" ")[0]}</div>
          {role && <div style={rail.userRole}>{ROLE_LABEL[role] ?? role}</div>}
        </div>
      )}
      {onHelp && <RailItem sm icon="help" label="Ayuda" dataTour="help" onClick={onHelp} />}
      {onRefresh && <RailItem sm icon="refresh" label="Refrescar" onClick={onRefresh} />}
      <RailItem sm icon="logout" label="Salir" danger onClick={onLogout} />
    </nav>
  );
}

function RailItem({ icon, label, active, count, danger, sm, dataTour, onClick }: {
  icon: IconName; label: string; active?: boolean; count?: number;
  danger?: boolean; sm?: boolean; dataTour?: string; onClick: () => void;
}) {
  const base: React.CSSProperties = {
    ...rail.btn, ...(sm ? rail.btnSm : {}),
    ...(active ? rail.btnOn : {}),
    ...(danger && !active ? { color: "#e8766b" } : {}),
  };
  return (
    <button data-tour={dataTour} onClick={onClick} title={label} aria-label={label} aria-current={active ? "page" : undefined} style={base}>
      <span style={{ position: "relative", display: "flex" }}>
        <Icon name={icon} size={sm ? 18 : 22} />
        {count ? <span style={rail.cnt}>{count}</span> : null}
      </span>
      <span style={{ ...rail.tx, ...(sm ? rail.txSm : {}), ...(active ? { color: "#16201f" } : {}) }}>{label}</span>
    </button>
  );
}

const rail: Record<string, React.CSSProperties> = {
  root: {
    gridArea: "rail", position: "sticky", top: 0, height: "100vh", zIndex: 30,
    background: "#111817", borderRight: `1px solid ${C.line}`,
    display: "flex", flexDirection: "column", alignItems: "stretch",
    padding: "14px 10px", gap: 4, overflowY: "auto",
  },
  mark: {
    margin: "2px auto 12px", width: 46, height: 46, borderRadius: 13, background: C.gold,
    color: "#16201f", display: "grid", placeItems: "center", fontWeight: 900, fontSize: "1.05rem", letterSpacing: "0.02em",
  },
  group: { display: "flex", flexDirection: "column", gap: 4 },
  btn: {
    position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
    padding: "11px 4px", border: "none", borderRadius: 13, background: "transparent", color: C.dim,
    fontFamily: "inherit", cursor: "pointer", minHeight: 62,
  },
  btnSm: { minHeight: 52 },
  btnOn: { background: C.gold, color: "#16201f" },
  tx: { fontSize: "0.61rem", fontWeight: 800, letterSpacing: "0.03em" },
  txSm: { fontSize: "0.56rem", color: C.faint, fontWeight: 700 },
  cnt: {
    position: "absolute", top: -8, right: -12, background: "#e0b054", color: "#16201f",
    fontSize: "0.58rem", fontWeight: 900, borderRadius: 999, padding: "0 5px", minWidth: 17, lineHeight: "16px", textAlign: "center",
  },
  div: { height: 1, background: C.line, margin: "9px 8px" },
  grow: { flex: 1, minHeight: 12 },
  user: { textAlign: "center", padding: "6px 2px 2px", lineHeight: 1.2 },
  userName: { color: C.cream, fontSize: "0.72rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  userRole: { color: C.faint, fontSize: "0.56rem", marginTop: 2 },
};
