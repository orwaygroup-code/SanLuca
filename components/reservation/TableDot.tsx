"use client";

// Componente mesa individual reutilizable en todos los mapas

export type TableState = "available" | "occupied" | "selected" | "pair" | "triple" | "disabled";

interface TableDotProps {
  number: number;
  capacity: number;
  state: TableState;
  style?: React.CSSProperties;
  onClick?: () => void;
  shape?: "circle" | "sofa" | "booth";
}

const stateStyle: Record<TableState, { bg: string; border: string; color: string; cursor: string }> = {
  available: { bg: "rgba(186,132,60,0.12)", border: "rgba(186,132,60,0.55)", color: "#f5f1e8",            cursor: "pointer"    },
  occupied:  { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.2)", cursor: "default" },
  selected:  { bg: "rgba(186,132,60,0.45)", border: "#ba843c",                color: "#f5f1e8",            cursor: "pointer"    },
  pair:      { bg: "rgba(186,132,60,0.25)", border: "rgba(186,132,60,0.85)", color: "#f5f1e8",            cursor: "pointer"    },
  triple:    { bg: "rgba(100,160,80,0.18)", border: "rgba(100,160,80,0.75)",  color: "rgba(140,210,110,0.9)", cursor: "pointer" },
  disabled:  { bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.15)", cursor: "not-allowed" },
};

export function TableDot({
  number,
  capacity,
  state,
  style,
  onClick,
  shape = "circle",
}: TableDotProps) {
  const s = stateStyle[state];
  const isRound = shape === "circle";

  return (
    <button
      onClick={state === "occupied" || state === "disabled" ? undefined : onClick}
      title={`M${number} · ${capacity} personas · ${state === "occupied" ? "Ocupada" : state === "selected" || state === "pair" ? "Seleccionada" : "Disponible"}`}
      style={{
        position:        "absolute",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        background:      s.bg,
        border:          `2px solid ${s.border}`,
        borderRadius:    isRound ? "50%" : shape === "sofa" ? "12px" : "8px",
        color:           s.color,
        cursor:          s.cursor,
        transition:      "all 0.2s ease",
        outline:         "none",
        padding:         0,
        userSelect:      "none",
        ...style,
      }}
    >
      <span style={{ fontSize: "0.65rem", fontWeight: 700, lineHeight: 1 }}>M{number}</span>
      <span style={{ fontSize: "0.5rem", opacity: 0.7, lineHeight: 1, marginTop: 2 }}>{capacity}p</span>
    </button>
  );
}
