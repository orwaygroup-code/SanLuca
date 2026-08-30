"use client";

import { Fragment, useCallback, useEffect, useState, type CSSProperties } from "react";
import { apiFetch } from "@/components/staff/types";
import { DateRangeBar, dateFilterQuery, DEFAULT_FILTER, type DateFilter } from "@/components/admin/DateRangeBar";
import { ExportModal, ExportButton } from "@/components/admin/ExportModal";
import { dialogAlert } from "@/components/ui/DialogHost";
import { tableToTicketText, tableToCsv, tableToPrintableHtml, tableFileName, type TableExport } from "@/lib/reportExport";
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

// Detalle de un corte (reusa /api/admin/reports?cashSessionId=N, acotado a ese corte).
interface CorteDetail {
  kpis: { sales: number; comandas: number; guests: number; tips: number; avgTicket: number; taxCollected: number };
  byMethod: { method: string; amount: number; tip: number; count: number }[];
  byShift: { shift: string; label: string; sales: number; comandas: number; guests: number; avgTicket: number }[];
  topDishes: { name: string; qty: number; revenue: number; comandas: number }[];
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia",
  WAITER_CREDIT: "Crédito de personal", COURTESY: "Cortesía", OTHER: "Otro",
};
const methodLabel = (m: string) => METHOD_LABEL[m] ?? m;

const diffTone = (d: number | null): "dim" | "red" | "green" =>
  d == null ? "dim" : d < -0.005 ? "red" : d > 0.005 ? "green" : "dim";

export default function CierresPage() {
  const [filter, setFilter] = useState<DateFilter>({ ...DEFAULT_FILTER, mode: "preset", range: "7d" });
  const [resp, setResp] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  /** Las MISMAS columnas del arqueo que se ven en pantalla. */
  const tableData = (): TableExport => ({
    title: "Cierres de turno",
    rangeLabel: resp?.label ?? "",
    summary: [
      { label: "Cortes", value: String(resp?.count ?? 0) },
      { label: "Ventas del periodo", value: money(resp?.salesTotal ?? 0) },
    ],
    columns: [
      { key: "folio", label: "Folio" },
      { key: "turno", label: "Turno" },
      { key: "estado", label: "Estado" },
      { key: "apertura", label: "Apertura" },
      { key: "cierre", label: "Cierre" },
      { key: "fondo", label: "Fondo", num: true },
      { key: "esperado", label: "Esperado ef.", num: true },
      { key: "contado", label: "Contado ef.", num: true },
      { key: "tarjeta", label: "Tarjeta", num: true },
      { key: "dif", label: "Diferencia", num: true },
      { key: "ventas", label: "Ventas", num: true },
      { key: "cuentas", label: "Cuentas", num: true },
      { key: "propinas", label: "Propinas", num: true },
      { key: "abrio", label: "Abrió" },
      { key: "cerro", label: "Cerró" },
    ],
    rows: (resp?.rows ?? []).map((r) => ({
      folio: r.folio,
      turno: shiftLabel(r.shift),
      estado: r.status,
      apertura: fmtDateTime(r.openedAt),
      cierre: fmtDateTime(r.closedAt),
      fondo: r.openingFloat,
      // Un corte abierto todavía no tiene arqueo: se deja vacío en vez de un 0
      // que se leería como "contaron cero".
      esperado: r.expectedCash ?? "",
      contado: r.countedCash ?? "",
      tarjeta: r.countedCard ?? "",
      dif: r.difference ?? "",
      ventas: r.sales,
      cuentas: r.comandas,
      propinas: r.tips,
      abrio: r.openedBy,
      cerro: r.closedBy ?? "",
    })),
  });
  // "Ver más" por corte: expande una fila con el detalle (métodos de pago + top productos).
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, CorteDetail | null>>({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<Resp>(`/api/admin/cortes?${dateFilterQuery(filter)}`).then((r) => {
      setResp(r.ok ? (r.data ?? null) : null);
      setLoading(false);
    });
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  // Al cambiar el filtro se recarga la lista; cierra cualquier detalle abierto.
  useEffect(() => { setOpenId(null); }, [filter]);

  const toggleDetail = async (id: number) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (detail[id] === undefined) {
      setDetailLoading(id);
      const r = await apiFetch<CorteDetail>(`/api/admin/reports?cashSessionId=${id}`);
      setDetail((d) => ({ ...d, [id]: r.ok ? (r.data ?? null) : null }));
      setDetailLoading(null);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1250, margin: "0 auto" }}>
      <PageHead title="Historial de cierres de turno" subtitle="Cada corte de caja por fecha de apertura. Solo lectura." />

      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <DateRangeBar value={filter} onChange={setFilter} />
        <ExportButton onClick={() => setExportOpen(true)} disabled={loading || !resp || resp.rows.length === 0} />
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        subtitle={`Cierres de turno · ${resp?.label ?? ""}`}
        hasRows={!!resp && resp.rows.length > 0}
        onDone={(msg) => { void dialogAlert(msg, "Exportar"); }}
        producers={{
          ticket: () => tableToTicketText(tableData()),
          csv: () => tableToCsv(tableData()),
          html: () => tableToPrintableHtml(tableData()),
          fileName: (ext) => tableFileName("cierres-de-turno", resp?.label ?? "rango", ext),
        }}
      />

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
              <thead><tr>{["Folio", "Turno", "Estado", "Apertura", "Cierre", "Fondo", "Esperado ef.", "Contado ef.", "Tarjeta", "Dif.", "Ventas", "Cta.", ""].map((h, i) => (
                <th key={i} style={{ ...tbl.th, ...(i >= 5 && i <= 11 ? tbl.num : {}) }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {resp.rows.map((r) => {
                  const isOpen = openId === r.id;
                  return (
                  <Fragment key={r.id}>
                  <tr>
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
                    <td style={tbl.td}>
                      <button onClick={() => toggleDetail(r.id)}
                        style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${isOpen ? RP.gold : RP.border}`, background: isOpen ? RP.gold : "transparent", color: isOpen ? "var(--sl-on-accent)" : RP.gold, fontWeight: 700, fontSize: "0.76rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                        {isOpen ? "Ocultar" : "Ver más"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={13} style={{ padding: 0, background: "rgba(0,0,0,0.18)", borderBottom: `1px solid ${RP.line}` }}>
                        {detailLoading === r.id && detail[r.id] === undefined ? (
                          <p style={{ color: RP.dim, padding: "14px 16px", margin: 0 }}>Cargando detalle…</p>
                        ) : detail[r.id] == null ? (
                          <p style={{ color: RP.dim, padding: "14px 16px", margin: 0 }}>No se pudo cargar el detalle de este corte.</p>
                        ) : (
                          <CorteDetailPanel d={detail[r.id] as CorteDetail} />
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const detailH: CSSProperties = { fontSize: "0.8rem", fontWeight: 800, color: RP.gold, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" };

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: RP.panel, border: `1px solid ${RP.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: "0.62rem", letterSpacing: "0.06em", textTransform: "uppercase", color: RP.faint, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: RP.cream, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// Detalle expandible de un corte: KPIs + métodos de pago + top productos + por turno.
function CorteDetailPanel({ d }: { d: CorteDetail }) {
  const k = d.kpis;
  const top = d.topDishes.slice(0, 10);
  const shifts = d.byShift.filter((s) => s.comandas > 0);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
        <MiniKpi label="Ventas" value={money(k.sales)} />
        <MiniKpi label="Cuentas" value={String(k.comandas)} />
        <MiniKpi label="Comensales" value={String(k.guests)} />
        <MiniKpi label="Ticket prom." value={money(k.avgTicket)} />
        <MiniKpi label="Propinas" value={money(k.tips)} />
        <MiniKpi label="IVA" value={money(k.taxCollected)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, alignItems: "start" }}>
        <div>
          <h3 style={detailH}>Métodos de pago</h3>
          {d.byMethod.length === 0 ? <p style={{ color: RP.dim, fontSize: "0.85rem", margin: 0 }}>Sin pagos.</p> : (
            <div style={tbl.wrap}><table style={tbl.table}>
              <thead><tr>
                <th style={tbl.th}>Método</th>
                <th style={{ ...tbl.th, ...tbl.num }}>Cobrado</th>
                <th style={{ ...tbl.th, ...tbl.num }}>Propina</th>
                <th style={{ ...tbl.th, ...tbl.num }}>Movs.</th>
              </tr></thead>
              <tbody>
                {d.byMethod.map((m) => (
                  <tr key={m.method}>
                    <td style={tbl.td}>{methodLabel(m.method)}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{money(m.amount)}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{money(m.tip)}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{m.count}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        <div>
          <h3 style={detailH}>Top productos del corte</h3>
          {top.length === 0 ? <p style={{ color: RP.dim, fontSize: "0.85rem", margin: 0 }}>Sin productos.</p> : (
            <div style={tbl.wrap}><table style={tbl.table}>
              <thead><tr>
                <th style={tbl.th}>Producto</th>
                <th style={{ ...tbl.th, ...tbl.num }}>Cant.</th>
                <th style={{ ...tbl.th, ...tbl.num }}>Comandas</th>
                <th style={{ ...tbl.th, ...tbl.num }}>Ingreso</th>
              </tr></thead>
              <tbody>
                {top.map((t, i) => (
                  <tr key={t.name + i}>
                    <td style={tbl.td}>{t.name}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{t.qty}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{t.comandas}</td>
                    <td style={{ ...tbl.td, ...tbl.num }}>{money(t.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {shifts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={detailH}>Por turno</h3>
          <div style={tbl.wrap}><table style={tbl.table}>
            <thead><tr>
              <th style={tbl.th}>Turno</th>
              <th style={{ ...tbl.th, ...tbl.num }}>Ventas</th>
              <th style={{ ...tbl.th, ...tbl.num }}>Cuentas</th>
              <th style={{ ...tbl.th, ...tbl.num }}>Comensales</th>
              <th style={{ ...tbl.th, ...tbl.num }}>Ticket prom.</th>
            </tr></thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.shift}>
                  <td style={tbl.td}>{s.label}</td>
                  <td style={{ ...tbl.td, ...tbl.num }}>{money(s.sales)}</td>
                  <td style={{ ...tbl.td, ...tbl.num }}>{s.comandas}</td>
                  <td style={{ ...tbl.td, ...tbl.num }}>{s.guests}</td>
                  <td style={{ ...tbl.td, ...tbl.num }}>{money(s.avgTicket)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
