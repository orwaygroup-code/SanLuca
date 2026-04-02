"use client";
import { BlobTable } from "@/components/reservation/BlobTable";
import type { TableState } from "@/components/reservation/TableDot";
import type { AvailableTable, AvailablePair, TableSelection } from "@/components/reservation/types";
import { COMBINED_MAX_CAPACITY } from "@/lib/tableAdjacency";

interface Props {
  tables:    AvailableTable[];
  pairs:     AvailablePair[];
  guests:    number;
  selection: TableSelection | null;
  onSelect:  (sel: TableSelection) => void;
}

export function SalonMap({ tables, pairs, guests, selection, onSelect }: Props) {
  const byNumber = new Map(tables.map((t) => [t.number, t]));
  const pairIds  = new Set(pairs.flatMap((p) => [p.tableA.id, p.tableB.id]));

  function getState(t: AvailableTable): TableState {
    if (t.status === "occupied") return "occupied";
    if (selection?.tableId === t.id || selection?.linkedTableId === t.id) return "selected";
    if (guests >= 5 && guests <= COMBINED_MAX_CAPACITY && pairIds.has(t.id)) return "pair";
    if (t.capacity >= guests) return "available";
    return "disabled";
  }

  function handleClick(t: AvailableTable) {
    if (t.status === "occupied") return;
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
        position: "absolute", right: 0, top: 0, bottom: 0, width: "9%",
        background: "rgba(255,255,255,0.025)", borderLeft: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: "0.42rem", color: "rgba(255,255,255,0.22)", writingMode: "vertical-rl", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          ENTRADA
        </span>
      </div>

      {/* ── Leyenda sillones ── */}
      <div style={{
        position: "absolute", right: "12%", top: 10,
        fontSize: "0.42rem", color: "rgba(186,132,60,0.45)",
        letterSpacing: "0.14em", textTransform: "uppercase",
      }}>
        — Sillones
      </div>

      {/* ── Mesas izquierda ── */}
      {blob(8,  8,  26)}
      {blob(7,  22, 50)}
      {blob(4,  8,  76)}
      {blob(3,  22, 76)}

      {/* ── Mesas centro ── */}
      {blob(2, 42, 60)}

      {/* ── Sillones (como mesas) ── */}
      {blob(6, 55, 30)}
      {blob(5, 70, 30)}
      {blob(1, 70, 70)}
    </div>
  );
}
