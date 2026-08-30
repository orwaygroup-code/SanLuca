"use client";

// Tabla estilo blob: rectángulo central redondeado + círculos de sillas alrededor
// Reproduces el look exacto del PDF de selección de mesa

import type { TableState } from "@/components/reservation/TableDot";

interface BlobTableProps {
  tableNum:  number;
  capacity:  number;
  cx:        number; // % horizontal (centro)
  cy:        number; // % vertical (centro)
  state:     TableState;
  onClick?:  () => void;
  shape?:    "round" | "sofa"; // sofa = rectángulo para M1
  // Modo "en vivo" (piso con comandas): override de color y texto secundario. No lo usa
  // el flujo de reservas (queda igual). `sub` reemplaza "{capacity}p" (ej. total).
  fill?:     Partial<{ table: string; chair: string; text: string; border: string }>;
  sub?:      string;
  forceClickable?: boolean;
}

// Dimensiones según capacidad
function dims(capacity: number, shape: "round" | "sofa") {
  if (shape === "sofa") return { tw: 56, th: 40 };
  if (capacity >= 6)    return { tw: 52, th: 52 };
  if (capacity >= 4)    return { tw: 44, th: 44 };
  if (capacity >= 3)    return { tw: 40, th: 40 };
  return                       { tw: 34, th: 34 };
}

// Ángulos de sillas (en radianes, empezando desde arriba)
function chairAngles(capacity: number, shape: "round" | "sofa"): number[] {
  if (shape === "sofa") {
    // Para el sillón: 1 arriba, 1 derecha, 1 abajo
    return [-Math.PI / 2, 0, Math.PI / 2];
  }
  if (capacity === 2) return [-Math.PI / 2, Math.PI / 2];
  return Array.from({ length: capacity }, (_, i) =>
    -Math.PI / 2 + (i / capacity) * 2 * Math.PI
  );
}

// Colores por estado.
//
// El estado se comunica por el TINTE de la mesa, no por su luminosidad, así que
// cada tinte se deriva del token de su color —acento, verde, azul— mezclado
// sobre el panel. Con literales, la mitad del mapa se aclaraba con el tema y la
// otra mitad se quedaba oscura, y el número de las ocupadas desaparecía.
const stateColors: Record<TableState, { table: string; chair: string; text: string; border: string }> = {
  available: { table: "var(--sl-panel2)", chair: "var(--sl-panel2)", text: "var(--sl-cream)",             border: "none" },
  occupied:  { table: "var(--sl-panel)",  chair: "var(--sl-panel)",  text: "rgb(var(--sl-veil-rgb) / 0.15)", border: "none" },
  selected:  { table: "var(--sl-gold)",   chair: "var(--sl-gold-deep)", text: "var(--sl-on-accent)",      border: "2px solid var(--sl-gold)" },
  pair:      { table: "color-mix(in srgb, var(--sl-gold) 24%, var(--sl-panel))", chair: "color-mix(in srgb, var(--sl-gold) 14%, var(--sl-panel))", text: "var(--sl-gold)", border: "2px solid rgb(var(--sl-gold-rgb) / 0.7)" },
  triple:    { table: "color-mix(in srgb, var(--sl-ok) 24%, var(--sl-panel))",   chair: "color-mix(in srgb, var(--sl-ok) 14%, var(--sl-panel))",   text: "var(--sl-ok)",   border: "2px solid var(--sl-ok)" },
  quad:      { table: "color-mix(in srgb, var(--sl-info) 24%, var(--sl-panel))", chair: "color-mix(in srgb, var(--sl-info) 14%, var(--sl-panel))", text: "var(--sl-info)", border: "2px solid var(--sl-info)" },
  disabled:  { table: "var(--sl-panel)",  chair: "var(--sl-panel)",  text: "rgb(var(--sl-veil-rgb) / 0.1)",  border: "none" },
};

export function BlobTable({ tableNum, capacity, cx, cy, state, onClick, shape = "round", fill, sub, forceClickable }: BlobTableProps) {
  const { tw, th } = dims(capacity, shape);
  const c = { ...stateColors[state], ...(fill ?? {}) };
  const chairR  = shape === "sofa" ? 9 : Math.max(8, Math.round(tw * 0.18));
  const dist     = (Math.max(tw, th) / 2) + chairR + 3;
  const angles   = chairAngles(capacity, shape);
  const pad      = chairR * 2 + 4;
  const boxW     = tw + pad * 2;
  const boxH     = th + pad * 2;
  const clickable = forceClickable !== undefined
    ? forceClickable
    : (state === "available" || state === "pair" || state === "triple" || state === "quad" || state === "selected");

  return (
    <div
      style={{
        position:  "absolute",
        left:      `${cx}%`,
        top:       `${cy}%`,
        transform: "translate(-50%, -50%)",
        width:     boxW,
        height:    boxH,
        pointerEvents: clickable ? "auto" : "none",
      }}
    >
      {/* Sillas */}
      {angles.map((angle, i) => (
        <div
          key={i}
          style={{
            position:     "absolute",
            width:        chairR * 2,
            height:       chairR * 2,
            borderRadius: "50%",
            background:   c.chair,
            left:         boxW / 2 + dist * Math.cos(angle) - chairR,
            top:          boxH / 2 + dist * Math.sin(angle) - chairR,
          }}
        />
      ))}

      {/* Mesa */}
      <button
        onClick={clickable ? onClick : undefined}
        style={{
          position:     "absolute",
          left:         boxW / 2 - tw / 2,
          top:          boxH / 2 - th / 2,
          width:        tw,
          height:       th,
          background:   c.table,
          borderRadius: shape === "sofa" ? 10 : tw * 0.28,
          border:       c.border,
          color:        c.text,
          fontSize:     "0.62rem",
          fontWeight:   700,
          letterSpacing: "0.02em",
          cursor:       clickable ? "pointer" : "default",
          zIndex:       1,
          display:      "flex",
          flexDirection: "column",
          alignItems:   "center",
          justifyContent: "center",
          gap:          1,
          outline:      "none",
          transition:   "background 0.2s, border-color 0.2s",
        }}
      >
        <span>M{tableNum}</span>
        <span style={{ fontSize: "0.48rem", opacity: 0.75 }}>{sub ?? `${capacity}p`}</span>
      </button>

      {/* Indicador de selección: brackets en las 4 esquinas */}
      {(state === "selected" || state === "pair" || state === "triple" || state === "quad") && (
        <>
          {[
            { top: boxH/2 - th/2 - 8, left: boxW/2 - tw/2 - 8, bw: "2px 0 0 2px" },
            { top: boxH/2 - th/2 - 8, left: boxW/2 + tw/2 - 4, bw: "2px 2px 0 0" },
            { top: boxH/2 + th/2 - 4, left: boxW/2 - tw/2 - 8, bw: "0 0 2px 2px" },
            { top: boxH/2 + th/2 - 4, left: boxW/2 + tw/2 - 4, bw: "0 2px 2px 0" },
          ].map((b, i) => (
            <div key={i} style={{
              position: "absolute",
              width: 12, height: 12,
              top: b.top, left: b.left,
              borderColor: "var(--sl-gold)",
              borderStyle: "solid",
              borderWidth: b.bw,
              pointerEvents: "none",
            }} />
          ))}
        </>
      )}
    </div>
  );
}
