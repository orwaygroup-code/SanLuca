"use client";

import type { ReactNode } from "react";
import { SalonMap } from "@/components/reservation/maps/SalonMap";
import { TerrazaMap } from "@/components/reservation/maps/TerrazaMap";
import { PlantaAltaMap } from "@/components/reservation/maps/PlantaAltaMap";
import { BlobTable } from "@/components/reservation/BlobTable";
import { C, formatMXN } from "@/components/staff/ui";
import type { TableStatus } from "@/components/staff/types";

/**
 * Mapa del piso EN VIVO con el LAYOUT REAL — reusa los mapas gráficos de reserva
 * (SalonMap/TerrazaMap/PlantaAltaMap con las posiciones reales de las mesas) pero
 * cableado con COMANDAS: cada mesa se colorea por el estado de su comanda y muestra su
 * total. Sin relación con reservas (les paso datos vacíos + un renderTable de comandas).
 * Las secciones sin mapa gráfico (ej. Privado) caen a tiles simples.
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
  const byKey = new Map(tables.map((t) => [`${t.section}#${t.number}`, t]));
  const has = (section: string) => tables.some((t) => t.section === section);

  // renderTable de comandas para una sección: dibuja el BlobTable coloreado por su comanda.
  const mk = (section: string) => (num: number, cx: number, cy: number, shape?: "round" | "sofa"): ReactNode => {
    const t = byKey.get(`${section}#${num}`);
    if (!t) return null;
    const c = t.comanda;
    return (
      <BlobTable
        key={num}
        tableNum={num}
        capacity={t.capacity}
        cx={cx}
        cy={cy}
        shape={shape}
        state="available"
        fill={fillOf(c ? c.status : "FREE")}
        forceClickable={!!c}
        sub={c ? formatMXN(Number(c.total)) : "libre"}
        onClick={() => c && onOpen(c.id)}
      />
    );
  };

  const otras = [...new Set(tables.map((t) => t.section))].filter((s) => !GRAPHIC.includes(s));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {has("Salón")       && <SalonMap      {...EMPTY} renderTable={mk("Salón")} />}
      {has("Terraza")     && <TerrazaMap    {...EMPTY} renderTable={mk("Terraza")} />}
      {has("Planta Alta") && <PlantaAltaMap {...EMPTY} renderTable={mk("Planta Alta")} />}

      {otras.map((section) => {
        const ts = tables.filter((t) => t.section === section).sort((a, b) => a.number - b.number);
        return (
          <section key={section}>
            <div style={fm.secName}>{section}</div>
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
      })}

      <div style={fm.legend}>
        {[["Libre", "#2c3537"], ["Abierta", "#4a82c4"], ["En servicio", "#3f9d6f"], ["Por cobrar", "#d8a13a"]].map(([l, col]) => (
          <span key={l} style={fm.legItem}><span style={{ ...fm.legDot, background: col }} />{l}</span>
        ))}
      </div>
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
};
