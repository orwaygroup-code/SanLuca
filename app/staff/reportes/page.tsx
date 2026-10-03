"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { C, btn, Spinner, EmptyState, Badge, formatMXN, useToasts, ToastHost, useStaffLogout } from "@/components/staff/ui";
import { StaffShell } from "@/components/staff/StaffShell";
import { DateRangeBar, dateFilterQuery, DEFAULT_FILTER, type DateFilter } from "@/components/admin/DateRangeBar";
import { apiFetch } from "@/components/staff/types";

/**
 * #R-2 Reportes de Operación — SOLO LECTURA. Ventas y propinas por rango, y el
 * detalle de un corte. Reutiliza los endpoints de R-1 y la DateRangeBar de admin
 * (misma query → mismas cifras que /admin/reportes). No exporta ni imprime.
 */

const MX_TZ = "America/Mexico_City";
const money = formatMXN;
function fmtDT(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo", CARD_DEBIT: "T. débito", CARD_CREDIT: "T. crédito", TRANSFER: "Transferencia", WAITER_CREDIT: "Crédito mesero",
};
const DIR_LABEL: Record<string, string> = { PAY: "Se le paga", COLLECT: "Cobra", EVEN: "A mano" };
const DIR_COLOR: Record<string, string> = { PAY: C.green, COLLECT: C.amber, EVEN: C.dim };

// ── Tipos de respuesta (R-1) ──────────────────────────────────────────────
interface Kpis { sales: number; taxCollected: number; tips: number; comandas: number; guests: number; avgTicket: number; activeNow: number }
interface MethodRow { method: string; amount: number; tip: number; count: number }
interface ShiftRow { shift: string; label: string; window: string; sales: number; comandas: number; guests: number; avgTicket: number; occupancy: number; topDish: { name: string; qty: number } | null }
interface HourRow { hour: number; sales: number }
interface SectionRow { section: string; sales: number; comandas: number }
interface DishRow { name: string; qty: number; revenue: number; comandas: number }
interface WaiterRow { waiter: string; sales: number; comandas: number; guests: number; avgTicket: number; dishes: DishRow[] }
interface CartaRow { carta: string; qty: number; revenue: number; comandas: number; dishes: DishRow[] }
interface CorteRow { id: number; folio: string; openedAt: string; closedAt: string | null; openedBy: string | null; closedBy: string | null; comandas: number; sales: number; tips: number }
interface ReportResp {
  kpis: Kpis; byMethod: MethodRow[]; byShift: ShiftRow[]; byHour: HourRow[];
  bySection: SectionRow[]; byWaiter: WaiterRow[]; topDishes: DishRow[]; byCarta: CartaRow[];
  cortes: CorteRow[]; turnoAbierto: boolean;
}
interface TipWaiter {
  waiterId: number; fullName: string; salesTotal: number; tipsRegistered: number; reserveDigital: number;
  pointPercent: number; deduction: number; net: number; direction: "PAY" | "COLLECT" | "EVEN"; amount: number;
  estimado: boolean; salesAfterSettle: number; settledAt: string | null; settledBy: string | null;
}
interface PorCorte {
  cashSessionId: number; folio: string; closedAt: string | null; waiters: TipWaiter[];
  pool: number; tipsRegistered: number; tipsRegisteredAll: number; sinElPunto: number;
  areas: { name: string; percent: number; amount: number }[]; areasPolicyIsCurrent: boolean; estimados: number;
}
interface TipsTotal {
  cortes: number; pool: number; tipsRegistered: number; tipsRegisteredAll: number; sinElPunto: number;
  estimados: number; salesAfterSettle: number; conVentaPosterior: number; areas: { name: string; amount: number }[];
}
interface TipsResp { total: TipsTotal; porCorte: PorCorte[] }

type TabKey = "resumen" | "propinas" | "mesero" | "zona" | "producto" | "carta" | "cortes";
const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "propinas", label: "Propinas" },
  { key: "mesero", label: "Por mesero" },
  { key: "zona", label: "Por zona" },
  { key: "producto", label: "Por producto" },
  { key: "carta", label: "Por carta" },
  { key: "cortes", label: "Cortes" },
];

export default function ReportesOperacionPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [filter, setFilter] = useState<DateFilter>(DEFAULT_FILTER);
  const [tab, setTab] = useState<TabKey>("resumen");
  const [rangeReport, setRangeReport] = useState<ReportResp | null>(null);
  const [rangeTips, setRangeTips] = useState<TipsResp | null>(null);
  const [detailCorte, setDetailCorte] = useState<{ id: number; folio: string } | null>(null);
  const [detailReport, setDetailReport] = useState<ReportResp | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expWaiter, setExpWaiter] = useState<Set<string>>(new Set());
  const [expCarta, setExpCarta] = useState<Set<string>>(new Set());
  const [expCorte, setExpCorte] = useState<Set<number>>(new Set());

  const allowed = staff && ["OPERATION", "CAPTAIN", "MANAGER"].includes(staff.role);

  const loadRange = useCallback(async (f: DateFilter) => {
    setBusy(true); setErr(null);
    const q = dateFilterQuery(f);
    const [rep, tips] = await Promise.all([
      apiFetch<ReportResp>(`/api/staff/reportes?${q}`),
      apiFetch<TipsResp>(`/api/staff/reportes/propinas?${q}`),
    ]);
    setBusy(false);
    if (!rep.ok) { setErr(rep.error ?? "No se pudieron cargar los reportes"); return; }
    setRangeReport(rep.data!);
    if (tips.ok) setRangeTips(tips.data!);
    else { setRangeTips(null); push(tips.error ?? "No se pudieron cargar las propinas", "error"); }
  }, [push]);

  const loadDetail = useCallback(async (corteId: number) => {
    setBusy(true); setErr(null);
    const rep = await apiFetch<ReportResp>(`/api/staff/reportes?cashSessionId=${corteId}`);
    setBusy(false);
    if (!rep.ok) { setErr(rep.error ?? "No se pudo cargar el corte"); return; }
    setDetailReport(rep.data!);
  }, []);

  // Guard + carga del rango. Se re-dispara con cada cambio de filtro, limpiando
  // el modo detalle. (TODOS los hooks viven arriba del early return de abajo.)
  useEffect(() => {
    if (loading) return;
    if (!staff) { router.replace("/staff/login?next=/staff/reportes"); return; }
    if (!allowed) { router.replace("/staff/login"); return; }
    setDetailCorte(null); setDetailReport(null);
    loadRange(filter);
  }, [loading, staff, allowed, router, filter, loadRange]);

  if (loading || !staff || !allowed) {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><Spinner /></div>;
  }

  const report = detailCorte ? detailReport : rangeReport;
  const detailTips = detailCorte && rangeTips ? rangeTips.porCorte.find((c) => c.cashSessionId === detailCorte.id) ?? null : null;

  const toggle = (set: Set<string>, key: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(key) ? n.delete(key) : n.add(key); fn(n);
  };
  const toggleCorte = (id: number) => { const n = new Set(expCorte); n.has(id) ? n.delete(id) : n.add(id); setExpCorte(n); };

  const openCorte = (c: CorteRow) => { setDetailCorte({ id: c.id, folio: c.folio }); loadDetail(c.id); setTab("resumen"); };
  const backToRange = () => { setDetailCorte(null); setDetailReport(null); };

  return (
    <>
      <StaffShell active="reportes" onRefresh={() => (detailCorte ? loadDetail(detailCorte.id) : loadRange(filter))} onLogout={logout} userName={staff.fullName} role={staff.role} maxWidth={1100}>
        <div style={st.head}>
          <h1 style={st.h1}>Reportes de Operación</h1>
          {detailCorte && <Badge text={`CORTE ${detailCorte.folio}`} color="var(--sl-gold)" />}
        </div>

        {/* Barra de rango (modo rango) o encabezado del corte (modo detalle) */}
        {detailCorte ? (
          <div style={st.detailBar}>
            <button style={btn.ghost} onClick={backToRange}>← Volver al rango</button>
            <span style={{ color: C.faint, fontSize: "0.82rem" }}>Todas las pestañas muestran solo este corte.</span>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <DateRangeBar value={filter} onChange={setFilter} />
          </div>
        )}

        {/* Pestañas */}
        <div style={st.tabsWrap}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={tab === t.key ? { ...st.tab, ...st.tabOn } : st.tab}>
              {t.label}
            </button>
          ))}
        </div>

        {busy ? (
          <Spinner label="Cargando reportes…" />
        ) : err ? (
          <div style={st.errBox}>
            <div style={{ color: C.red, fontSize: "0.9rem", marginBottom: 12 }}>{err}</div>
            <button style={btn.primary} onClick={() => (detailCorte ? loadDetail(detailCorte.id) : loadRange(filter))}>Reintentar</button>
          </div>
        ) : !report ? (
          <EmptyState text="Sin datos para este rango." />
        ) : (
          <>
            {tab === "resumen" && <ResumenView r={report} />}
            {tab === "propinas" && (
              detailCorte
                ? (detailTips ? <CorteTips c={detailTips} defaultOpen /> : <EmptyState text="Sin datos de propinas para este corte." />)
                : (rangeTips ? <PropinasRange t={rangeTips} expCorte={expCorte} onToggle={toggleCorte} /> : <EmptyState text="No se pudieron cargar las propinas. Usa Reintentar." />)
            )}
            {tab === "mesero" && <WaiterView rows={report.byWaiter} exp={expWaiter} onToggle={(k) => toggle(expWaiter, k, setExpWaiter)} />}
            {tab === "zona" && <SectionView rows={report.bySection} />}
            {tab === "producto" && <ProductView rows={report.topDishes} />}
            {tab === "carta" && <CartaView rows={report.byCarta} exp={expCarta} onToggle={(k) => toggle(expCarta, k, setExpCarta)} />}
            {tab === "cortes" && <CortesView rows={rangeReport?.cortes ?? []} turnoAbierto={rangeReport?.turnoAbierto ?? false} currentId={detailCorte?.id ?? null} onSelect={openCorte} />}
          </>
        )}
      </StaffShell>
      <ToastHost toasts={toasts} onClose={dismiss} />
    </>
  );
}

// ────────────────────────────────────────────────────────── Resumen ──
function ResumenView({ r }: { r: ReportResp }) {
  const k = r.kpis;
  const maxHour = Math.max(1, ...r.byHour.map((h) => h.sales));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={st.kpiGrid}>
        <Kpi label="Ventas" value={money(k.sales)} big />
        <Kpi label="Comandas" value={String(k.comandas)} />
        <Kpi label="Comensales" value={String(k.guests)} />
        <Kpi label="Ticket prom." value={money(k.avgTicket)} />
        <Kpi label="Propinas" value={money(k.tips)} />
        <Kpi label="IVA" value={money(k.taxCollected)} />
      </div>

      <Card title="Por turno">
        {r.byShift.length === 0 ? <Muted text="Sin turnos en el rango." /> : (
          <Scroll>
            <table style={st.table}>
              <thead><tr>{["Turno", "Ventas", "Comandas", "Comensales", "Ticket", "Ocupación", "Top"].map((h) => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
              <tbody>
                {r.byShift.map((s) => (
                  <tr key={s.shift}>
                    <td style={st.tdName}>{s.label} <span style={{ color: C.faint, fontSize: "0.72rem" }}>{s.window}</span></td>
                    <td style={st.tdNum}>{money(s.sales)}</td>
                    <td style={st.tdNum}>{s.comandas}</td>
                    <td style={st.tdNum}>{s.guests}</td>
                    <td style={st.tdNum}>{money(s.avgTicket)}</td>
                    <td style={st.tdNum}>{s.occupancy}%</td>
                    <td style={st.td}>{s.topDish ? `${s.topDish.name} (${s.topDish.qty})` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
      </Card>

      <Card title="Por método de pago">
        {r.byMethod.length === 0 ? <Muted text="Sin pagos en el rango." /> : (
          <Scroll>
            <table style={st.table}>
              <thead><tr>{["Método", "Monto", "Propina", "Pagos"].map((h) => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
              <tbody>
                {r.byMethod.map((m) => (
                  <tr key={m.method}>
                    <td style={st.tdName}>{METHOD_LABEL[m.method] ?? m.method}</td>
                    <td style={st.tdNum}>{money(m.amount)}</td>
                    <td style={st.tdNum}>{money(m.tip)}</td>
                    <td style={st.tdNum}>{m.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        )}
      </Card>

      <Card title="Por hora">
        {r.byHour.length === 0 ? <Muted text="Sin ventas por hora en el rango." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {r.byHour.map((h) => (
              <div key={h.hour} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: C.dim, fontSize: "0.78rem", width: 46, flexShrink: 0 }}>{String(h.hour).padStart(2, "0")} h</span>
                <div style={{ flex: 1, background: "rgb(var(--sl-veil-rgb) / 0.08)", borderRadius: 6, overflow: "hidden", minWidth: 40 }}>
                  <div style={{ width: `${Math.max(2, (h.sales / maxHour) * 100)}%`, background: C.gold, height: 16 }} />
                </div>
                <span style={{ color: C.cream, fontSize: "0.78rem", width: 92, textAlign: "right", flexShrink: 0 }}>{money(h.sales)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────── Propinas (rango) ──
function PropinasRange({ t, expCorte, onToggle }: { t: TipsResp; expCorte: Set<number>; onToggle: (id: number) => void }) {
  const total = t.total;
  const areas = [...total.areas].sort((a, b) => b.amount - a.amount);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={st.kpiGrid}>
        <Kpi label="Propina registrada" value={money(total.tipsRegistered)} big />
        <Kpi label="Pool — el punto" value={money(total.pool)} />
        <Kpi label="Sin el punto" value={money(total.sinElPunto)} negative={total.sinElPunto < 0} />
        <Kpi label="Cortes" value={String(total.cortes)} />
      </div>

      <Card title="Reparto por área">
        {areas.length === 0 ? <Muted text="Sin áreas configuradas." /> : areas.map((a) => (
          <div key={a.name} style={st.kv}><span style={{ color: C.cream }}>{a.name}</span><span style={{ color: C.cream, fontWeight: 700 }}>{money(a.amount)}</span></div>
        ))}
      </Card>

      {/* Avisos: solo lo que separa un reporte creíble de uno decorativo. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {total.estimados > 0 && <Notice kind="amber" text={`${total.estimados} mesero(s) sin liquidar: sus cifras están estimadas con la política vigente, no son lo que se pagó.`} />}
        {total.conVentaPosterior > 0 && <Notice kind="amber" text={`${total.conVentaPosterior} mesero(s) vendieron ${money(total.salesAfterSettle)} después de liquidar. El 7% de esa venta nunca entró al pool.`} />}
        <Notice kind="faint" text="El reparto por área usa la política vigente, no la del día del corte." />
        {total.tipsRegisteredAll !== total.tipsRegistered && <Notice kind="faint" text={`Incluyendo cuentas para llevar: ${money(total.tipsRegisteredAll)}. Las cuentas para llevar no generan punto.`} />}
      </div>

      <div style={{ color: C.faint, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>Por corte</div>
      {t.porCorte.length === 0 ? <EmptyState text="No hay cortes cerrados en el rango." /> : t.porCorte.map((c) => (
        <CorteTips key={c.cashSessionId} c={c} open={expCorte.has(c.cashSessionId)} onToggle={() => onToggle(c.cashSessionId)} />
      ))}
    </div>
  );
}

function CorteTips({ c, open, onToggle, defaultOpen }: { c: PorCorte; open?: boolean; onToggle?: () => void; defaultOpen?: boolean }) {
  const isOpen = defaultOpen || open;
  const salesAfter = c.waiters.reduce((s, w) => s + w.salesAfterSettle, 0);
  return (
    <div style={st.card}>
      <button style={st.corteHead} onClick={onToggle} aria-expanded={isOpen} disabled={!onToggle}>
        <div style={{ textAlign: "left", minWidth: 0 }}>
          <span style={{ color: C.cream, fontWeight: 700 }}>Corte {c.folio}</span>
          <span style={{ color: C.faint, fontSize: "0.76rem", marginLeft: 8 }}>{fmtDT(c.closedAt)}</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexShrink: 0 }}>
          <span style={{ color: C.dim, fontSize: "0.76rem" }}>Pool <b style={{ color: C.cream }}>{money(c.pool)}</b></span>
          <span style={{ color: C.dim, fontSize: "0.76rem" }}>Sin el punto <b style={{ color: c.sinElPunto < 0 ? C.red : C.cream }}>{money(c.sinElPunto)}</b></span>
          {onToggle && <span style={{ color: C.faint, fontSize: "0.72rem" }}>{isOpen ? "ocultar" : "ver"}</span>}
        </div>
      </button>

      {(c.estimados > 0 || salesAfter > 0) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 14px 10px" }}>
          {c.estimados > 0 && <Badge text={`${c.estimados} estimado(s)`} color="var(--sl-amber)" />}
          {salesAfter > 0 && <Badge text={`Venta posterior ${money(salesAfter)}`} color="var(--sl-amber)" />}
        </div>
      )}

      {isOpen && (
        <div style={st.corteBody}>
          <Scroll>
            <table style={st.table}>
              <thead><tr>{["Mesero", "Venta", "Propina", "Reserva", "Punto", "Neto", ""].map((h, i) => <th key={i} style={st.th}>{h}</th>)}</tr></thead>
              <tbody>
                {c.waiters.map((w) => (
                  <tr key={w.waiterId}>
                    <td style={st.tdName}>
                      {w.fullName}
                      {w.estimado && <span style={{ color: C.amber, fontSize: "0.68rem", marginLeft: 6 }}>est.</span>}
                      {w.salesAfterSettle > 0 && <span style={{ color: C.amber, fontSize: "0.68rem", marginLeft: 6 }}>+{money(w.salesAfterSettle)} post</span>}
                    </td>
                    <td style={st.tdNum}>{money(w.salesTotal)}</td>
                    <td style={st.tdNum}>{money(w.tipsRegistered)}</td>
                    <td style={st.tdNum}>{money(w.reserveDigital)}</td>
                    <td style={st.tdNum}>−{money(w.deduction)}</td>
                    <td style={st.tdNum}>{money(w.net)}</td>
                    <td style={st.td}><span style={{ color: DIR_COLOR[w.direction], fontWeight: 700, fontSize: "0.76rem" }}>{DIR_LABEL[w.direction]}{w.direction !== "EVEN" ? ` ${money(w.amount)}` : ""}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────── Por mesero ──
function WaiterView({ rows, exp, onToggle }: { rows: WaiterRow[]; exp: Set<string>; onToggle: (k: string) => void }) {
  if (rows.length === 0) return <EmptyState text="Sin ventas por mesero en el rango." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((w) => {
        const isOpen = exp.has(w.waiter);
        return (
          <div key={w.waiter} style={st.card}>
            <button style={st.corteHead} onClick={() => onToggle(w.waiter)} aria-expanded={isOpen}>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <span style={{ color: C.cream, fontWeight: 700 }}>{w.waiter}</span>
                <span style={{ color: C.faint, fontSize: "0.76rem", marginLeft: 8 }}>{w.comandas} cuentas · {w.guests} pers · ticket {money(w.avgTicket)}</span>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexShrink: 0 }}>
                <span style={{ color: C.cream, fontWeight: 800 }}>{money(w.sales)}</span>
                <span style={{ color: C.faint, fontSize: "0.72rem" }}>{isOpen ? "ocultar" : "platillos"}</span>
              </div>
            </button>
            {isOpen && (
              <div style={st.corteBody}>
                {w.dishes.length === 0 ? <Muted text="Sin platillos." /> : (
                  <Scroll>
                    <table style={st.table}>
                      <thead><tr>{["Platillo", "Cant.", "Importe", "Cuentas"].map((h) => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                      <tbody>
                        {w.dishes.map((d) => (
                          <tr key={d.name}>
                            <td style={st.tdName}>{d.name}</td>
                            <td style={st.tdNum}>{fmtQty(d.qty)}</td>
                            <td style={st.tdNum}>{money(d.revenue)}</td>
                            <td style={st.tdNum}>{d.comandas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Scroll>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────── Por zona ──
function SectionView({ rows }: { rows: SectionRow[] }) {
  if (rows.length === 0) return <EmptyState text="Sin ventas por zona en el rango." />;
  return (
    <Card title="Por zona">
      <Scroll>
        <table style={st.table}>
          <thead><tr>{["Zona", "Ventas", "Comandas"].map((h) => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.section}>
                <td style={st.tdName}>{s.section}</td>
                <td style={st.tdNum}>{money(s.sales)}</td>
                <td style={st.tdNum}>{s.comandas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
    </Card>
  );
}

// ────────────────────────────────────────────────────────── Por producto ──
function ProductView({ rows }: { rows: DishRow[] }) {
  if (rows.length === 0) return <EmptyState text="Sin productos vendidos en el rango." />;
  return (
    <Card title="Por producto (top 100)">
      <Scroll>
        <table style={st.table}>
          <thead><tr>{["Platillo", "Cant.", "Importe", "Cuentas"].map((h) => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.name}>
                <td style={st.tdName}>{d.name}</td>
                <td style={st.tdNum}>{fmtQty(d.qty)}</td>
                <td style={st.tdNum}>{money(d.revenue)}</td>
                <td style={st.tdNum}>{d.comandas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
    </Card>
  );
}

// ────────────────────────────────────────────────────────── Por carta ──
function CartaView({ rows, exp, onToggle }: { rows: CartaRow[]; exp: Set<string>; onToggle: (k: string) => void }) {
  if (rows.length === 0) return <EmptyState text="Sin ventas por carta en el rango." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((c) => {
        const isOpen = exp.has(c.carta);
        return (
          <div key={c.carta} style={st.card}>
            <button style={st.corteHead} onClick={() => onToggle(c.carta)} aria-expanded={isOpen}>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <span style={{ color: C.cream, fontWeight: 700 }}>{c.carta}</span>
                <span style={{ color: C.faint, fontSize: "0.76rem", marginLeft: 8 }}>{fmtQty(c.qty)} uds · {c.comandas} cuentas</span>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexShrink: 0 }}>
                <span style={{ color: C.cream, fontWeight: 800 }}>{money(c.revenue)}</span>
                <span style={{ color: C.faint, fontSize: "0.72rem" }}>{isOpen ? "ocultar" : "platillos"}</span>
              </div>
            </button>
            {isOpen && (
              <div style={st.corteBody}>
                <Scroll>
                  <table style={st.table}>
                    <thead><tr>{["Platillo", "Cant.", "Importe", "Cuentas"].map((h) => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {c.dishes.map((d) => (
                        <tr key={d.name}>
                          <td style={st.tdName}>{d.name}</td>
                          <td style={st.tdNum}>{fmtQty(d.qty)}</td>
                          <td style={st.tdNum}>{money(d.revenue)}</td>
                          <td style={st.tdNum}>{d.comandas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Scroll>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────── Cortes ──
function CortesView({ rows, turnoAbierto, currentId, onSelect }: { rows: CorteRow[]; turnoAbierto: boolean; currentId: number | null; onSelect: (c: CorteRow) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {turnoAbierto && <div style={{ color: C.faint, fontSize: "0.8rem" }}>Hay un turno abierto en este rango; no se incluye en los totales.</div>}
      {rows.length === 0 ? <EmptyState text="No hay cortes cerrados en el rango." /> : (
        <Card>
          <Scroll>
            <table style={st.table}>
              <thead><tr>{["Folio", "Cierre", "Abrió", "Cerró", "Comandas", "Venta", "Propinas"].map((h) => <th key={h} style={st.th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => onSelect(c)} style={{ cursor: "pointer", background: c.id === currentId ? "rgb(var(--sl-gold-rgb) / 0.1)" : undefined }}>
                    <td style={st.tdName}><button style={st.linkBtn} onClick={(e) => { e.stopPropagation(); onSelect(c); }}>{c.folio}</button></td>
                    <td style={st.td}>{fmtDT(c.closedAt)}</td>
                    <td style={st.td}>{c.openedBy ?? "—"}</td>
                    <td style={st.td}>{c.closedBy ?? "—"}</td>
                    <td style={st.tdNum}>{c.comandas}</td>
                    <td style={st.tdNum}>{money(c.sales)}</td>
                    <td style={st.tdNum}>{money(c.tips)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────── piezas ──
function Kpi({ label, value, big, negative }: { label: string; value: string; big?: boolean; negative?: boolean }) {
  return (
    <div style={st.kpi}>
      <div style={st.kpiLabel}>{label}</div>
      <div style={{ ...st.kpiVal, fontSize: big ? "1.5rem" : "1.15rem", color: negative ? C.red : C.cream }}>{value}</div>
    </div>
  );
}
function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={st.card}>
      {title && <div style={st.cardHead}>{title}</div>}
      <div style={{ padding: "12px 14px" }}>{children}</div>
    </div>
  );
}
function Scroll({ children }: { children: React.ReactNode }) {
  return <div style={{ overflowX: "auto", width: "100%" }}>{children}</div>;
}
function Muted({ text }: { text: string }) {
  return <div style={{ color: C.faint, fontSize: "0.82rem", padding: "6px 0" }}>{text}</div>;
}
function Notice({ kind, text }: { kind: "amber" | "faint"; text: string }) {
  const amber = kind === "amber";
  return (
    <div style={{
      color: amber ? C.amber : C.faint, fontSize: "0.8rem", lineHeight: 1.4,
      padding: amber ? "10px 12px" : "0 2px",
      border: amber ? `1px solid ${C.amber}` : "none",
      borderRadius: amber ? 10 : 0,
      background: amber ? "color-mix(in srgb, var(--sl-amber) 10%, transparent)" : "transparent",
    }}>{text}</div>
  );
}

const st: Record<string, React.CSSProperties> = {
  head: { display: "flex", alignItems: "center", gap: 12, margin: "8px 0 14px", flexWrap: "wrap" },
  h1: { margin: 0, fontSize: "1.15rem", fontWeight: 800, color: C.cream },
  detailBar: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 },
  tabsWrap: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14, borderBottom: `1px solid ${C.border}` },
  tab: { padding: "9px 14px", minHeight: 44, borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontWeight: 700, fontSize: "0.8rem", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 },
  tabOn: { background: C.gold, color: "var(--sl-on-accent)", border: "1px solid transparent" },
  errBox: { padding: "32px 20px", textAlign: "center", border: `1px solid ${C.border}`, borderRadius: 14 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 },
  kpi: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" },
  kpiLabel: { color: C.faint, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em" },
  kpiVal: { fontWeight: 800, marginTop: 4 },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" },
  cardHead: { padding: "11px 14px", borderBottom: `1px solid ${C.border}`, color: C.faint, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 },
  corteHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 14px", width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" },
  corteBody: { borderTop: `1px solid ${C.border}`, padding: "10px 14px", background: "rgba(0,0,0,0.12)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 420 },
  th: { textAlign: "left", color: C.faint, fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, padding: "6px 10px", whiteSpace: "nowrap", borderBottom: `1px solid ${C.line}` },
  td: { color: C.dim, padding: "8px 10px", whiteSpace: "nowrap" },
  tdName: { color: C.cream, padding: "8px 10px", fontWeight: 600 },
  tdNum: { color: C.cream, padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  kv: { display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "0.86rem" },
  linkBtn: { background: "transparent", border: "none", color: C.gold, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" },
};
