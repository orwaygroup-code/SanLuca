"use client";

import { C, formatMXN } from "@/components/staff/ui";
import type { Comanda } from "@/components/staff/types";

/**
 * Ventas EN VIVO del piso — se calculan en el cliente a partir de las comandas que el
 * board ya cargó. A diferencia del Dashboard (histórico, SOLO cobradas), el piso refleja
 * TODO el dinero en la casa ahora mismo: ACTIVAS + POR COBRAR + COBRADAS de hoy. (El board
 * no trae canceladas ni fusionadas, así que no cuentan.) Sin endpoint ni almacenamiento:
 * refresca solo con el poll del board.
 */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const isPaid = (c: Comanda) => c.status === "PAID";
const isBilling = (c: Comanda) => c.status === "AWAITING_PAYMENT" || c.status === "PARTIALLY_PAID";
const isActive = (c: Comanda) => c.status === "OPEN" || c.status === "IN_SERVICE";

export function LiveStats({ comandas }: { comandas: Comanda[] }) {
  const all = comandas;
  const totalPiso = round2(all.reduce((s, c) => s + Number(c.total), 0));
  const cobrado = round2(all.filter(isPaid).reduce((s, c) => s + Number(c.total), 0));
  const porCobrar = round2(all.filter((c) => !isPaid(c)).reduce((s, c) => s + Number(c.total), 0));
  const cobradasCount = all.filter(isPaid).length;
  const activasCount = all.filter(isActive).length;
  const porCobrarCount = all.filter(isBilling).length;
  const comensales = all.reduce((s, c) => s + (c.guestsActual || 0), 0);
  const ticket = cobradasCount ? round2(cobrado / cobradasCount) : 0;

  // Barras sobre TODAS las comandas (por hora de apertura, por mesero, por área).
  const byHour = new Map<number, number>();
  for (const c of all) {
    if (!c.openedAt) continue;
    const h = new Date(c.openedAt).getHours(); // el dispositivo de caja está en MX
    byHour.set(h, (byHour.get(h) ?? 0) + Number(c.total));
  }
  const hourData = [...byHour.entries()].sort((a, b) => a[0] - b[0]).map(([h, v]) => ({ label: `${String(h).padStart(2, "0")}:00`, value: round2(v) }));

  const byWaiter = new Map<string, { total: number; count: number }>();
  for (const c of all) {
    const w = c.waiter?.fullName ?? "—";
    const v = byWaiter.get(w) ?? { total: 0, count: 0 };
    v.total += Number(c.total); v.count += 1; byWaiter.set(w, v);
  }
  const waiterData = [...byWaiter.entries()].map(([w, v]) => ({ label: `${w} (${v.count})`, value: round2(v.total) })).sort((a, b) => b.value - a.value);

  const bySection = new Map<string, number>();
  for (const c of all) {
    const s = c.table?.section?.name ?? "Sin mesa";
    bySection.set(s, (bySection.get(s) ?? 0) + Number(c.total));
  }
  const sectionData = [...bySection.entries()].map(([s, v]) => ({ label: s, value: round2(v) })).sort((a, b) => b.value - a.value);

  return (
    <div style={st.wrap}>
      <div style={st.hint}>Incluye activas, por cobrar y cobradas de hoy · el histórico con filtros está en el Dashboard</div>
      <div style={st.kpis}>
        <Kpi label="Total en piso" value={formatMXN(totalPiso)} accent={C.gold} big />
        <Kpi label={`Cobrado (${cobradasCount})`} value={formatMXN(cobrado)} accent={C.green} />
        <Kpi label={`Por cobrar (${activasCount + porCobrarCount})`} value={formatMXN(porCobrar)} accent={C.amber} />
        <Kpi label="Activas ahora" value={String(activasCount)} />
        <Kpi label="Comensales" value={String(comensales)} />
        <Kpi label="Ticket prom." value={formatMXN(ticket)} />
      </div>
      <div style={st.grid}>
        <Panel title="Ventas por hora (apertura)"><Bars data={hourData} /></Panel>
        <Panel title="Por mesero (todo el piso)"><Bars data={waiterData} /></Panel>
        <Panel title="Por área (todo el piso)"><Bars data={sectionData} /></Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent, big }: { label: string; value: string; accent?: string; big?: boolean }) {
  return (
    <div style={st.kpi}>
      <div style={st.kpiLabel}>{label}</div>
      <div style={{ ...st.kpiValue, ...(big ? { fontSize: "1.3rem" } : {}), ...(accent ? { color: accent } : {}) }}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={st.panel}>
      <div style={st.panelHead}>{title}</div>
      {children}
    </div>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <div style={{ color: C.faint, fontSize: "0.82rem", padding: "6px 0" }}>Sin ventas todavía.</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 3, gap: 8 }}>
            <span style={{ color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span style={{ color: C.cream, fontWeight: 700, whiteSpace: "nowrap" }}>{formatMXN(d.value)}</span>
          </div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.value / max) * 100}%`, background: C.gold, borderRadius: 4, transition: "width .4s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  wrap: { marginBottom: 22 },
  hint: { color: C.faint, fontSize: "0.72rem", marginBottom: 10 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 },
  kpi: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" },
  kpiLabel: { color: C.faint, fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: 5 },
  kpiValue: { color: C.cream, fontWeight: 800, fontSize: "1.15rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 },
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" },
  panelHead: { color: C.faint, fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 },
};
