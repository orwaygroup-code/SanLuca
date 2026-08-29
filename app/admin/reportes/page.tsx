"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/components/staff/types";
import { DateRangeBar, dateFilterQuery, DEFAULT_FILTER, type DateFilter } from "@/components/admin/DateRangeBar";
import { RP, money, tbl, PageHead } from "@/components/admin/reportsUi";

/**
 * Reportes de venta (agregados). Flujo: primero se elige el rango de fechas, luego se
 * subfiltra en Todo / Por producto / Por secciones / Por menús. Reusa /api/admin/reports
 * (KPIs, byShift, bySection, topDishes, byCarta). Solo lectura. ADMIN (lo guarda el layout).
 */

interface Kpis { sales: number; taxCollected: number; tips: number; comandas: number; guests: number; avgTicket: number }
interface Shift { shift: string; label: string; window: string; sales: number; comandas: number; guests: number; avgTicket: number; occupancy: number; topDish: { name: string; qty: number } | null }
interface Reports {
  kpis: Kpis;
  byShift: Shift[];
  bySection: { section: string; sales: number; comandas: number }[];
  topDishes: { name: string; qty: number; revenue: number }[];
  byCarta: { carta: string; qty: number; revenue: number }[];
}

type Sub = "todo" | "producto" | "secciones" | "menus";
const SUBS: { key: Sub; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "producto", label: "Por producto" },
  { key: "secciones", label: "Por secciones" },
  { key: "menus", label: "Por menús" },
];

export default function ReportesPage() {
  const [filter, setFilter] = useState<DateFilter>(DEFAULT_FILTER);
  const [sub, setSub] = useState<Sub>("todo");
  const [data, setData] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<Reports>(`/api/admin/reports?${dateFilterQuery(filter)}`).then((r) => {
      setData(r.ok ? (r.data ?? null) : null);
      setLoading(false);
    });
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: "0 auto" }}>
      <PageHead title="Reportes de venta" subtitle="Elige el rango de fechas y luego el detalle que quieres ver." />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <DateRangeBar value={filter} onChange={setFilter} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {SUBS.map((s) => (
          <button key={s.key} onClick={() => setSub(s.key)}
            style={{
              padding: "8px 15px", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: "0.83rem", fontFamily: "inherit",
              border: `1px solid ${sub === s.key ? RP.gold : RP.border}`,
              background: sub === s.key ? RP.gold : "transparent",
              color: sub === s.key ? "#16201f" : RP.dim,
            }}>{s.label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: RP.dim }}>Cargando…</p>
      ) : !data ? (
        <p style={{ color: RP.dim }}>No se pudo cargar el reporte.</p>
      ) : sub === "todo" ? (
        <TodoView data={data} />
      ) : sub === "producto" ? (
        <ProductoView rows={data.topDishes} />
      ) : sub === "secciones" ? (
        <SeccionesView rows={data.bySection} />
      ) : (
        <MenusView rows={data.byCarta} />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: RP.panel, border: `1px solid ${RP.line}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: RP.faint, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: RP.cream, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function TodoView({ data }: { data: Reports }) {
  const k = data.kpis;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Kpi label="Ventas" value={money(k.sales)} />
        <Kpi label="Cuentas" value={String(k.comandas)} />
        <Kpi label="Comensales" value={String(k.guests)} />
        <Kpi label="Ticket prom." value={money(k.avgTicket)} />
        <Kpi label="Propinas" value={money(k.tips)} />
        <Kpi label="IVA cobrado" value={money(k.taxCollected)} />
      </div>

      <h2 style={{ fontSize: "0.95rem", fontWeight: 800, color: RP.cream, margin: "0 0 10px" }}>Por turno</h2>
      <div style={tbl.wrap}>
        <table style={tbl.table}>
          <thead><tr>{["Turno", "Ventas", "Cuentas", "Comensales", "Ticket prom.", "Ocupación", "Más vendido"].map((h, i) => (
            <th key={h} style={{ ...tbl.th, ...(i >= 1 && i <= 4 ? tbl.num : {}) }}>{h}</th>
          ))}</tr></thead>
          <tbody>
            {data.byShift.map((s) => (
              <tr key={s.shift}>
                <td style={tbl.td}><b>{s.label}</b> <span style={{ color: RP.faint, fontSize: "0.75rem" }}>{s.window}</span></td>
                <td style={{ ...tbl.td, ...tbl.num }}>{money(s.sales)}</td>
                <td style={{ ...tbl.td, ...tbl.num }}>{s.comandas}</td>
                <td style={{ ...tbl.td, ...tbl.num }}>{s.guests}</td>
                <td style={{ ...tbl.td, ...tbl.num }}>{money(s.avgTicket)}</td>
                <td style={{ ...tbl.td, ...tbl.num }}>{s.occupancy}%</td>
                <td style={tbl.td}>{s.topDish ? `${s.topDish.name} (${s.topDish.qty})` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RankTable({ head, rows }: { head: [string, string, string]; rows: { c1: string; qty: number; money: number }[] }) {
  const totalQty = useMemo(() => rows.reduce((s, r) => s + r.qty, 0), [rows]);
  const totalMoney = useMemo(() => rows.reduce((s, r) => s + r.money, 0), [rows]);
  if (rows.length === 0) return <p style={{ color: RP.dim }}>Sin datos en este rango.</p>;
  return (
    <div style={tbl.wrap}>
      <table style={tbl.table}>
        <thead><tr>
          <th style={tbl.th}>{head[0]}</th>
          <th style={{ ...tbl.th, ...tbl.num }}>{head[1]}</th>
          <th style={{ ...tbl.th, ...tbl.num }}>{head[2]}</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.c1 + i}>
              <td style={tbl.td}>{r.c1}</td>
              <td style={{ ...tbl.td, ...tbl.num }}>{r.qty}</td>
              <td style={{ ...tbl.td, ...tbl.num }}>{money(r.money)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...tbl.td, fontWeight: 800, color: RP.gold, borderBottom: "none" }}>Total</td>
            <td style={{ ...tbl.td, ...tbl.num, fontWeight: 800, color: RP.gold, borderBottom: "none" }}>{totalQty}</td>
            <td style={{ ...tbl.td, ...tbl.num, fontWeight: 800, color: RP.gold, borderBottom: "none" }}>{money(totalMoney)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ProductoView({ rows }: { rows: Reports["topDishes"] }) {
  return <RankTable head={["Producto", "Cant.", "Ingreso"]} rows={rows.map((r) => ({ c1: r.name, qty: r.qty, money: r.revenue }))} />;
}
function SeccionesView({ rows }: { rows: Reports["bySection"] }) {
  return <RankTable head={["Sección", "Cuentas", "Ventas"]} rows={rows.map((r) => ({ c1: r.section, qty: r.comandas, money: r.sales }))} />;
}
function MenusView({ rows }: { rows: Reports["byCarta"] }) {
  return <RankTable head={["Menú / carta", "Cant.", "Ingreso"]} rows={rows.map((r) => ({ c1: r.carta, qty: r.qty, money: r.revenue }))} />;
}
