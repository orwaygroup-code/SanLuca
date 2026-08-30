"use client";

// Componente mesa individual reutilizable en todos los mapas

export type TableState = "available" | "occupied" | "selected" | "pair" | "triple" | "quad" | "disabled";

interface TableDotProps {
  number: number;
  capacity: number;
  state: TableState;
  style?: React.CSSProperties;
  onClick?: () => void;
  shape?: "circle" | "sofa" | "booth";
}

const stateStyle: Record<TableState, { bg: string; border: string; color: string; cursor: string }> = {
  available: { bg: "rgb(var(--sl-gold-rgb) / 0.12)", border: "rgb(var(--sl-gold-rgb) / 0.55)", color: "var(--sl-cream)",            cursor: "pointer"    },
  occupied:  { bg: "rgb(var(--sl-veil-rgb) / 0.03)", border: "rgb(var(--sl-veil-rgb) / 0.12)", color: "rgb(var(--sl-veil-rgb) / 0.2)", cursor: "default" },
  selected:  { bg: "rgb(var(--sl-gold-rgb) / 0.45)", border: "var(--sl-gold)",                color: "var(--sl-cream)",            cursor: "pointer"    },
  pair:      { bg: "rgb(var(--sl-gold-rgb) / 0.25)", border: "rgb(var(--sl-gold-rgb) / 0.85)", color: "var(--sl-cream)",            cursor: "pointer"    },
  triple:    { bg: "color-mix(in srgb, var(--sl-ok) 18%, transparent)",  border: "var(--sl-ok)",  color: "var(--sl-ok)", cursor: "pointer"     },
  quad:      { bg: "color-mix(in srgb, var(--sl-info) 18%, transparent)",  border: "var(--sl-info)",  color: "var(--sl-info)", cursor: "pointer"     },
  disabled:  { bg: "rgb(var(--sl-veil-rgb) / 0.02)", border: "rgb(var(--sl-veil-rgb) / 0.07)", color: "rgb(var(--sl-veil-rgb) / 0.15)", cursor: "not-allowed" },
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
