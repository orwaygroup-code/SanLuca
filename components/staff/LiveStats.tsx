"use client";

import { C, formatMXN } from "@/components/staff/ui";
import type { Comanda } from "@/components/staff/types";

/**
 * Ventas EN VIVO del piso — se calculan en el cliente a partir de las comandas que el
 * board ya cargó (activas + PAID de hoy vía ?includePaidToday=1). No hay endpoint ni
 * almacenamiento: refresca solo con el poll del board. El histórico con filtros de fecha
 * sigue en el Dashboard (/admin/dashboard).
 */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function LiveStats({ comandas }: { comandas: Comanda[] }) {
  const paid = comandas.filter((c) => c.status === "PAID");
  const activeCount = comandas.filter((c) => c.status !== "PAID").length;
  const sales = round2(paid.reduce((s, c) => s + Number(c.total), 0));
  const cuentas = paid.length;
  const comensales = paid.reduce((s, c) => s + (c.guestsActual || 0), 0);
  const avg = cuentas ? round2(sales / cuentas) : 0;

  const byHour = new Map<number, number>();
  for (const c of paid) {
    if (!c.closedAt) continue;
    const h = new Date(c.closedAt).getHours(); // el dispositivo de caja está en MX
    byHour.set(h, (byHour.get(h) ?? 0) + Number(c.total));
  }
  const hourData = [...byHour.entries()].sort((a, b) => a[0] - b[0]).map(([h, v]) => ({ label: `${String(h).padStart(2, "0")}:00`, value: round2(v) }));

  const byWaiter = new Map<string, { sales: number; count: number }>();
  for (const c of paid) {
    const w = c.waiter?.fullName ?? "—";
    const v = byWaiter.get(w) ?? { sales: 0, count: 0 };
    v.sales += Number(c.total); v.count += 1; byWaiter.set(w, v);
  }
  const waiterData = [...byWaiter.entries()].map(([w, v]) => ({ label: `${w} (${v.count})`, value: round2(v.sales) })).sort((a, b) => b.value - a.value);

  const bySection = new Map<string, number>();
  for (const c of paid) {
    const s = c.table?.section?.name ?? "Sin mesa";
    bySection.set(s, (bySection.get(s) ?? 0) + Number(c.total));
  }
  const sectionData = [...bySection.entries()].map(([s, v]) => ({ label: s, value: round2(v) })).sort((a, b) => b.value - a.value);

  return (
    <div style={st.wrap}>
      <div style={st.kpis}>
        <Kpi label="Ventas hoy" value={formatMXN(sales)} accent={C.gold} big />
        <Kpi label="Cuentas cobradas" value={String(cuentas)} />
        <Kpi label="Activas ahora" value={String(activeCount)} accent={C.green} />
        <Kpi label="Comensales" value={String(comensales)} />
        <Kpi label="Ticket prom." value={formatMXN(avg)} />
      </div>
      <div style={st.grid}>
        <Panel title="Ventas por hora (hoy)"><Bars data={hourData} /></Panel>
        <Panel title="Ventas por mesero"><Bars data={waiterData} /></Panel>
        <Panel title="Ventas por área"><Bars data={sectionData} /></Panel>
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
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 },
  kpi: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" },
  kpiLabel: { color: C.faint, fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: 5 },
  kpiValue: { color: C.cream, fontWeight: 800, fontSize: "1.15rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 },
  panel: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" },
  panelHead: { color: C.faint, fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12 },
};
