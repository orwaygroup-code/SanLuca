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

export function PlantaAltaMap({ tables, pairs, guests, selection, onSelect }: Props) {
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
    <div style={{ width: "100%", aspectRatio: "16/7", position: "relative", background: "#1a2224", borderRadius: 14, border: "1px solid rgba(186,132,60,0.35)", overflow: "hidden", userSelect: "none" }}>

      {/* ── Título ── */}
      <div style={{ position: "absolute", top: 10, left: 16 }}>
        <div style={{ fontSize: "clamp(0.7rem,1.8vw,1.1rem)", fontWeight: 700, letterSpacing: "0.06em" }}>
          <span style={{ color: "#ba843c" }}>SELECION</span>
          <span style={{ color: "#f5f1e8" }}> DE MESA</span>
        </div>
        <div style={{ fontSize: "clamp(0.5rem,1.2vw,0.7rem)", color: "rgba(245,241,232,0.4)", letterSpacing: "0.12em", marginTop: 2 }}>PLANTA ALTA</div>
      </div>

      {/* ── ENTRADA (franja izquierda) ── */}
      <div style={{ position: "absolute", left: 0, top: "38%", width: "8%", height: "16%", background: "rgba(255,255,255,0.04)", borderRadius: "0 6px 6px 0", border: "1px solid rgba(255,255,255,0.07)", borderLeft: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "0.42rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>ENTRADA</span>
      </div>

      {/* ── Salón 1 (edificio derecho) ── */}
      <div style={{ position: "absolute", right: "2%", top: "10%", width: "46%", height: "80%", background: "#1e2a2c", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "clamp(0.6rem,2vw,1rem)", color: "rgba(255,255,255,0.18)", letterSpacing: "0.08em" }}>SALON 1</span>
      </div>

      {/* ── Mesas izquierda: M23, M25, M24 ── */}
      {blob(23, 18, 46)}
      {blob(25, 10, 76)}
      {blob(24, 22, 76)}

      {/* ── Mesas centro: M20, M21, M22 ── */}
      {blob(20, 37, 20)}
      {blob(21, 37, 50)}
      {blob(22, 37, 78)}
    </div>
  );
}
