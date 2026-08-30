"use client";

import React from "react";

// Filtro de fecha compartido de los reportes admin: presets (Hoy/7d/30d) O un rango de
// fechas / una sola fecha. Emite la query lista para los endpoints (range= o from=&to=).
export interface DateFilter { mode: "preset" | "custom"; range: string; from: string; to: string }
export const DEFAULT_FILTER: DateFilter = { mode: "preset", range: "today", from: "", to: "" };

export function dateFilterQuery(f: DateFilter): string {
  if (f.mode === "custom" && f.from) return `from=${f.from}&to=${f.to || f.from}`; // sin "hasta" = una sola fecha
  return `range=${f.range}`;
}

const P = { gold: "var(--sl-gold)", cream: "var(--sl-cream)", dim: "rgb(var(--sl-cream-rgb) / 0.6)", border: "rgb(var(--sl-gold-rgb) / 0.22)", panel: "var(--sl-panel)" };
const RANGES = [{ key: "today", label: "Hoy" }, { key: "7d", label: "7 días" }, { key: "30d", label: "30 días" }];

export function DateRangeBar({ value, onChange }: { value: DateFilter; onChange: (f: DateFilter) => void }) {
  const chip = (on: boolean): React.CSSProperties => ({
    padding: "7px 13px", borderRadius: 8, border: `1px solid ${on ? P.gold : P.border}`, background: on ? P.gold : "transparent",
    color: on ? "var(--sl-on-accent)" : P.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit",
  });
  const dateInput: React.CSSProperties = {
    padding: "6px 8px", borderRadius: 8, border: `1px solid ${value.mode === "custom" ? P.gold : P.border}`, background: "var(--sl-field)",
    color: "var(--sl-on-field)", fontFamily: "inherit", fontSize: "0.78rem", colorScheme: "dark",
  };
  const setPreset = (range: string) => onChange({ mode: "preset", range, from: "", to: "" });
  const setFrom = (from: string) => onChange({ ...value, mode: from ? "custom" : "preset", from });
  const setTo = (to: string) => onChange({ ...value, mode: "custom", to });
  const custom = value.mode === "custom" && !!value.from;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {RANGES.map((r) => (
        <button key={r.key} onClick={() => setPreset(r.key)} style={chip(value.mode === "preset" && value.range === r.key)}>{r.label}</button>
      ))}
      <span style={{ color: P.dim, fontSize: "0.9rem", margin: "0 2px" }}>|</span>
      <input type="date" value={value.from} max={value.to || undefined} onChange={(e) => setFrom(e.target.value)} style={dateInput} aria-label="Desde" title="Desde" />
      <span style={{ color: P.dim, fontSize: "0.8rem" }}>–</span>
      <input type="date" value={value.to} min={value.from || undefined} onChange={(e) => setTo(e.target.value)} style={dateInput} aria-label="Hasta" title="Hasta (vacío = una sola fecha)" />
      {custom && <button onClick={() => setPreset("today")} style={{ ...chip(false), padding: "7px 10px" }} title="Volver a los presets">×</button>}
    </div>
  );
}
