"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SalonMap } from "@/components/reservation/maps/SalonMap";
import { TerrazaMap } from "@/components/reservation/maps/TerrazaMap";
import { PlantaAltaMap } from "@/components/reservation/maps/PlantaAltaMap";
import { BlobTable } from "@/components/reservation/BlobTable";
import { C, formatMXN } from "@/components/staff/ui";
import type { TableStatus } from "@/components/staff/types";

/**
 * Mapa del piso EN VIVO con el LAYOUT REAL — reusa los mapas gráficos de reserva
 * (SalonMap/TerrazaMap/PlantaAltaMap con las posiciones reales) pero cableado con
 * COMANDAS. En DESKTOP muestra todas las secciones apiladas; en CELULAR (portrait)
 * muestra BOTONES DE ÁREA y una sección a la vez, para verla completa. Sin relación
 * con reservas (datos vacíos + renderTable de comandas).
 */
const FILL: Record<string, { table: string; chair: string; text: string; border: string }> = {
  FREE:             { table: "#2c3537", chair: "#222c2e", text: "rgba(245,241,232,0.5)", border: "none" },
  OPEN:             { table: "color-mix(in srgb, #4a82c4 32%, #1e2426)", chair: "#1a2022", text: "#f5f1e8", border: "2px solid #4a82c4" },
  IN_SERVICE:       { table: "color-mix(in srgb, #3f9d6f 32%, #1e2426)", chair: "#1a2022", text: "#f5f1e8", border: "2px solid #3f9d6f" },
  AWAITING_PAYMENT: { table: "color-mix(in srgb, #d8a13a 34%, #1e2426)", chair: "#1a2022", text: "#f5f1e8", border: "2px solid #d8a13a" },
  PARTIALLY_PAID:   { table: "color-mix(in srgb, #d8a13a 34%, #1e2426)", chair: "#1a2022", text: "#f5f1e8", border: "2px solid #d8a13a" },
};
const fillOf = (s: string) => FILL[s] ?? FILL.FREE;

const GRAPHIC = ["Salón", "Terraza", "Planta Alta"];
const EMPTY = { tables: [], pairs: [], triples: [], quads: [], guests: 0, selection: null, onSelect: () => {} };

export function FloorMap({ tables, onOpen }: { tables: TableStatus[]; onOpen: (comandaId: number) => void }) {
  const [isMobile, setIsMobile] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const u = () => setIsMobile(mq.matches);
    u();
    mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);

  const byKey = new Map(tables.map((t) => [`${t.section}#${t.number}`, t]));
  const present = new Set(tables.map((t) => t.section));
  const sections = [...GRAPHIC.filter((s) => present.has(s)), ...[...present].filter((s) => !GRAPHIC.includes(s))];

  const mk = (section: string) => (num: number, cx: number, cy: number, shape?: "round" | "sofa"): ReactNode => {
    const t = byKey.get(`${section}#${num}`);
    if (!t) return null;
    const c = t.comanda;
    return (
      <BlobTable key={num} tableNum={num} capacity={t.capacity} cx={cx} cy={cy} shape={shape}
        state="available" fill={fillOf(c ? c.status : "FREE")} forceClickable={!!c}
        sub={c ? formatMXN(Number(c.total)) : "libre"} onClick={() => c && onOpen(c.id)} />
    );
  };

  const renderSection = (name: string): ReactNode => {
    if (name === "Salón")       return <SalonMap      key={name} {...EMPTY} renderTable={mk("Salón")} />;
    if (name === "Terraza")     return <TerrazaMap    key={name} {...EMPTY} renderTable={mk("Terraza")} />;
    if (name === "Planta Alta") return <PlantaAltaMap key={name} {...EMPTY} renderTable={mk("Planta Alta")} />;
    const ts = tables.filter((t) => t.section === name).sort((a, b) => a.number - b.number);
    return (
      <section key={name}>
        <div style={fm.secName}>{name}</div>
        <div style={fm.tiles}>
          {ts.map((t) => {
            const c = t.comanda;
            const f = fillOf(c ? c.status : "FREE");
            return (
              <button key={t.id} onClick={() => c && onOpen(c.id)} disabled={!c}
                style={{ ...fm.tile, background: f.table, border: f.border === "none" ? `1px solid ${C.line}` : f.border, cursor: c ? "pointer" : "default" }}>
                <div style={{ color: C.cream, fontWeight: 800, fontSize: "0.9rem" }}>M{t.number}</div>
                <div style={{ color: c ? C.cream : C.faint, fontSize: "0.76rem" }}>{c ? formatMXN(Number(c.total)) : "libre"}</div>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const legend = (
    <div style={fm.legend}>
      {[["Libre", "#2c3537"], ["Abierta", "#4a82c4"], ["En servicio", "#3f9d6f"], ["Por cobrar", "#d8a13a"]].map(([l, col]) => (
        <span key={l} style={fm.legItem}><span style={{ ...fm.legDot, background: col }} />{l}</span>
      ))}
    </div>
  );

  // CELULAR: botones de área + una sección a la vez (se ve completa, sin scroll largo).
  if (isMobile && sections.length > 1) {
    const active = sel && sections.includes(sel) ? sel : sections[0];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={fm.areas}>
          {sections.map((s) => (
            <button key={s} onClick={() => setSel(s)} style={{ ...fm.area, ...(s === active ? fm.areaOn : {}) }}>{s}</button>
          ))}
        </div>
        {renderSection(active)}
        {legend}
      </div>
    );
  }

  // DESKTOP: todas las secciones apiladas.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {sections.map(renderSection)}
      {legend}
    </div>
  );
}

const fm: Record<string, React.CSSProperties> = {
  secName: { color: C.gold, fontSize: "0.74rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 },
  tiles: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 },
  tile: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, borderRadius: 12, padding: "10px 12px", minHeight: 62, fontFamily: "inherit", textAlign: "left" },
  legend: { display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 },
  legItem: { display: "flex", alignItems: "center", gap: 6, color: C.faint, fontSize: "0.72rem" },
  legDot: { width: 12, height: 12, borderRadius: 4, flexShrink: 0 },
  areas: { display: "flex", gap: 8, flexWrap: "wrap" },
  area: { padding: "9px 16px", borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  areaOn: { background: C.gold, color: "#16201f", borderColor: C.gold },
};
