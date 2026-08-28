"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { formatMXN } from "@/lib/displayTotals";

interface WaiterRow {
  waiterId: number; name: string;
  sales: number; comandas: number; guests: number; items: number; tips: number;
  discounts: number; cancelCount: number; cancelValue: number;
  avgTicket: number; avgPerGuest: number; sharePct: number; activeNow: number;
  topDish: { name: string; qty: number } | null;
}
interface Data {
  range: string;
  totals: { sales: number; comandas: number; guests: number; tips: number; discounts: number; cancelValue: number };
  waiters: WaiterRow[];
}

const RANGES: { key: string; label: string }[] = [
  { key: "today", label: "Hoy" }, { key: "7d", label: "7 días" }, { key: "30d", label: "30 días" },
];
const MEDAL = ["#d4af37", "#b8b8b8", "#c07b3a"]; // oro / plata / bronce para el podio

// Métricas por mesero. `num` = valor para ordenar/barra (null = no ordenable, ej. "más vendido").
// `additive` = tiene sentido sumar entre meseros (para el % del total); los promedios no.
interface MetricDef {
  key: string; label: string; additive: boolean;
  num: ((w: WaiterRow) => number) | null;
  render: (w: WaiterRow) => string;
  accent?: (w: WaiterRow) => string | undefined;
}
const METRICS: MetricDef[] = [
  { key: "sales", label: "Ventas", additive: true, num: (w) => w.sales, render: (w) => formatMXN(w.sales) },
  { key: "comandas", label: "Cuentas", additive: true, num: (w) => w.comandas, render: (w) => String(w.comandas) },
  { key: "guests", label: "Comensales", additive: true, num: (w) => w.guests, render: (w) => String(w.guests) },
  { key: "avgTicket", label: "Ticket prom.", additive: false, num: (w) => w.avgTicket, render: (w) => formatMXN(w.avgTicket) },
  { key: "avgPerGuest", label: "Por persona", additive: false, num: (w) => w.avgPerGuest, render: (w) => formatMXN(w.avgPerGuest) },
  { key: "tips", label: "Propinas", additive: true, num: (w) => w.tips, render: (w) => formatMXN(w.tips) },
  { key: "items", label: "Platillos", additive: true, num: (w) => w.items, render: (w) => String(w.items) },
  { key: "discounts", label: "Descuentos", additive: true, num: (w) => w.discounts, render: (w) => (w.discounts > 0 ? formatMXN(w.discounts) : "—"), accent: (w) => (w.discounts > 0 ? "#63aede" : undefined) },
  { key: "cancelValue", label: "Cancelado", additive: true, num: (w) => w.cancelValue, render: (w) => (w.cancelCount > 0 ? `${w.cancelCount} · ${formatMXN(w.cancelValue)}` : "—"), accent: (w) => (w.cancelCount > 0 ? "#e8766b" : undefined) },
  { key: "topDish", label: "Más vendido", additive: false, num: null, render: (w) => (w.topDish ? `${w.topDish.name} (${w.topDish.qty})` : "—") },
];
const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<string, MetricDef>;
// Checkboxes de columnas = todas menos "Ventas" (que siempre es el encabezado del ranking).
const COLS = METRICS.filter((m) => m.key !== "sales");
const SORTABLE = METRICS.filter((m) => m.num); // "más vendido" no ordena

export default function MeserosPage() {
  const router = useRouter();
  const session = useSession();
  const [range, setRange] = useState("today");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("sales");
  const [visible, setVisible] = useState<Set<string>>(new Set(COLS.map((m) => m.key)));

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/meseros?range=${range}`, { credentials: "same-origin" });
    const d = await r.json().catch(() => null);
    if (d?.success) setData(d.data as Data);
    setLoading(false);
  }, [range]);

  useEffect(() => { if (session.user?.role === "ADMIN") load(); }, [session.user, load]);

  const toggleCol = (key: string) => setVisible((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const sortMetric = METRIC[sortKey] ?? METRIC.sales;
  const sorted = useMemo(() => {
    const list = [...(data?.waiters ?? [])];
    const getN = sortMetric.num ?? ((w: WaiterRow) => w.sales);
    return list.sort((a, b) => getN(b) - getN(a));
  }, [data, sortMetric]);
  const maxVal = sorted.reduce((m, w) => Math.max(m, (sortMetric.num ?? (() => 0))(w)), 0);
  const totalVal = sorted.reduce((s, w) => s + (sortMetric.num ?? (() => 0))(w), 0);

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><div style={{ padding: 40, color: C.dim }}>Cargando…</div></div>;
  }

  return (
    <div style={S.page}>
      <main style={S.main}>
        <div style={S.headRow}>
          <div>
            <h1 style={S.h1}>Meseros</h1>
            <div style={{ color: C.gold, fontSize: "0.84rem", marginTop: 2 }}>Quién vende más y su desempeño en piso</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} style={{ ...S.rangeBtn, ...(range === r.key ? S.rangeOn : {}) }}>{r.label}</button>
            ))}
          </div>
        </div>

        {loading || !data ? (
          <div style={{ padding: 40, color: C.dim }}>Cargando…</div>
        ) : data.waiters.length === 0 ? (
          <div style={{ padding: 40, color: C.dim }}>Sin ventas de meseros en este rango.</div>
        ) : (
          <>
            <div style={S.kpiGrid}>
              <Kpi label="Ventas totales" value={formatMXN(data.totals.sales)} big />
              <Kpi label="Cuentas pagadas" value={String(data.totals.comandas)} />
              <Kpi label="Comensales" value={String(data.totals.guests)} />
              <Kpi label="Propinas" value={formatMXN(data.totals.tips)} accent={C.gold} />
              <Kpi label="Descuentos" value={formatMXN(data.totals.discounts)} accent="#63aede" />
              <Kpi label="Cancelado" value={formatMXN(data.totals.cancelValue)} accent="#e8766b" />
            </div>

            {/* Ordenar por (una métrica) */}
            <div style={S.ctrlBlock}>
              <div style={S.ctrlLabel}>Ordenar por</div>
              <div style={S.chipRow}>
                {SORTABLE.map((m) => (
                  <button key={m.key} onClick={() => setSortKey(m.key)} style={{ ...S.chip, ...(sortKey === m.key ? S.chipOn : {}) }}>{m.label}</button>
                ))}
              </div>
            </div>

            {/* Mostrar columnas (varias) */}
            <div style={S.ctrlBlock}>
              <div style={S.ctrlLabel}>Mostrar</div>
              <div style={S.chipRow}>
                {COLS.map((m) => {
                  const on = visible.has(m.key);
                  return (
                    <button key={m.key} onClick={() => toggleCol(m.key)} style={{ ...S.check, ...(on ? S.checkOn : {}) }}>
                      <span style={{ ...S.box, ...(on ? S.boxOn : {}) }}>{on ? "✓" : ""}</span>{m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
              {sorted.map((w, i) => {
                const val = (sortMetric.num ?? (() => 0))(w);
                const share = sortMetric.additive && totalVal > 0 ? Math.round((val / totalVal) * 100) : null;
                return (
                  <div key={w.waiterId} style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ ...S.rank, color: i < 3 ? "#16201f" : C.cream, background: i < 3 ? MEDAL[i] : "rgba(255,255,255,0.06)" }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                          <span style={{ color: C.cream, fontWeight: 800, fontSize: "1.02rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                          <span style={{ color: C.gold, fontWeight: 800, fontSize: "1.05rem", whiteSpace: "nowrap" }}>{sortMetric.render(w)}</span>
                        </div>
                        <div style={S.barTrack}>
                          <div style={{ ...S.barFill, width: `${maxVal > 0 ? Math.max(3, (val / maxVal) * 100) : 0}%` }} />
                        </div>
                        <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 4 }}>
                          {sortMetric.key !== "sales" ? `${sortMetric.label}` : "Ventas"}
                          {share != null ? ` · ${share}% del total` : ""}
                          {w.activeNow > 0 ? ` · ${w.activeNow} activa${w.activeNow === 1 ? "" : "s"} ahora` : ""}
                        </div>
                      </div>
                    </div>

                    {visible.size > 0 && (
                      <div style={S.metrics}>
                        {COLS.filter((m) => visible.has(m.key)).map((m) => (
                          <Metric key={m.key} label={m.label} value={m.render(w)} wide={m.key === "topDish"} accent={m.accent?.(w)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, big, accent }: { label: string; value: string; big?: boolean; accent?: string }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={{ ...S.kpiValue, fontSize: big ? "1.7rem" : "1.25rem", color: accent ?? C.cream }}>{value}</div>
    </div>
  );
}
function Metric({ label, value, wide, accent }: { label: string; value: string; wide?: boolean; accent?: string }) {
  return (
    <div style={{ ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <div style={{ color: C.faint, fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ color: accent ?? C.cream, fontWeight: 700, fontSize: "0.9rem", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

const C = { bg: "#16201f", panel: "#1a2628", gold: "#ba843c", cream: "#f5f1e8", dim: "rgba(245,241,232,0.6)", faint: "rgba(245,241,232,0.4)", green: "#4caf50", border: "rgba(186,132,60,0.22)", line: "rgba(255,255,255,0.08)" };

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100%", background: C.bg },
  main: { maxWidth: 900, margin: "0 auto", padding: "20px 18px 60px" },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 18 },
  h1: { margin: 0, fontSize: "1.35rem", fontWeight: 800, color: C.cream },
  rangeBtn: { padding: "7px 13px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  rangeOn: { background: C.gold, color: "#16201f", borderColor: C.gold },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 },
  kpi: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" },
  kpiLabel: { color: C.faint, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 },
  kpiValue: { fontWeight: 800, marginTop: 4 },
  ctrlBlock: { marginBottom: 12 },
  ctrlLabel: { color: C.faint, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 7 },
  chipRow: { display: "flex", gap: 7, flexWrap: "wrap" },
  chip: { padding: "6px 12px", borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" },
  chipOn: { background: C.gold, color: "#16201f", borderColor: C.gold },
  check: { display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 8px", borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" },
  checkOn: { color: C.cream, borderColor: "rgba(186,132,60,0.5)" },
  box: { width: 16, height: 16, borderRadius: 4, border: `1px solid ${C.border}`, display: "grid", placeItems: "center", fontSize: "0.7rem", color: "#16201f", lineHeight: 1 },
  boxOn: { background: C.gold, borderColor: C.gold },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" },
  rank: { width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 800, fontSize: "0.95rem", flexShrink: 0 },
  barTrack: { height: 7, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: 7 },
  barFill: { height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${C.gold}, #d8a765)` },
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` },
};
