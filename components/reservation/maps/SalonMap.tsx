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

const C: Record<TableState, { bg: string; border: string; text: string; sub: string }> = {
  available: { bg: "#1e2a2c", border: "rgba(186,132,60,0.4)",  text: "#f5f1e8",               sub: "rgba(186,132,60,0.7)"  },
  occupied:  { bg: "#181f21", border: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.15)", sub: "rgba(255,255,255,0.1)" },
  selected:  { bg: "#7a5220", border: "#e0a040",               text: "#fff",                  sub: "rgba(255,255,255,0.8)" },
  pair:      { bg: "#251a08", border: "rgba(186,132,60,0.6)",  text: "rgba(186,132,60,0.9)",  sub: "rgba(186,132,60,0.7)"  },
  disabled:  { bg: "#161e20", border: "rgba(255,255,255,0.03)", text: "rgba(255,255,255,0.08)", sub: "rgba(255,255,255,0.06)" },
};

function SillonBox({
  tableNum, capacity, state, onClick, style,
}: {
  tableNum: number; capacity: number; state: TableState;
  onClick?: () => void; style: React.CSSProperties;
}) {
  const c = C[state];
  const clickable = state === "available" || state === "pair" || state === "selected";

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        position: "absolute",
        cursor: clickable ? "pointer" : "default",
        background: c.bg,
        border: `1.5px solid ${c.border}`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        transition: "background 0.2s, border-color 0.2s",
        zIndex: 1,
        ...style,
      }}
    >
      {(state === "selected" || state === "pair") && [
        { top: -5, left: -5,    bw: "2px 0 0 2px" },
        { top: -5, right: -5,   bw: "2px 2px 0 0" },
        { bottom: -5, left: -5,  bw: "0 0 2px 2px" },
        { bottom: -5, right: -5, bw: "0 2px 2px 0" },
      ].map((b, i) => (
        <div key={i} style={{
          position: "absolute", width: 9, height: 9, zIndex: 2, pointerEvents: "none",
          borderColor: "#ba843c", borderStyle: "solid", borderWidth: b.bw,
          top: (b as any).top, left: (b as any).left,
          right: (b as any).right, bottom: (b as any).bottom,
        }} />
      ))}
      <span style={{ fontSize: "0.55rem", fontWeight: 800, color: c.text, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Sillón
      </span>
      <span style={{ fontSize: "0.5rem", fontWeight: 700, color: c.text, letterSpacing: "0.04em" }}>
        M{tableNum}
      </span>
      <span style={{ fontSize: "0.42rem", color: c.sub }}>
        {capacity}p
      </span>
    </div>
  );
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

  const sillon = (num: number, style: React.CSSProperties) => {
    const t = byNumber.get(num);
    if (!t) return null;
    return <SillonBox key={num} tableNum={t.number} capacity={t.capacity} state={getState(t)} onClick={() => handleClick(t)} style={style} />;
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

      {/* ══════════════════════════════════════
          ZONA SILLONES — M1, M5, M6
      ══════════════════════════════════════ */}
      <div style={{
        position: "absolute", left: "33%", top: "8%", width: "57%", height: "84%",
        background: "#1c2628", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
      }}>
        <div style={{
          position: "absolute", top: 6, left: 0, right: 0,
          textAlign: "center", fontSize: "0.42rem",
          color: "rgba(255,255,255,0.2)", letterSpacing: "0.14em", textTransform: "uppercase",
        }}>
          Zona Sillones
        </div>

        {sillon(6, { left: "3%",  top: "20%", width: "29%", height: "38%" })}
        {sillon(5, { left: "35%", top: "20%", width: "29%", height: "38%" })}
        {sillon(1, { left: "35%", top: "62%", width: "29%", height: "30%" })}
      </div>

      {/* M2 — mesa en zona de sillones */}
      {blob(2, 44, 80)}

      {/* ── Mesas (lado izquierdo) ── */}
      {blob(8,  8,  26)}
      {blob(7,  22, 50)}
      {blob(4,  8,  76)}
      {blob(3,  22, 76)}
    </div>
  );
}
