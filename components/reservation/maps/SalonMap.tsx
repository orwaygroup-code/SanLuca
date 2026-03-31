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

const BACK = "#14191a";

const C: Record<TableState, { bg: string; cushion: string; cBorder: string; text: string; lbl: string }> = {
  available: { bg: "#1e2a2c", cushion: "#2d3c3e", cBorder: "rgba(186,132,60,0.3)",    text: "#f5f1e8",               lbl: "rgba(186,132,60,0.8)"   },
  occupied:  { bg: "#181f21", cushion: "#1c2426", cBorder: "rgba(255,255,255,0.04)",   text: "rgba(255,255,255,0.15)", lbl: "rgba(255,255,255,0.1)"  },
  selected:  { bg: "#7a5220", cushion: "#ba843c", cBorder: "#e0a040",                  text: "#fff",                  lbl: "#fff"                   },
  pair:      { bg: "#251a08", cushion: "#3d2e14", cBorder: "rgba(186,132,60,0.6)",    text: "rgba(186,132,60,0.9)",  lbl: "rgba(186,132,60,0.75)"  },
  disabled:  { bg: "#161e20", cushion: "#191f21", cBorder: "rgba(255,255,255,0.03)",   text: "rgba(255,255,255,0.08)", lbl: "rgba(255,255,255,0.06)" },
};

/**
 * SofaSection — sofa with visible backing strip + individual cushions
 * orient "h-top"  → horizontal sofa, backing at top, cushions in a row below
 * orient "v-right"→ vertical sofa, backing on right, cushions in a column on left
 */
function SofaSection({
  tableNum, capacity, state, onClick, style, orient,
}: {
  tableNum: number; capacity: number; state: TableState;
  onClick?: () => void; style: React.CSSProperties;
  orient: "h-top" | "v-right";
}) {
  const c = C[state];
  const clickable = state === "available" || state === "pair" || state === "selected";
  const isH = orient === "h-top";

  return (
    <div
      onClick={clickable ? onClick : undefined}
      title={`M${tableNum} · ${capacity} personas`}
      style={{ position: "absolute", cursor: clickable ? "pointer" : "default", zIndex: 1, ...style }}
    >
      {/* Selection corner brackets */}
      {(state === "selected" || state === "pair") && [
        { top: -5, left: -5,  bw: "2px 0 0 2px" },
        { top: -5, right: -5, bw: "2px 2px 0 0" },
        { bottom: -5, left: -5,  bw: "0 0 2px 2px" },
        { bottom: -5, right: -5, bw: "0 2px 2px 0" },
      ].map((b, i) => (
        <div key={i} style={{
          position: "absolute", width: 9, height: 9, zIndex: 2,
          borderColor: "#ba843c", borderStyle: "solid", borderWidth: b.bw,
          top: (b as any).top, left: (b as any).left,
          right: (b as any).right, bottom: (b as any).bottom,
          pointerEvents: "none",
        }} />
      ))}

      {/* Sofa body */}
      <div style={{
        position: "absolute", inset: 0,
        background: c.bg,
        border: `1.5px solid ${c.cBorder}`,
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: isH ? "column" : "row",
        transition: "background 0.2s, border-color 0.2s",
      }}>
        {/* h-top: backing strip at top */}
        {isH && (
          <div style={{ height: "32%", minHeight: 8, flexShrink: 0, background: BACK, borderBottom: "1px solid rgba(0,0,0,0.3)" }} />
        )}

        {/* Cushions area */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: isH ? "row" : "column",
          gap: 3,
          padding: isH ? "3px 5px 4px" : "5px 3px 5px 5px",
        }}>
          {Array.from({ length: capacity }).map((_, i) => (
            <div key={i} style={{
              flex: 1, minHeight: 0, minWidth: 0,
              background: c.cushion,
              borderRadius: 5,
              border: `1px solid ${c.cBorder}`,
              transition: "background 0.2s",
            }} />
          ))}
        </div>

        {/* v-right: backing strip on right */}
        {!isH && (
          <div style={{ width: "32%", minWidth: 8, flexShrink: 0, background: BACK, borderLeft: "1px solid rgba(0,0,0,0.3)" }} />
        )}
      </div>

      {/* Label */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: c.text, textShadow: "0 1px 3px rgba(0,0,0,0.9)", letterSpacing: "0.04em" }}>
          M{tableNum}
        </span>
        <span style={{ fontSize: "0.44rem", color: c.lbl, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
          {capacity}p
        </span>
      </div>
    </div>
  );
}

// Small pill armrest shape
function Armrest({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{
      position: "absolute",
      background: "#253032",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 5,
      zIndex: 0,
      ...style,
    }} />
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

  const sofa = (num: number, style: React.CSSProperties, orient: "h-top" | "v-right") => {
    const t = byNumber.get(num);
    if (!t) return null;
    return <SofaSection key={num} tableNum={t.number} capacity={t.capacity} state={getState(t)} onClick={() => handleClick(t)} style={style} orient={orient} />;
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
          BOOTH ZONE — M5 + M6
          U-shaped sofa container
      ══════════════════════════════════════ */}
      <div style={{
        position: "absolute", left: "36%", top: "8%", width: "36%", height: "84%",
        background: "#1c2628", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
      }}>

        {/* Top horizontal sofa (decorative back of booth) */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "28%",
          background: "#1e2a2c",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column",
          borderRadius: "7px 7px 0 0",
          overflow: "hidden",
        }}>
          {/* Backing */}
          <div style={{ height: "35%", background: BACK, flexShrink: 0 }} />
          {/* 5 cushions */}
          <div style={{ flex: 1, display: "flex", flexDirection: "row", gap: 3, padding: "3px 6px 4px" }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ flex: 1, background: "#263234", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }} />
            ))}
          </div>
        </div>
        {/* Right armrest for top sofa */}
        <Armrest style={{ right: 2, top: "10%", width: 9, height: "12%" }} />

        {/* Left vertical sofa arm (decorative) */}
        <div style={{
          position: "absolute", left: 0, top: "28%", width: "17%", bottom: 0,
          background: "#1e2a2c",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "row",
          borderRadius: "0 0 0 7px",
          overflow: "hidden",
        }}>
          {/* Backing */}
          <div style={{ width: "35%", background: BACK, flexShrink: 0 }} />
          {/* 4 cushions */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, padding: "5px 2px 5px 0" }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ flex: 1, background: "#263234", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }} />
            ))}
          </div>
        </div>
        {/* Bottom armrest for left arm */}
        <Armrest style={{ left: "4%", bottom: 2, height: 9, width: "10%" }} />

        {/* M6 — left seating section */}
        {sofa(6, { left: "19%", top: "32%", width: "37%", height: "58%" }, "h-top")}

        {/* M5 — right seating section */}
        {sofa(5, { left: "58%", top: "32%", width: "37%", height: "58%" }, "h-top")}

        {/* Divider */}
        <div style={{ position: "absolute", left: "56%", top: "32%", width: "1px", height: "58%", background: "rgba(255,255,255,0.04)" }} />
      </div>

      {/* ══════════════════════════════════════
          M1 SOFA — right side, against wall
          Vertical, backing faces the wall (right)
      ══════════════════════════════════════ */}
      {/* Top armrest */}
      <Armrest style={{ left: "74%", top: "calc(50% - 8px)", width: "13%", height: 9 }} />

      {sofa(1, { left: "74%", top: "50%", width: "13%", height: "40%" }, "v-right")}

      {/* Bottom armrest */}
      <Armrest style={{ left: "74%", top: "90%", width: "13%", height: 9 }} />

      {/* M2 small round table */}
      {blob(2, 68, 76)}

      {/* ── Round tables (left side) ── */}
      {blob(8,  8,  26)}
      {blob(7,  22, 50)}
      {blob(4,  8,  76)}
      {blob(3,  22, 76)}
    </div>
  );
}
