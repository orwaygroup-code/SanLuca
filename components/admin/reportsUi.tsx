import React from "react";

/**
 * Kit compartido de la sección "Reportes de venta" (/admin/reportes/*). Paleta,
 * formateadores y estilos de tabla comunes a las 3 subsecciones (Reportes,
 * Historial de venta, Cierres de turno) para una sola identidad visual.
 */

export const RP = {
  gold: "var(--sl-gold)",
  cream: "var(--sl-cream)",
  dim: "var(--sl-dim)",
  faint: "var(--sl-faint)",
  border: "var(--sl-border)",
  line: "var(--sl-line)",
  panel: "var(--sl-panel)",
  bg: "var(--sl-bg)",
  green: "var(--sl-green)",
  red: "var(--sl-red)",
};

export const money = (n: number | string) =>
  "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const shiftLabel = (s: string | null) => (s === "brunch" ? "Brunch" : s === "cena" ? "Comida" : "—");

const METHODS: Record<string, string> = {
  CASH: "Efectivo", CARD_DEBIT: "Débito", CARD_CREDIT: "T. crédito", TRANSFER: "Transf.", WAITER_CREDIT: "Crédito pers.",
};
export const methodLabel = (m: string) => METHODS[m] ?? m;

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const tbl: Record<string, React.CSSProperties> = {
  wrap: { overflowX: "auto", border: `1px solid ${RP.line}`, borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" },
  th: {
    textAlign: "left", padding: "10px 12px", color: RP.gold, fontWeight: 700, fontSize: "0.7rem",
    letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: `1px solid ${RP.border}`,
    whiteSpace: "nowrap", background: "rgba(255,255,255,0.02)",
  },
  td: { padding: "10px 12px", color: RP.cream, borderBottom: `1px solid ${RP.line}`, whiteSpace: "nowrap" },
  num: { textAlign: "right", fontVariantNumeric: "tabular-nums" },
};

export function Chip({ children, tone = "dim" }: { children: React.ReactNode; tone?: "dim" | "gold" | "green" | "red" }) {
  const c = tone === "gold" ? RP.gold : tone === "green" ? RP.green : tone === "red" ? RP.red : RP.dim;
  return (
    <span style={{ display: "inline-block", fontSize: "0.68rem", fontWeight: 700, color: c, border: `1px solid ${c}55`, borderRadius: 999, padding: "2px 8px", marginRight: 4, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function PageHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 4px", color: RP.cream }}>{title}</h1>
      {subtitle && <p style={{ opacity: 0.6, fontSize: "0.85rem", margin: 0, color: RP.cream }}>{subtitle}</p>}
    </div>
  );
}
