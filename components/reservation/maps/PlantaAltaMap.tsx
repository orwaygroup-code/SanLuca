"use client";
import { BlobTable } from "@/components/reservation/BlobTable";
import type { TableState } from "@/components/reservation/TableDot";
import type { AvailableTable, AvailablePair, AvailableTriple, AvailableQuad, TableSelection } from "@/components/reservation/types";
import { COMBINED_MAX_CAPACITY, TRIPLE_MIN_GUESTS, TRIPLE_MAX_CAPACITY, QUAD_MIN_GUESTS, QUAD_MAX_CAPACITY } from "@/lib/tableAdjacency";

interface Props {
  tables:    AvailableTable[];
  pairs:     AvailablePair[];
  triples:   AvailableTriple[];
  quads:     AvailableQuad[];
  guests:    number;
  selection: TableSelection | null;
  onSelect:  (sel: TableSelection) => void;
}

export function PlantaAltaMap({ tables, pairs, triples, quads, guests, selection, onSelect }: Props) {
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
    if (t.capacity >= guests) return "available";
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
    if (t.capacity >= guests) onSelect({ tableId: t.id, tableNumber: t.number });
  }

  const blob = (num: number, cx: number, cy: number) => {
    const t = byNumber.get(num);
    if (!t) return null;
    return <BlobTable key={num} tableNum={t.number} capacity={t.capacity} cx={cx} cy={cy} state={getState(t)} onClick={() => handleClick(t)} />;
  };

  return (
    <div style={{ width: "100%", aspectRatio: "16/7", position: "relative", background: "#1a2224", borderRadius: 14, border: "1px solid rgba(186,132,60,0.35)", overflow: "hidden", userSelect: "none" }}>

      {/* ── Título ── */}
      <div style={{ position: "absolute", top: 10, left: 16 }}>
        <div style={{ fontSize: "clamp(0.7rem,1.8vw,1.1rem)", fontWeight: 700, letterSpacing: "0.06em" }}>
          <span style={{ color: "#ba843c" }}>SELECION</span>
          <span style={{ color: "#f5f1e8" }}> DE MESA</span>
        </div>
        <div style={{ fontSize: "clamp(0.5rem,1.2vw,0.7rem)", color: "rgba(245,241,232,0.4)", letterSpacing: "0.12em", marginTop: 2 }}>PLANTA ALTA</div>
      </div>

      {/* ── ENTRADA ── */}
      <div style={{ position: "absolute", left: 0, top: "38%", width: "8%", height: "16%", background: "rgba(255,255,255,0.04)", borderRadius: "0 6px 6px 0", border: "1px solid rgba(255,255,255,0.07)", borderLeft: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "0.42rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>ENTRADA</span>
      </div>

      {/* ── Salón 1 ── */}
      <div style={{ position: "absolute", right: "2%", top: "10%", width: "46%", height: "80%", background: "#1e2a2c", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "clamp(0.6rem,2vw,1rem)", color: "rgba(255,255,255,0.18)", letterSpacing: "0.08em" }}>SALON 1</span>
      </div>

      {/* ── Mesas izquierda ── */}
      {blob(23, 20, 46)}
      {blob(25, 11, 78)}
      {blob(24, 20, 78)}

      {/* ── Mesas centro ── */}
      {blob(20, 38, 20)}
      {blob(21, 38, 50)}
      {blob(22, 38, 78)}
    </div>
  );
}
