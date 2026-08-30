"use client";
import { BlobTable } from "@/components/reservation/BlobTable";
import type { TableState } from "@/components/reservation/TableDot";
import type { AvailableTable, AvailablePair, AvailableTriple, AvailableQuad, TableSelection } from "@/components/reservation/types";
import { COMBINED_MAX_CAPACITY, TRIPLE_MIN_GUESTS, TRIPLE_MAX_CAPACITY, QUAD_MIN_GUESTS, QUAD_MAX_CAPACITY } from "@/lib/tableAdjacency";
import { tableFitsGuests } from "@/lib/tableCapacity";

interface Props {
  tables:    AvailableTable[];
  pairs:     AvailablePair[];
  triples:   AvailableTriple[];
  quads:     AvailableQuad[];
  guests:    number;
  selection: TableSelection | null;
  onSelect:  (sel: TableSelection) => void;
  renderTable?: (num: number, cx: number, cy: number, shape?: "round" | "sofa") => React.ReactNode;
}

export function TerrazaMap({ tables, pairs, triples, quads, guests, selection, onSelect, renderTable }: Props) {
  const byNumber = new Map(tables.map((t) => [t.number, t]));
  const pairIds   = new Set(pairs.flatMap((p) => [p.tableA.id, p.tableB.id]));
  const tripleIds = new Set(triples.flatMap((t) => [t.tableA.id, t.tableB.id, t.tableC.id]));
  const quadIds   = new Set(quads.flatMap((q) => [q.tableA.id, q.tableB.id, q.tableC.id, q.tableD.id]));

  function getState(t: AvailableTable): TableState {
    if (t.status === "occupied") return "occupied";
    if (selection?.tableId === t.id || selection?.linkedTableId === t.id || selection?.thirdTableId === t.id || selection?.fourthTableId === t.id) return "selected";
    if (guests >= QUAD_MIN_GUESTS && guests <= QUAD_MAX_CAPACITY && quadIds.has(t.id)) return "quad";
    if (guests >= TRIPLE_MIN_GUESTS && guests <= TRIPLE_MAX_CAPACITY && tripleIds.has(t.id)) return "triple";
    if (guests >= 5 && guests <= COMBINED_MAX_CAPACITY && pairIds.has(t.id)) return "pair";
    if (tableFitsGuests(t.capacity, guests)) return "available";
    return "disabled";
  }

  function handleClick(t: AvailableTable) {
    if (t.status === "occupied") return;
    if (guests >= QUAD_MIN_GUESTS && guests <= QUAD_MAX_CAPACITY) {
      const quad = quads.find((q) => q.tableA.id === t.id || q.tableB.id === t.id || q.tableC.id === t.id || q.tableD.id === t.id);
      if (quad) {
        onSelect({ tableId: quad.tableA.id, tableNumber: quad.tableA.number, linkedTableId: quad.tableB.id, linkedTableNumber: quad.tableB.number, thirdTableId: quad.tableC.id, thirdTableNumber: quad.tableC.number, fourthTableId: quad.tableD.id, fourthTableNumber: quad.tableD.number });
        return;
      }
    }
    if (guests >= TRIPLE_MIN_GUESTS && guests <= TRIPLE_MAX_CAPACITY) {
      const triple = triples.find((tr) => tr.tableA.id === t.id || tr.tableB.id === t.id || tr.tableC.id === t.id);
      if (triple) {
        onSelect({ tableId: triple.tableA.id, tableNumber: triple.tableA.number, linkedTableId: triple.tableB.id, linkedTableNumber: triple.tableB.number, thirdTableId: triple.tableC.id, thirdTableNumber: triple.tableC.number });
        return;
      }
    }
    if (guests >= 5 && guests <= COMBINED_MAX_CAPACITY) {
      const pair = pairs.find((p) => p.tableA.id === t.id || p.tableB.id === t.id);
      if (pair) {
        onSelect({ tableId: pair.tableA.id, tableNumber: pair.tableA.number, linkedTableId: pair.tableB.id, linkedTableNumber: pair.tableB.number });
        return;
      }
    }
    if (tableFitsGuests(t.capacity, guests)) onSelect({ tableId: t.id, tableNumber: t.number });
  }

  const blob = (num: number, cx: number, cy: number, shape?: "round" | "sofa") => {
    if (renderTable) return renderTable(num, cx, cy, shape);
    const t = byNumber.get(num);
    if (!t) return null;
    return <BlobTable key={num} tableNum={t.number} capacity={t.capacity} cx={cx} cy={cy} state={getState(t)} onClick={() => handleClick(t)} shape={shape} />;
  };

  return (
    <div style={{ width: "100%", aspectRatio: "16/7", position: "relative", background: "var(--sl-panel)", borderRadius: 14, border: "1px solid rgb(var(--sl-gold-rgb) / 0.35)", overflow: "hidden", userSelect: "none" }}>

      {/* ── Título ── */}
      <div style={{ position: "absolute", top: 10, left: 16 }}>
        <div style={{ fontSize: "clamp(0.7rem,1.8vw,1.1rem)", fontWeight: 700, letterSpacing: "0.06em" }}>
          <span style={{ color: "var(--sl-gold)" }}>SELECION</span>
          <span style={{ color: "var(--sl-cream)" }}> DE MESA</span>
        </div>
        <div style={{ fontSize: "clamp(0.5rem,1.2vw,0.7rem)", color: "rgb(var(--sl-cream-rgb) / 0.4)", letterSpacing: "0.12em", marginTop: 2 }}>TERRAZA</div>
      </div>

      {/* ── Salón 1 (edificio central) ── */}
      <div style={{ position: "absolute", left: "14%", top: "8%", width: "58%", height: "56%", background: "var(--sl-panel)", border: "1px solid rgb(var(--sl-veil-rgb) / 0.09)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "clamp(0.6rem,2vw,1rem)", color: "rgb(var(--sl-veil-rgb) / 0.18)", letterSpacing: "0.08em" }}>SALON 1</span>
      </div>

      {/* ── Privado ── */}
      <div style={{ position: "absolute", right: "2%", top: "8%", width: "20%", height: "56%", background: "var(--sl-panel)", border: "2px solid rgb(var(--sl-gold-rgb) / 0.5)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
          {[0,1,2,3,4,5].map(i => {
            const angle = (i / 6) * 2 * Math.PI - Math.PI / 2;
            const r = 22;
            return (
              <div key={i} style={{ position: "absolute", width: 13, height: 13, borderRadius: "50%", background: "var(--sl-panel2)", left: 28 + r * Math.cos(angle) - 6.5, top: 28 + r * Math.sin(angle) - 6.5 }} />
            );
          })}
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 26, height: 26, background: "var(--sl-panel2)", borderRadius: 7 }} />
        </div>
        <span style={{ fontSize: "clamp(0.45rem,1vw,0.65rem)", color: "rgb(var(--sl-gold-rgb) / 0.7)", letterSpacing: "0.1em" }}>PRIVADO</span>
      </div>

      {/* ── ENTRADA ── */}
      <div style={{ position: "absolute", left: "55%", top: "60%", width: "10%", height: "8%", background: "rgb(var(--sl-veil-rgb) / 0.05)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "0.42rem", color: "rgb(var(--sl-veil-rgb) / 0.25)", letterSpacing: "0.12em" }}>ENTRADA</span>
      </div>

      {/* ── Mesas columna izquierda ── */}
      {blob(18, 6,  22)}
      {blob(17, 6,  52)}

      {/* ── Fila inferior ── */}
      {blob(16, 5,  82)}
      {blob(15, 16, 82)}
      {blob(14, 27, 82)}
      {blob(13, 38, 82)}
      {blob(12, 49, 82)}
      {blob(11, 70, 82)}
      {blob(10, 82, 82)}
    </div>
  );
}
