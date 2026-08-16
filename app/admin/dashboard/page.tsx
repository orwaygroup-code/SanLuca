"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-client";
import { formatMXN } from "@/lib/displayTotals";

interface ShiftStat { shift: string; label: string; window: string; sales: number; comandas: number; guests: number; avgTicket: number; occupancy: number; topDish: { name: string; qty: number } | null }
interface Corte { id: number; folio: string; shift: string | null; status: string; openedAt: string; closedAt: string | null; comandas: number; sales: number }
interface Report {
  range: string;
  cashSessionId: number | null;
  kpis: { sales: number; taxCollected: number; tips: number; comandas: number; guests: number; avgTicket: number; activeNow: number };
  byShift: ShiftStat[];
  cortes: Corte[];
  byHour: { hour: number; sales: number }[];
  topDishes: { name: string; qty: number; revenue: number }[];
}

const RANGES: { key: string; label: string }[] = [
  { key: "today", label: "Hoy" }, { key: "7d", label: "7 días" }, { key: "30d", label: "30 días" },
];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

export default function AdminDashboardPage() {
  const router = useRouter();
  const session = useSession();
  const [range, setRange] = useState("today");
  const [sessionId, setSessionId] = useState<number | null>(null); // corte seleccionado (turno por corte)
  const [rep, setRep] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = sessionId != null ? `cashSessionId=${sessionId}` : `range=${range}`;
    const r = await fetch(`/api/admin/reports?${qs}`, { credentials: "same-origin" });
    const d = await r.json().catch(() => null);
    if (d?.success) setRep(d.data as Report);
    setLoading(false);
  }, [range, sessionId]);

  useEffect(() => { if (session.user?.role === "ADMIN") load(); }, [session.user, load]);

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><div style={{ padding: 40, color: C.dim }}>Cargando…</div></div>;
  }

  const k = rep?.kpis;
  const activeCorte = sessionId != null ? rep?.cortes.find((c) => c.id === sessionId) ?? null : null;

  return (
    <div style={S.page}>
      <main style={S.main}>
        <div style={S.headRow}>
          <div>
            <h1 style={S.h1}>Dashboard de ventas</h1>
            <div style={{ color: C.gold, fontSize: "0.84rem", marginTop: 2 }}>
              {activeCorte ? `Corte ${activeCorte.folio}${activeCorte.status === "OPEN" ? " · abierto" : ""}` : "Comparación de turnos: Comida vs Brunch"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {activeCorte && <button style={{ ...S.rangeBtn, ...S.rangeOn }} onClick={() => setSessionId(null)}>← Ver todo el día</button>}
            {!activeCorte && RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} style={{ ...S.rangeBtn, ...(range === r.key ? S.rangeOn : {}) }}>{r.label}</button>
            ))}
          </div>
        </div>

        {loading || !rep ? (
          <div style={{ padding: 40, color: C.dim }}>Cargando reporte…</div>
        ) : (
          <>
            {/* KPIs */}
            <div style={S.kpiGrid}>
              <Kpi label="Ventas totales" value={formatMXN(k!.sales)} big />
              <Kpi label="Comandas pagadas" value={String(k!.comandas)} />
              <Kpi label="Ticket promedio" value={formatMXN(k!.avgTicket)} />
              <Kpi label="Activas ahora" value={String(k!.activeNow)} accent={C.green} />
            </div>

            {/* Comparación de turnos (Comida vs Brunch) */}
            <div style={S.shiftGrid}>
              {rep.byShift.map((sh) => (
                <div key={sh.shift} style={S.shiftCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ color: C.gold, fontWeight: 800, fontSize: "1.05rem" }}>Turno {sh.label}</span>
                    <span style={{ color: C.faint, fontSize: "0.72rem" }}>{sh.window}</span>
                  </div>
                  <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.5rem", marginTop: 8 }}>{formatMXN(sh.sales)}</div>
                  <div style={{ display: "flex", gap: 16, color: C.dim, fontSize: "0.78rem", marginTop: 2 }}>
                    <span>{sh.comandas} comandas</span><span>Ticket {formatMXN(sh.avgTicket)}</span>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: C.faint, fontSize: "0.72rem", marginBottom: 4 }}>
                      <span>Ocupación</span><span>{sh.occupancy}%</span>
                    </div>
                    <div style={S.occTrack}><div style={{ ...S.occFill, width: `${sh.occupancy}%` }} /></div>
                  </div>
                  {sh.topDish && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: C.faint, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Top platillo</span>
                      <span style={S.topPill}>{sh.topDish.name} · {sh.topDish.qty}×</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Turnos por corte de caja */}
            {rep.cortes.length > 0 && (
              <Panel title="Turnos por corte de caja (hoy)">
                <div style={S.corteRow}>
                  {rep.cortes.map((c) => {
                    const on = sessionId === c.id;
                    return (
                      <button key={c.id} onClick={() => setSessionId(on ? null : c.id)} style={{ ...S.corte, ...(on ? S.corteOn : {}) }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ color: C.gold, fontWeight: 800, fontSize: "0.78rem" }}>{c.folio}</span>
                          <span style={{ color: c.status === "OPEN" ? C.green : C.faint, fontSize: "0.68rem", fontWeight: 700 }}>{c.status === "OPEN" ? "Abierto" : "Cerrado"}</span>
                        </div>
                        <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.1rem", marginTop: 6 }}>{formatMXN(c.sales)}</div>
                        <div style={{ color: C.dim, fontSize: "0.72rem", marginTop: 2 }}>{c.comandas} comandas · {hhmm(c.openedAt)}{c.closedAt ? `–${hhmm(c.closedAt)}` : ""}</div>
                      </button>
                    );
                  })}
                </div>
                <p style={{ color: C.faint, fontSize: "0.74rem", margin: "10px 2px 0" }}>Toca un corte para ver el dashboard enfocado solo en ese turno.</p>
              </Panel>
            )}

            <Panel title="Ventas por hora">
              {rep.byHour.length === 0 ? <Empty /> : (
                <BarChart data={rep.byHour.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, value: h.sales }))} format={formatMXN} />
              )}
            </Panel>

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
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 },
  h1: { margin: 0, color: C.cream, fontSize: "1.4rem", fontWeight: 800 },
  rangeBtn: { padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" },
  rangeOn: { background: C.panel, color: C.cream, borderColor: C.border },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 },
  kpi: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" },
  kpiLabel: { color: C.faint, fontSize: "0.66rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 },
  kpiValue: { fontWeight: 800, marginTop: 6 },
  shiftGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 18 },
  shiftCard: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" },
  occTrack: { height: 8, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden" },
  occFill: { height: "100%", background: "linear-gradient(90deg,#9a6c2e,#ba843c)", borderRadius: 6 },
  topPill: { color: C.cream, fontSize: "0.76rem", fontWeight: 600, background: "rgba(186,132,60,0.12)", border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 10px" },
  corteRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  corte: { textAlign: "left", minWidth: 170, padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.02)", cursor: "pointer", fontFamily: "inherit" },
  corteOn: { border: `1.5px solid ${C.gold}`, boxShadow: "0 0 0 3px rgba(186,132,60,0.12)" },
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  panelHead: { padding: "12px 18px", borderBottom: `1px solid ${C.line}`, color: C.faint, fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 },
  dishRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.line}`, fontSize: "0.86rem" },
};
