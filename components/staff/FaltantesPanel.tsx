"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { C, Spinner, EmptyState, fld, usePoll } from "./ui";
import { apiFetch } from "./types";

/**
 * Panel 86 (faltantes) + 101 (priorizar venta). Contenido puro, SIN shell: se monta
 * dentro del riel de Perla (/staff/cocina) o como overlay dentro de la vista del mesero
 * (/staff/comandas), para que el mesero solo lo consulte sin salir de su pantalla.
 * `canManage86/101` gatean la edición; sin ellos es de solo lectura.
 */

type Area = "BARRA" | "COCINA";
interface MenuDish { id: string; name: string; price: number; prepArea: Area | null; featured101?: boolean }
interface MenuCat { id: string; name: string; dishes: MenuDish[] }
interface Falta { id: number; dishId: string | null; label: string; area: Area | null; note: string | null; createdByName: string; createdAt: string }

const MX_TZ = "America/Mexico_City";
const fmtTime = (iso: string) => new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const AREA_LABEL: Record<string, string> = { BARRA: "Barra", COCINA: "Cocina" };

export function FaltantesPanel({
  role, initialTab = "86", push, showTitle = true,
}: {
  role?: string;
  initialTab?: "86" | "101";
  push: (msg: string, tone?: "success" | "error" | "info") => void;
  /** Muestra el H1 "Faltantes (86)"/"Priorizar (101)". En el modal del mesero lo pone el header del overlay. */
  showTitle?: boolean;
}) {
  const [tab, setTab] = useState<"86" | "101">(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const [menu, setMenu] = useState<MenuCat[] | null>(null);
  const [faltas, setFaltas] = useState<Falta[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage86 = !!role && ["OPERATION", "CAPTAIN", "MANAGER"].includes(role);
  const canManage101 = !!role && ["CAPTAIN", "MANAGER"].includes(role);

  const loadMenu = useCallback(async () => {
    const r = await apiFetch<MenuCat[]>("/api/comandas/menu");
    if (r.ok) setMenu(r.data ?? []);
  }, []);
  const loadFaltas = useCallback(async () => {
    const r = await apiFetch<Falta[]>("/api/eighty-six");
    if (r.ok) setFaltas(r.data ?? []);
  }, []);
  useEffect(() => { loadMenu(); loadFaltas(); }, [loadMenu, loadFaltas]);
  usePoll(loadFaltas, 10000, true);

  const flatDishes = useMemo(() => (menu ?? []).flatMap((c) => c.dishes.map((d) => ({ ...d, catName: c.name }))), [menu]);
  const faltaDishIds = useMemo(() => new Set((faltas ?? []).filter((f) => f.dishId).map((f) => f.dishId)), [faltas]);

  const add86 = async (dish: { id?: string; label: string; area: Area | null }) => {
    setBusy(true);
    const r = await apiFetch<Falta>("/api/eighty-six", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dishId: dish.id ?? null, label: dish.label, area: dish.area }),
    });
    setBusy(false);
    if (r.ok) { setQ(""); loadFaltas(); push("Marcado como faltante", "success"); }
    else push(r.error ?? "No se pudo marcar", "error");
  };
  const clear86 = async (id: number) => {
    setBusy(true);
    const r = await apiFetch(`/api/eighty-six/${id}/clear`, { method: "POST" });
    setBusy(false);
    if (r.ok) { loadFaltas(); push("Repuesto — quitado de faltantes", "success"); }
    else push(r.error ?? "No se pudo quitar", "error");
  };
  const toggle101 = async (dishId: string, featured: boolean) => {
    setBusy(true);
    const r = await apiFetch(`/api/dishes/${dishId}/featured`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ featured }),
    });
    setBusy(false);
    if (r.ok) { loadMenu(); push(featured ? "Priorizado (101)" : "Quitado de 101", "success"); }
    else push(r.error ?? "No se pudo cambiar", "error");
  };

  const searchLc = q.trim().toLowerCase();
  const matches = searchLc ? flatDishes.filter((d) => d.name.toLowerCase().includes(searchLc)).slice(0, 8) : [];
  const featured = flatDishes.filter((d) => d.featured101);
  const faltasByArea = (area: Area | "SIN") => (faltas ?? []).filter((f) => (area === "SIN" ? !f.area : f.area === area));

  return (
    <>
      <div style={ui.head}>
        {showTitle && <h1 style={ui.h1}>{tab === "86" ? "Faltantes (86)" : "Priorizar venta (101)"}</h1>}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...ui.tab, ...(tab === "86" ? ui.tabOn : {}) }} onClick={() => setTab("86")}>86 Faltantes</button>
          <button style={{ ...ui.tab, ...(tab === "101" ? ui.tabOn : {}) }} onClick={() => setTab("101")}>101 Priorizar</button>
        </div>
      </div>

      {tab === "86" ? (
        <>
          {canManage86 && (
            <div style={ui.card}>
              <label style={ui.lbl}>Marcar un producto como faltante</label>
              <input style={fld.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca el platillo por nombre…" />
              {matches.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {matches.map((d) => {
                    const already = faltaDishIds.has(d.id);
                    return (
                      <div key={d.id} style={ui.matchRow}>
                        <span style={{ color: C.cream, flex: 1, minWidth: 0 }}>{d.name} <span style={{ color: C.faint, fontSize: "0.76rem" }}>· {AREA_LABEL[d.prepArea ?? ""] ?? "s/área"}</span></span>
                        {already ? <span style={{ color: C.faint, fontSize: "0.78rem" }}>ya está</span> :
                          <button style={ui.smallGold} disabled={busy} onClick={() => add86({ id: d.id, label: d.name, area: d.prepArea })}>+ 86</button>}
                      </div>
                    );
                  })}
                </div>
              )}
              {searchLc && matches.length === 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button style={ui.smallGhost} disabled={busy} onClick={() => add86({ label: q.trim(), area: "COCINA" })}>+ «{q.trim()}» en Cocina</button>
                  <button style={ui.smallGhost} disabled={busy} onClick={() => add86({ label: q.trim(), area: "BARRA" })}>+ «{q.trim()}» en Barra</button>
                </div>
              )}
            </div>
          )}

          {faltas === null ? <Spinner /> : (
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {(["COCINA", "BARRA", "SIN"] as const).map((area) => {
                const list = faltasByArea(area);
                if (area === "SIN" && list.length === 0) return null;
                return (
                  <div key={area} style={ui.col}>
                    <div style={ui.colHead}>{area === "SIN" ? "Sin área" : AREA_LABEL[area]} · {list.length}</div>
                    {list.length === 0 ? <div style={{ color: C.faint, fontSize: "0.82rem", padding: "8px 2px" }}>Sin faltantes.</div> :
                      list.map((f) => (
                        <div key={f.id} style={ui.faltaRow}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: C.cream, fontWeight: 700 }}>{f.label}</div>
                            <div style={{ color: C.faint, fontSize: "0.72rem", marginTop: 2 }}>{f.createdByName} · {fmtTime(f.createdAt)}</div>
                          </div>
                          {canManage86 && <button style={ui.smallGhost} disabled={busy} onClick={() => clear86(f.id)}>Reponer</button>}
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {featured.length > 0 && (
            <div style={{ ...ui.card, borderColor: C.gold }}>
              <label style={{ ...ui.lbl, color: C.gold }}>A priorizar hoy · {featured.length}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {featured.map((d) => (
                  <span key={d.id} style={ui.chip}>
                    {d.name}
                    {canManage101 && <button style={ui.chipX} disabled={busy} onClick={() => toggle101(d.id, false)} aria-label="Quitar">×</button>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {canManage101 ? (
            <div style={ui.card}>
              <label style={ui.lbl}>Busca un platillo para priorizarlo</label>
              <input style={fld.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del platillo…" />
              {matches.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {matches.map((d) => (
                    <div key={d.id} style={ui.matchRow}>
                      <span style={{ color: C.cream, flex: 1, minWidth: 0 }}>{d.name}</span>
                      <button style={d.featured101 ? ui.smallGhost : ui.smallGold} disabled={busy} onClick={() => toggle101(d.id, !d.featured101)}>
                        {d.featured101 ? "Quitar 101" : "★ 101"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            featured.length === 0 && <EmptyState text="No hay productos priorizados ahora." />
          )}
        </>
      )}
    </>
  );
}

const ui: Record<string, React.CSSProperties> = {
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "8px 0 16px" },
  h1: { margin: 0, fontSize: "1.15rem", fontWeight: 800, color: C.cream },
  tab: { padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  tabOn: { background: C.gold, color: "#16201f", borderColor: C.gold },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 },
  lbl: { display: "block", color: C.faint, fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontWeight: 700 },
  matchRow: { display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.16)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 11px" },
  col: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" },
  colHead: { color: C.gold, fontWeight: 800, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 },
  faltaRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${C.line}` },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "color-mix(in srgb, #ba843c 14%, transparent)", border: `1px solid ${C.gold}`, color: C.cream, borderRadius: 999, padding: "6px 12px", fontSize: "0.84rem", fontWeight: 700 },
  chipX: { background: "transparent", border: "none", color: C.gold, fontWeight: 800, cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 0 },
  smallGold: { padding: "6px 12px", borderRadius: 8, border: "none", background: C.gold, color: "#16201f", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  smallGhost: { padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
};
