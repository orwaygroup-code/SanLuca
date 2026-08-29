"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/components/staff/types";
import { DateRangeBar, dateFilterQuery, DEFAULT_FILTER, type DateFilter } from "@/components/admin/DateRangeBar";
import { RP, money, shiftLabel, fmtDateTime, tbl, Chip, PageHead } from "@/components/admin/reportsUi";

/**
 * Historial de cierres de turno: cada CashSession (corte de caja) por fecha de apertura.
 * Muestra apertura/cierre, arqueo (esperado vs contado) y la diferencia. Solo lectura. ADMIN.
 */

interface Row {
  id: number; folio: string; shift: string | null; status: string;
  openedAt: string; closedAt: string | null; openedBy: string; closedBy: string | null;
  openingFloat: number; expectedCash: number | null; countedCash: number | null; countedCard: number | null;
  difference: number | null; comandas: number; sales: number; tips: number;
}
interface Resp { rows: Row[]; salesTotal: number; count: number; label: string }

const diffTone = (d: number | null): "dim" | "red" | "green" =>
  d == null ? "dim" : d < -0.005 ? "red" : d > 0.005 ? "green" : "dim";

export default function CierresPage() {
  const [filter, setFilter] = useState<DateFilter>({ ...DEFAULT_FILTER, mode: "preset", range: "7d" });
  const [resp, setResp] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<Resp>(`/api/admin/cortes?${dateFilterQuery(filter)}`).then((r) => {
      setResp(r.ok ? (r.data ?? null) : null);
      setLoading(false);
    });
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 24, maxWidth: 1250, margin: "0 auto" }}>
      <PageHead title="Historial de cierres de turno" subtitle="Cada corte de caja por fecha de apertura. Solo lectura." />

      <div style={{ marginBottom: 16 }}>
        <DateRangeBar value={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <p style={{ color: RP.dim }}>Cargando…</p>
      ) : !resp || resp.rows.length === 0 ? (
        <p style={{ color: RP.dim }}>Sin cortes en este rango.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, color: RP.cream }}>
            <span><b style={{ color: RP.gold }}>{resp.count}</b> cortes</span>
            <span>Ventas del periodo: <b style={{ color: RP.gold }}>{money(resp.salesTotal)}</b></span>
          </div>
          <div style={tbl.wrap}>
            <table style={tbl.table}>
              <thead><tr>{["Folio", "Turno", "Estado", "Apertura", "Cierre", "Fondo", "Esperado ef.", "Contado ef.", "Tarjeta", "Dif.", "Ventas", "Cta."].map((h, i) => (
                <th key={h} style={{ ...tbl.th, ...(i >= 5 ? tbl.num : {}) }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {resp.rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...tbl.td, fontWeight: 700 }}>{r.folio}</td>
                    <td style={tbl.td}>{shiftLabel(r.shift)}</td>
                    <td style={tbl.td}>
                      {r.status === "OPEN" ? <Chip tone="green">Abierto</Chip> : <Chip tone="dim">Cerrado</Chip>}
                    </td>
                    <td style={tbl.td}>{fmtDateTime(r.openedAt)}<br /><span style={{ color: RP.faint, fontSize: "0.72rem" }}>{r.openedBy}</span></td>
                    <td style={tbl.td}>{r.closedAt ? <>{fmtDateTime(r.closedAt)}<br /><span style={{ color: RP.faint, fontSize: "0.72rem" }}>{r.closedBy ?? "—"}</span></> : "—"}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{money(r.openingFloat)}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{r.expectedCash != null ? money(r.expectedCash) : "—"}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{r.countedCash != null ? money(r.countedCash) : "—"}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{r.countedCard != null ? money(r.countedCard) : "—"}</td>
                    <td style={{ ...tbl.td, ...tbl.num, fontWeight: 700, color: diffTone(r.difference) === "red" ? RP.red : diffTone(r.difference) === "green" ? RP.green : RP.cream }}>
                      {r.difference != null ? money(r.difference) : "—"}
                    </td>
                    <td style={{ ...tbl.td, ...tbl.num, fontWeight: 700 }}>{money(r.sales)}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{r.comandas}</td>
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
