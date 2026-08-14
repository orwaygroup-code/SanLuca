"use client";

import { C, formatMXN } from "@/components/staff/ui";
import type { TableStatus } from "@/components/staff/types";

/**
 * Mapa del piso EN VIVO — cableado 100% con COMANDAS (vía /api/comandas/tables-status, que
 * deriva el estado de cada mesa de las comandas ACTIVAS). Sin relación con reservas. Cada
 * mesa es un tile por sección: color por estado + total y mesero de su comanda. Tocar una
 * mesa ocupada abre su comanda. Es la alternativa "Mapa" al de recuadros del piso.
 */
const STATE: Record<string, { color: string; label: string }> = {
  FREE:             { color: C.line,  label: "Libre" },
  OPEN:             { color: C.blue,  label: "Abierta" },
  IN_SERVICE:       { color: C.green, label: "En servicio" },
  AWAITING_PAYMENT: { color: C.amber, label: "Por cobrar" },
  PARTIALLY_PAID:   { color: C.amber, label: "Parcial" },
};
const stateOf = (s: string) => STATE[s] ?? STATE.FREE;

export function PisoMap({ tables, onOpen }: { tables: TableStatus[]; onOpen: (comandaId: number) => void }) {
  const bySection = new Map<string, TableStatus[]>();
  for (const t of tables) {
    const arr = bySection.get(t.section) ?? [];
    arr.push(t);
    bySection.set(t.section, arr);
  }
  const sections = [...bySection.entries()];
  if (sections.length === 0) return <div style={{ color: C.faint, padding: 20 }}>No hay mesas para mostrar.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {sections.map(([name, ts]) => {
        const ocupadas = ts.filter((t) => t.comanda).length;
        return (
          <section key={name}>
            <div style={m.secHead}>
              <span style={m.secName}>{name}</span>
              <span style={m.secCount}>{ocupadas}/{ts.length} ocupadas</span>
            </div>
            <div style={m.grid}>
              {[...ts].sort((a, b) => a.number - b.number).map((t) => {
                const st = stateOf(t.state);
                const c = t.comanda;
                return (
                  <button
                    key={t.id}
                    onClick={() => c && onOpen(c.id)}
                    disabled={!c}
                    style={{
                      ...m.tile,
                      borderColor: st.color,
                      background: c ? `color-mix(in srgb, ${st.color} 14%, transparent)` : "rgba(255,255,255,0.02)",
                      cursor: c ? "pointer" : "default",
                    }}
                  >
                    <div style={m.num}>{t.number}</div>
                    {c ? (
                      <>
                        <div style={{ ...m.total, color: st.color }}>{formatMXN(Number(c.total))}</div>
                        <div style={m.meta}>{c.waiter?.fullName ?? "—"}</div>
                        {c.billPrinted && <div style={m.flag}>ticket impreso</div>}
                      </>
                    ) : (
                      <div style={m.free}>Libre</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <div style={m.legend}>
        {Object.values(STATE)
          .filter((v, i, a) => a.findIndex((x) => x.label === v.label) === i)
          .map((v) => (
            <span key={v.label} style={m.legItem}>
              <span style={{ ...m.legDot, background: v.color }} />
              {v.label}
            </span>
          ))}
      </div>
    </div>
  );
}

const m: Record<string, React.CSSProperties> = {
  secHead: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 },
  secName: { color: C.gold, fontSize: "0.74rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" },
  secCount: { color: C.faint, fontSize: "0.72rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 },
  tile: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, textAlign: "left",
    border: "1px solid", borderRadius: 12, padding: "10px 12px", minHeight: 74, fontFamily: "inherit",
  },
  num: { color: C.cream, fontWeight: 800, fontSize: "0.9rem" },
  total: { fontWeight: 800, fontSize: "0.95rem" },
  meta: { color: C.dim, fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" },
  flag: { color: C.faint, fontSize: "0.64rem" },
  free: { color: C.faint, fontSize: "0.78rem" },
  legend: { display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 },
  legItem: { display: "flex", alignItems: "center", gap: 6, color: C.faint, fontSize: "0.72rem" },
  legDot: { width: 12, height: 12, borderRadius: 4, flexShrink: 0 },
};
