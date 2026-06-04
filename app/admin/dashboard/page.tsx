"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { AdminNav } from "@/components/admin/AdminNav";
import { formatMXN } from "@/lib/displayTotals";

interface Report {
  range: string;
  kpis: { sales: number; taxCollected: number; comandas: number; guests: number; avgTicket: number; activeNow: number };
  byHour: { hour: number; sales: number }[];
  bySection: { section: string; sales: number; comandas: number }[];
  byWaiter: { waiter: string; sales: number; comandas: number }[];
  topDishes: { name: string; qty: number; revenue: number }[];
}

const RANGES: { key: string; label: string }[] = [
  { key: "today", label: "Hoy" }, { key: "7d", label: "7 días" }, { key: "30d", label: "30 días" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const session = useSession();
  const [range, setRange] = useState("today");
  const [rep, setRep] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/reports?range=${range}`, { credentials: "same-origin" });
    const d = await r.json().catch(() => null);
    if (d?.success) setRep(d.data as Report);
    setLoading(false);
  }, [range]);

  useEffect(() => { if (session.user?.role === "ADMIN") load(); }, [session.user, load]);

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><div style={{ padding: 40, color: C.dim }}>Cargando…</div></div>;
  }

  const logout = async () => { await session.logout(); router.replace("/login?mode=login"); };
  const k = rep?.kpis;

  return (
    <div style={S.page}>
      <AdminNav userName={session.user.name} onLogout={logout} />
      <main style={S.main}>
        <div style={S.headRow}>
          <h1 style={S.h1}>Dashboard de ventas</h1>
          <div style={{ display: "flex", gap: 6 }}>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)}
                style={{ ...S.rangeBtn, ...(range === r.key ? S.rangeOn : {}) }}>{r.label}</button>
            ))}
          </div>
        </div>

        {loading || !rep ? (
          <div style={{ padding: 40, color: C.dim }}>Cargando reporte…</div>
        ) : (
          <>
            <div style={S.kpiGrid}>
              <Kpi label="Ventas" value={formatMXN(k!.sales)} big />
              <Kpi label="IVA recaudado" value={formatMXN(k!.taxCollected)} />
              <Kpi label="Comandas pagadas" value={String(k!.comandas)} />
              <Kpi label="Comensales" value={String(k!.guests)} />
              <Kpi label="Ticket promedio" value={formatMXN(k!.avgTicket)} />
              <Kpi label="Activas ahora" value={String(k!.activeNow)} accent={C.green} />
            </div>

            <Panel title="Ventas por hora">
              {rep.byHour.length === 0 ? <Empty /> : (
                <BarChart data={rep.byHour.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, value: h.sales }))} format={formatMXN} />
              )}
            </Panel>

            <div style={S.twoCol}>
              <Panel title="Ventas por sección">
                {rep.bySection.length === 0 ? <Empty /> : (
                  <BarChart data={rep.bySection.map((s) => ({ label: `${s.section} (${s.comandas})`, value: s.sales }))} format={formatMXN} />
                )}
              </Panel>
              <Panel title="Ventas por mesero">
                {rep.byWaiter.length === 0 ? <Empty /> : (
                  <BarChart data={rep.byWaiter.map((w) => ({ label: `${w.waiter} (${w.comandas})`, value: w.sales }))} format={formatMXN} />
                )}
              </Panel>
            </div>

            <Panel title="Top platillos">
              {rep.topDishes.length === 0 ? <Empty /> : (
                <div>
                  {rep.topDishes.map((d, i) => (
                    <div key={d.name} style={S.dishRow}>
                      <span style={{ color: C.dim, width: 22 }}>{i + 1}.</span>
                      <span style={{ color: C.cream, flex: 1, minWidth: 0 }}>{d.name}</span>
                      <span style={{ color: C.gold, fontWeight: 700, width: 70, textAlign: "right" }}>{d.qty}×</span>
                      <span style={{ color: C.cream, width: 110, textAlign: "right" }}>{formatMXN(d.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={S.panel}>
      <div style={S.panelHead}>{title}</div>
      <div style={{ padding: "14px 18px 18px" }}>{children}</div>
    </section>
  );
}

function Empty() { return <div style={{ color: C.faint, fontSize: "0.85rem", padding: "12px 0" }}>Sin datos en este rango.</div>; }

/** Bar chart horizontal con CSS puro (sin dependencias). */
function BarChart({ data, format }: { data: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: C.dim, fontSize: "0.76rem", width: 130, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden", height: 22 }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: "linear-gradient(90deg,#9a6c2e,#ba843c)", minWidth: d.value > 0 ? 3 : 0 }} />
          </div>
          <span style={{ color: C.cream, fontSize: "0.78rem", width: 100, textAlign: "right", fontWeight: 600 }}>{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

const C = { bg: "#16201f", panel: "#1a2628", gold: "#ba843c", cream: "#f5f1e8", dim: "rgba(245,241,232,0.6)", faint: "rgba(245,241,232,0.4)", green: "#4caf50", border: "rgba(186,132,60,0.22)", line: "rgba(255,255,255,0.08)" };

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: C.bg },
  main: { padding: "22px", maxWidth: 1100, margin: "0 auto" },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  h1: { margin: 0, color: C.cream, fontSize: "1.4rem", fontWeight: 800 },
  rangeBtn: { padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  rangeOn: { background: C.panel, color: C.cream, borderColor: C.border },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 },
  kpi: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" },
  kpiLabel: { color: C.faint, fontSize: "0.66rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 },
  kpiValue: { fontWeight: 800, marginTop: 6 },
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  panelHead: { padding: "12px 18px", borderBottom: `1px solid ${C.line}`, color: C.faint, fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 },
  twoCol: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 },
  dishRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.line}`, fontSize: "0.86rem" },
};
