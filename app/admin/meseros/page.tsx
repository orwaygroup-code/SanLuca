"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function MeserosPage() {
  const router = useRouter();
  const session = useSession();
  const [range, setRange] = useState("today");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><div style={{ padding: 40, color: C.dim }}>Cargando…</div></div>;
  }

  const maxSales = data?.waiters.reduce((m, w) => Math.max(m, w.sales), 0) ?? 0;

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

            <div style={{ color: C.faint, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, margin: "8px 2px 12px" }}>
              Ranking por ventas
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.waiters.map((w, i) => (
                <div key={w.waiterId} style={S.card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ ...S.rank, color: i < 3 ? "#16201f" : C.cream, background: i < 3 ? MEDAL[i] : "rgba(255,255,255,0.06)" }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                        <span style={{ color: C.cream, fontWeight: 800, fontSize: "1.02rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                        <span style={{ color: C.gold, fontWeight: 800, fontSize: "1.05rem", whiteSpace: "nowrap" }}>{formatMXN(w.sales)}</span>
                      </div>
                      {/* Barra de ventas relativa al líder */}
                      <div style={S.barTrack}>
                        <div style={{ ...S.barFill, width: `${maxSales ? Math.max(3, (w.sales / maxSales) * 100) : 0}%` }} />
                      </div>
                      <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 4 }}>{w.sharePct}% del total{w.activeNow > 0 ? ` · ${w.activeNow} activa${w.activeNow === 1 ? "" : "s"} ahora` : ""}</div>
                    </div>
                  </div>

                  <div style={S.metrics}>
                    <Metric label="Cuentas" value={String(w.comandas)} />
                    <Metric label="Comensales" value={String(w.guests)} />
                    <Metric label="Ticket prom." value={formatMXN(w.avgTicket)} />
                    <Metric label="Por persona" value={formatMXN(w.avgPerGuest)} />
                    <Metric label="Propinas" value={formatMXN(w.tips)} />
                    <Metric label="Platillos" value={String(w.items)} />
                    <Metric label="Descuentos" value={w.discounts > 0 ? formatMXN(w.discounts) : "—"} accent={w.discounts > 0 ? "#63aede" : undefined} />
                    <Metric label="Cancelado" value={w.cancelCount > 0 ? `${w.cancelCount} · ${formatMXN(w.cancelValue)}` : "—"} accent={w.cancelCount > 0 ? "#e8766b" : undefined} />
                    <Metric label="Más vendido" value={w.topDish ? `${w.topDish.name} (${w.topDish.qty})` : "—"} wide />
                  </div>
                </div>
              ))}
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
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 22 },
  kpi: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" },
  kpiLabel: { color: C.faint, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 },
  kpiValue: { fontWeight: 800, marginTop: 4 },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" },
  rank: { width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 800, fontSize: "0.95rem", flexShrink: 0 },
  barTrack: { height: 7, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginTop: 7 },
  barFill: { height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${C.gold}, #d8a765)` },
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` },
};
