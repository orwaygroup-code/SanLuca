"use client";
import { BlobTable } from "@/components/reservation/BlobTable";
import type { TableState } from "@/components/reservation/TableDot";
import type { AvailableTable, AvailablePair, AvailableTriple, TableSelection } from "@/components/reservation/types";
import { COMBINED_MAX_CAPACITY, TRIPLE_MIN_GUESTS, TRIPLE_MAX_CAPACITY } from "@/lib/tableAdjacency";

interface Props {
  tables:    AvailableTable[];
  pairs:     AvailablePair[];
  triples:   AvailableTriple[];
  guests:    number;
  selection: TableSelection | null;
  onSelect:  (sel: TableSelection) => void;
}

export function SalonMap({ tables, pairs, triples, guests, selection, onSelect }: Props) {
  const byNumber = new Map(tables.map((t) => [t.number, t]));
  const pairIds   = new Set(pairs.flatMap((p) => [p.tableA.id, p.tableB.id]));
  const tripleIds = new Set(triples.flatMap((t) => [t.tableA.id, t.tableB.id, t.tableC.id]));

  function getState(t: AvailableTable): TableState {
    if (t.status === "occupied") return "occupied";
    if (selection?.tableId === t.id || selection?.linkedTableId === t.id || selection?.thirdTableId === t.id) return "selected";
    if (guests >= TRIPLE_MIN_GUESTS && guests <= TRIPLE_MAX_CAPACITY && tripleIds.has(t.id)) return "triple";
    if (guests >= 5 && guests <= COMBINED_MAX_CAPACITY && pairIds.has(t.id)) return "pair";
    if (t.capacity >= guests) return "available";
    return "disabled";
  }

  function handleClick(t: AvailableTable) {
    if (t.status === "occupied") return;
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
    <div style={{
      width: "100%", aspectRatio: "16/7", position: "relative",
      background: "#1a2224", borderRadius: 14,
      border: "1px solid rgba(186,132,60,0.35)",
      overflow: "hidden", userSelect: "none",
    }}>

      {/* ── Title ── */}
      <div style={{ position: "absolute", top: 10, left: 16 }}>
        <div style={{ fontSize: "clamp(0.7rem,1.8vw,1.1rem)", fontWeight: 700, letterSpacing: "0.06em" }}>
          <span style={{ color: "#ba843c" }}>SELECCIÓN</span>
          <span style={{ color: "#f5f1e8" }}> DE MESA</span>
        </div>
        <div style={{ fontSize: "clamp(0.5rem,1.2vw,0.7rem)", color: "rgba(245,241,232,0.4)", letterSpacing: "0.12em", marginTop: 2 }}>
          SALÓN Y SILLONES
        </div>
      </div>

      {/* ── ENTRADA (right strip) ── */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "8%",
        background: "rgba(255,255,255,0.025)", borderLeft: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: "0.42rem", color: "rgba(255,255,255,0.22)", writingMode: "vertical-rl", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          ENTRADA
        </span>
      </div>

      {/* ── Zona sillones ── */}
      <div style={{
        position: "absolute", left: "36%", top: "6%", width: "54%", height: "88%",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
        background: "rgba(255,255,255,0.015)",
      }}>
        <div style={{ position: "absolute", top: 5, left: 10, fontSize: "0.38rem", color: "rgba(186,132,60,0.4)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Sillones
        </div>
      </div>

      {/* ── Mesas izquierda (grid 2×2) ── */}
      {blob(8,  9,  27)}
      {blob(7,  26, 27)}
      {blob(4,  9,  73)}
      {blob(3,  26, 73)}

      {/* ── Mesa centro-baja ── */}
      {blob(2, 47, 73)}

      {/* ── Sillones ── */}
      {blob(6, 55, 30)}
      {blob(5, 70, 30)}
      {blob(1, 70, 70)}
    </div>
  );
}
