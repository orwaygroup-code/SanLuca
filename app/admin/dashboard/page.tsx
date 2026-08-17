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
  byMethod: { method: string; amount: number; tip: number; count: number }[];
  byHour: { hour: number; sales: number }[];
  topDishes: { name: string; qty: number; revenue: number }[];
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo", CARD_DEBIT: "Débito", CARD_CREDIT: "Crédito", TRANSFER: "Transferencia", WAITER_CREDIT: "Crédito mesero",
};

const RANGES: { key: string; label: string }[] = [
  { key: "today", label: "Hoy" }, { key: "7d", label: "7 días" }, { key: "30d", label: "30 días" },
];
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

export default function AdminDashboardPage() {
  const router = useRouter();
  const session = useSession();
  const [range, setRange] = useState("today");
  const [cortesDate, setCortesDate] = useState(""); // día de los cortes (default hoy; se fija en el efecto)
  const [corte, setCorte] = useState<Corte | null>(null); // corte abierto en la ventana de detalle
  const [rep, setRep] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setCortesDate(new Date().toLocaleDateString("en-CA")); }, []); // hoy (cliente, evita mismatch SSR)

  useEffect(() => {
    if (session.loading) return;
    if (!session.user || session.user.role !== "ADMIN") router.replace("/login?mode=login");
  }, [session.loading, session.user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/reports?range=${range}${cortesDate ? `&cortesDate=${cortesDate}` : ""}`, { credentials: "same-origin" });
    const d = await r.json().catch(() => null);
    if (d?.success) setRep(d.data as Report);
    setLoading(false);
  }, [range, cortesDate]);

  useEffect(() => { if (session.user?.role === "ADMIN") load(); }, [session.user, load]);

  if (session.loading || !session.user || session.user.role !== "ADMIN") {
    return <div style={S.page}><div style={{ padding: 40, color: C.dim }}>Cargando…</div></div>;
  }

  const k = rep?.kpis;

  return (
    <div style={S.page}>
      <main style={S.main}>
        <div style={S.headRow}>
          <div>
            <h1 style={S.h1}>Dashboard de ventas</h1>
            <div style={{ color: C.gold, fontSize: "0.84rem", marginTop: 2 }}>Comparación de turnos: Comida vs Brunch</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {RANGES.map((r) => (
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

            {/* Turnos por corte de caja — con selector de día para ver/reimprimir cortes pasados */}
            <section style={S.panel}>
              <div style={{ ...S.panelHead, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span>Turnos por corte de caja</span>
                <input type="date" value={cortesDate} onChange={(e) => setCortesDate(e.target.value)}
                  style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, color: C.cream, fontSize: "0.74rem", padding: "5px 8px", fontFamily: "inherit", colorScheme: "dark" }} />
              </div>
              <div style={{ padding: "14px 18px 18px" }}>
                {rep.cortes.length === 0 ? (
                  <div style={{ color: C.faint, fontSize: "0.85rem" }}>Sin cortes ese día.</div>
                ) : (
                  <>
                    <div style={S.corteRow}>
                      {rep.cortes.map((c) => (
                        <button key={c.id} onClick={() => setCorte(c)} style={S.corte}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ color: C.gold, fontWeight: 800, fontSize: "0.78rem" }}>{c.folio}</span>
                            <span style={{ color: c.status === "OPEN" ? C.green : C.faint, fontSize: "0.68rem", fontWeight: 700 }}>{c.status === "OPEN" ? "Abierto" : "Cerrado"}</span>
                          </div>
                          <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.1rem", marginTop: 6 }}>{formatMXN(c.sales)}</div>
                          <div style={{ color: C.dim, fontSize: "0.72rem", marginTop: 2 }}>{c.comandas} comandas · {hhmm(c.openedAt)}{c.closedAt ? `–${hhmm(c.closedAt)}` : ""}</div>
                        </button>
                      ))}
                    </div>
                    <p style={{ color: C.faint, fontSize: "0.74rem", margin: "10px 2px 0" }}>Toca un corte para ver su detalle y reimprimirlo.</p>
                  </>
                )}
              </div>
            </section>

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
        {corte && <CorteModal corte={corte} onClose={() => setCorte(null)} />}
      </main>
    </div>
  );
}

/** Ventana pequeña con el detalle de un corte (turno): KPIs, métodos de pago y top platillos. */
function CorteModal({ corte, onClose }: { corte: Corte; onClose: () => void }) {
  const [rep, setRep] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprinting, setReprinting] = useState(false);
  const [reprinted, setReprinted] = useState(false);
  const doReprintCorte = async () => {
    setReprinting(true);
    const r = await fetch(`/api/caja/sessions/${corte.id}/reprint-corte`, { method: "POST", credentials: "same-origin" });
    const d = await r.json().catch(() => null);
    setReprinting(false);
    if (d?.success) setReprinted(true);
  };
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/admin/reports?cashSessionId=${corte.id}`, { credentials: "same-origin" })
      .then((r) => r.json()).then((d) => { if (alive && d?.success) setRep(d.data as Report); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [corte.id]);
  const k = rep?.kpis;
  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ color: C.gold, fontWeight: 800, fontSize: "1.05rem" }}>Corte {corte.folio}</div>
            <div style={{ color: C.dim, fontSize: "0.76rem", marginTop: 2 }}>
              {corte.status === "OPEN" ? "Abierto" : "Cerrado"} · {hhmm(corte.openedAt)}{corte.closedAt ? `–${hhmm(corte.closedAt)}` : ""}
            </div>
          </div>
          <button style={S.close} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {loading || !rep ? (
          <div style={{ color: C.dim, padding: "26px 0", textAlign: "center" }}>Cargando…</div>
        ) : (
          <>
            <div style={S.mkpis}>
              <MiniKpi label="Ventas" value={formatMXN(k!.sales)} />
              <MiniKpi label="Comandas" value={String(k!.comandas)} />
              <MiniKpi label="Ticket prom." value={formatMXN(k!.avgTicket)} />
              <MiniKpi label="Comensales" value={String(k!.guests)} />
            </div>

            {rep.byMethod.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={S.mhead}>Métodos de pago</div>
                {rep.byMethod.map((m) => (
                  <div key={m.method} style={S.mrow}>
                    <span style={{ color: C.cream, flex: 1 }}>{METHOD_LABEL[m.method] ?? m.method}</span>
                    <span style={{ color: C.faint, width: 34, textAlign: "right" }}>{m.count}</span>
                    <span style={{ color: C.cream, fontWeight: 700, width: 96, textAlign: "right" }}>{formatMXN(m.amount)}</span>
                  </div>
                ))}
                {k!.tips > 0 && (
                  <div style={{ ...S.mrow, borderBottom: "none" }}>
                    <span style={{ color: C.gold, flex: 1 }}>Propinas</span>
                    <span style={{ width: 34 }} />
                    <span style={{ color: C.gold, fontWeight: 700, width: 96, textAlign: "right" }}>{formatMXN(k!.tips)}</span>
                  </div>
                )}
              </div>
            )}

            {rep.topDishes.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={S.mhead}>Top platillos</div>
                {rep.topDishes.slice(0, 6).map((d, i) => (
                  <div key={d.name} style={S.mrow}>
                    <span style={{ color: C.dim, width: 18 }}>{i + 1}.</span>
                    <span style={{ color: C.cream, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                    <span style={{ color: C.gold, fontWeight: 700, width: 44, textAlign: "right" }}>{d.qty}×</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {corte.status !== "OPEN" && (
          <button
            style={{ ...S.rangeBtn, width: "100%", marginTop: 16, ...(reprinted ? { color: C.green, borderColor: C.green } : {}) }}
            onClick={doReprintCorte} disabled={reprinting || reprinted}
          >
            {reprinted ? "✓ Enviado a impresora de caja" : reprinting ? "Enviando…" : "🖨  Reimprimir corte"}
          </button>
        )}
      </div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.mkpi}>
      <div style={{ color: C.faint, fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
      <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.05rem", marginTop: 3 }}>{value}</div>
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
  overlay: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: 420, maxHeight: "calc(100vh - 32px)", overflowY: "auto", padding: "20px 22px" },
  close: { width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.dim, fontSize: "0.9rem", cursor: "pointer", flexShrink: 0, fontFamily: "inherit" },
  mkpis: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 },
  mkpi: { background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" },
  mhead: { color: C.faint, fontSize: "0.62rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 },
  mrow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: "0.84rem" },
};
