"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/components/staff/types";
import { DateRangeBar, dateFilterQuery, DEFAULT_FILTER, type DateFilter } from "@/components/admin/DateRangeBar";
import { RP, money, shiftLabel, methodLabel, fmtDateTime, tbl, Chip, PageHead } from "@/components/admin/reportsUi";

/**
 * Historial de venta: TODAS las cuentas pagadas por fecha de cobro (versión histórica).
 * Solo lectura. Distinto de la caja (/staff/cuentas = turno actual). ADMIN (layout).
 */

interface Row {
  id: string; folio: string; closedAt: string | null; shift: string | null; total: number; guests: number;
  table: string; section: string; waiter: string; items: number; tip: number; methods: string[];
}
interface Resp { rows: Row[]; truncated: boolean; count: number; salesTotal: number; label: string }

export default function HistorialVentaPage() {
  const [filter, setFilter] = useState<DateFilter>(DEFAULT_FILTER);
  const [q, setQ] = useState("");
  const [resp, setResp] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = `${dateFilterQuery(filter)}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`;
    apiFetch<Resp>(`/api/admin/sales-history?${qs}`).then((r) => {
      setResp(r.ok ? (r.data ?? null) : null);
      setLoading(false);
    });
  }, [filter, q]);
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding: 24, maxWidth: 1150, margin: "0 auto" }}>
      <PageHead title="Historial de venta" subtitle="Todas las cuentas cobradas por fecha. Solo lectura." />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <DateRangeBar value={filter} onChange={setFilter} />
        <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: "flex", gap: 6 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Folio, mesero o nombre…"
            style={{ padding: "7px 11px", borderRadius: 8, border: `1px solid ${RP.border}`, background: RP.panel, color: RP.cream, fontFamily: "inherit", fontSize: "0.82rem", minWidth: 210 }} />
          <button type="submit" style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: RP.gold, color: "#16201f", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Buscar</button>
        </form>
      </div>

      {loading ? (
        <p style={{ color: RP.dim }}>Cargando…</p>
      ) : !resp || resp.rows.length === 0 ? (
        <p style={{ color: RP.dim }}>Sin cuentas pagadas en este rango.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, color: RP.cream }}>
            <span><b style={{ color: RP.gold }}>{resp.count}</b> cuentas</span>
            <span>Total cobrado: <b style={{ color: RP.gold }}>{money(resp.salesTotal)}</b></span>
            {resp.truncated && <span style={{ color: RP.red }}>Se muestran las primeras 500 — acota el rango para ver todas.</span>}
          </div>
          <div style={tbl.wrap}>
            <table style={tbl.table}>
              <thead><tr>{["Folio", "Fecha", "Turno", "Mesa · Sección", "Mesero", "Com.", "Items", "Propina", "Total", "Pago"].map((h, i) => (
                <th key={h} style={{ ...tbl.th, ...([5, 6, 7, 8].includes(i) ? tbl.num : {}) }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {resp.rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...tbl.td, fontWeight: 700 }}>{r.folio}</td>
                    <td style={tbl.td}>{fmtDateTime(r.closedAt)}</td>
                    <td style={tbl.td}>{shiftLabel(r.shift)}</td>
                    <td style={tbl.td}>{r.table} <span style={{ color: RP.faint }}>· {r.section}</span></td>
                    <td style={tbl.td}>{r.waiter}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{r.guests}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{r.items}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{money(r.tip)}</td>
                    <td style={{ ...tbl.td, ...tbl.num, fontWeight: 700 }}>{money(r.total)}</td>
                    <td style={tbl.td}>{r.methods.length ? r.methods.map((m) => <Chip key={m}>{methodLabel(m)}</Chip>) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
