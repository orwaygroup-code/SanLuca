"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { C, btn, fld, formatMXN, Spinner, EmptyState, Modal } from "./ui";
import { apiFetch } from "./types";

/**
 * Liquidación de propinas por MESERO del turno abierto (vista Caja/Perla, v2).
 * Cada mesero cierra sus cuentas y se concilia su reserva digital (tarjeta+
 * transfer que retiene la casa) contra su punto (7% de su venta). Si la reserva
 * supera el 7%, caja le PAGA el excedente; si no alcanza, el mesero COMPLETA el
 * faltante en efectivo. Su PIN autoriza. El corte se bloquea hasta liquidar a
 * todos. El punto% y las áreas los define SOLO el admin en Ajustes (aquí se ven,
 * no se editan). Todo el cálculo se rehace en el servidor.
 */

type Direction = "PAY" | "COLLECT" | "EVEN";

interface SettledInfo {
  direction: Direction; amount: number; net: number; deduction: number; reserveCard: number;
  salesTotal: number; cashReceived: number | null; changeGiven: number; createdAt: string; settledBy: string | null;
}
interface WaiterRow {
  waiterId: number; fullName: string; salesTotal: number; reserveDigital: number; tipsRegistered: number;
  deduction: number; net: number; direction: Direction; amount: number; hasActive: boolean; settled: SettledInfo | null;
}
interface TipsData {
  session: { id: number } | null;
  pointPercent: number;
  waiters: WaiterRow[];
  pool: number;
  areas: { name: string; percent: number; amount: number }[];
  allSettled: boolean;
  pendingSettle: number;
}

const num = (s: string | number) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function TipsPanel({ onToast }: { onToast: (m: string, kind?: "success" | "error" | "info") => void }) {
  const [data, setData] = useState<TipsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<WaiterRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch<TipsData>("/api/caja/tips/current");
    setLoading(false);
    if (!r.ok) { onToast(r.error ?? "No se pudo cargar propinas", "error"); return; }
    setData(r.data!);
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const waiters = useMemo(() => data?.waiters ?? [], [data]);

  if (loading && !data) return <Spinner label="Cargando propinas…" />;
  if (!data?.session) return <EmptyState text="Abre un turno de caja para liquidar propinas." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Estado del corte respecto a propinas */}
      <div style={{ ...s.banner, borderColor: data.allSettled ? C.green : C.border }}>
        <div>
          <div style={s.bannerLabel}>Liquidación de propinas · punto {data.pointPercent}% sobre venta</div>
          <div style={s.bannerHint}>
            {data.allSettled
              ? "✓ Todos los meseros liquidados — ya puedes hacer el corte."
              : `Faltan ${data.pendingSettle} mesero(s) por liquidar. El corte se bloquea hasta liquidarlos.`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={s.bannerHint}>Pool a áreas</div>
          <div style={s.bannerVal}>{formatMXN(data.pool)}</div>
        </div>
      </div>

      {/* Meseros */}
      <div style={s.card}>
        <div style={s.head}><span>Por mesero</span><span style={{ color: C.gold }}>reserva = tarjeta + transferencia</span></div>
        {waiters.length === 0 ? (
          <div style={{ color: C.faint, fontSize: "0.86rem", padding: "10px 0" }}>Aún no hay ventas cobradas en este turno.</div>
        ) : waiters.map((w) => {
          const stale = !!w.settled && w.salesTotal > w.settled.salesTotal + 0.005;
          return (
          <div key={w.waiterId} style={s.waiter}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={{ color: C.cream, fontWeight: 700 }}>{w.fullName}</span>
              {w.settled && !stale ? (
                <span style={{ fontWeight: 800, color: C.green, fontSize: "0.82rem" }}>✓ Liquidado</span>
              ) : stale ? (
                <span style={{ fontWeight: 800, color: C.amber, fontSize: "0.82rem" }}>Re-liquidar</span>
              ) : (
                <span style={{ fontWeight: 800, color: w.direction === "COLLECT" ? C.amber : w.direction === "PAY" ? C.green : C.dim, fontSize: "0.82rem" }}>
                  {w.direction === "PAY" ? `Se le paga ${formatMXN(w.amount)}` : w.direction === "COLLECT" ? `Debe ${formatMXN(w.amount)}` : "A mano"}
                </span>
              )}
            </div>
            <div style={{ color: C.faint, fontSize: "0.76rem", marginTop: 4 }}>
              Venta {formatMXN(w.salesTotal)} · Reserva {formatMXN(w.reserveDigital)} · Punto −{formatMXN(w.deduction)}
            </div>

            {w.settled && !stale ? (
              <div style={{ color: C.dim, fontSize: "0.74rem", marginTop: 6 }}>
                {w.settled.direction === "PAY" && `Caja le pagó ${formatMXN(w.settled.amount)}`}
                {w.settled.direction === "COLLECT" && `Recibió ${formatMXN(w.settled.cashReceived ?? 0)} · cambio ${formatMXN(w.settled.changeGiven)} (cobrado ${formatMXN(w.settled.amount)})`}
                {w.settled.direction === "EVEN" && "Sin movimiento (reserva = punto)"}
                {w.settled.settledBy ? ` · por ${w.settled.settledBy}` : ""}
              </div>
            ) : stale ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: C.amber, fontSize: "0.74rem", marginBottom: 6 }}>
                  Vendió {formatMXN(w.salesTotal - w.settled!.salesTotal)} más después de liquidar — vuelve a liquidar antes del corte.
                </div>
                <button style={{ ...btn.ghost, padding: "9px 14px", fontSize: "0.82rem", borderColor: C.amber, color: C.amber }} onClick={() => setTarget(w)}>
                  Re-liquidar ({w.direction === "PAY" ? `pagar ${formatMXN(w.amount)}` : w.direction === "COLLECT" ? `cobrar ${formatMXN(w.amount)}` : "a mano"})
                </button>
              </div>
            ) : w.hasActive ? (
              <div style={{ color: C.amber, fontSize: "0.74rem", marginTop: 8 }}>Tiene cuentas abiertas — ciérralas/cóbralas antes de liquidar.</div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <button
                  style={{ ...(w.direction === "COLLECT" ? btn.ghost : btn.primary), padding: "9px 14px", fontSize: "0.82rem" }}
                  onClick={() => setTarget(w)}
                >
                  {w.direction === "PAY" ? `Pagar al mesero ${formatMXN(w.amount)}` : w.direction === "COLLECT" ? `Recibir 7% (${formatMXN(w.amount)})` : "Marcar liquidado"}
                </button>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Reparto a áreas (solo lectura — lo configura el admin en Ajustes) */}
      <div style={s.card}>
        <div style={s.head}><span>Reparto a áreas</span><span style={{ color: C.faint }}>configurado en Ajustes</span></div>
        {data.areas.length === 0 ? (
          <div style={{ color: C.faint, fontSize: "0.84rem" }}>Sin áreas configuradas. Pide al administrador definirlas en Ajustes.</div>
        ) : data.areas.map((a, i) => (
          <div key={i} style={s.kv}>
            <span style={{ color: C.cream }}>{a.name} <span style={{ color: C.faint, fontSize: "0.76rem" }}>({round2(num(a.percent))})</span></span>
            <span style={{ color: C.cream, fontWeight: 700 }}>{formatMXN(a.amount)}</span>
          </div>
        ))}
        <div style={{ ...s.kv, marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 8, color: C.cream, fontWeight: 800 }}>
          <span>Pool a repartir</span><span>{formatMXN(data.pool)}</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button style={btn.ghost} onClick={load}>↻ Actualizar</button>
      </div>

      <SettleModal
        row={target}
        onClose={() => setTarget(null)}
        onSettled={(msg) => { setTarget(null); onToast(msg, "success"); load(); }}
        onError={(m) => onToast(m, "error")}
      />
    </div>
  );
}

// ─────────────────────────────────── Modal: liquidar a un mesero (PIN + efectivo) ──
function SettleModal({ row, onClose, onSettled, onError }: {
  row: WaiterRow | null;
  onClose: () => void;
  onSettled: (msg: string) => void;
  onError: (m: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (row) { setPin(""); setCash(""); setBusy(false); } }, [row]);

  const isCollect = row?.direction === "COLLECT";
  const amount = row?.amount ?? 0;
  const cashNum = num(cash);
  const change = isCollect ? round2(Math.max(0, cashNum - amount)) : 0;
  const cashOk = !isCollect || cashNum >= amount - 0.005;
  const canConfirm = !!row && /^\d{4}$/.test(pin) && cashOk && !busy;

  const confirm = async () => {
    if (!row || !canConfirm) return;
    setBusy(true);
    const r = await apiFetch<unknown>("/api/caja/tips/settle-waiter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId: row.waiterId, pin, ...(isCollect ? { cashReceived: cashNum } : {}) }),
    });
    setBusy(false);
    if (r.ok) {
      onSettled(
        row.direction === "PAY" ? `Pagado ${formatMXN(amount)} a ${row.fullName}`
        : row.direction === "COLLECT" ? `Cobrado ${formatMXN(amount)} a ${row.fullName}${change > 0 ? ` · cambio ${formatMXN(change)}` : ""}`
        : `${row.fullName} liquidado`,
      );
    } else onError(r.error ?? "No se pudo liquidar");
  };

  return (
    <Modal open={!!row} title={row ? `Liquidar propina · ${row.fullName}` : ""} onClose={onClose}>
      {row && (
        <>
          {/* Ticket / desglose */}
          <div style={s.ticket}>
            <Line k="Venta del turno" v={formatMXN(row.salesTotal)} />
            <Line k="Reserva (tarjeta + transfer)" v={formatMXN(row.reserveDigital)} />
            <Line k={`Punto (${row.deduction > 0 ? "7%" : "0%"} de venta)`} v={`− ${formatMXN(row.deduction)}`} />
            <div style={{ borderTop: `1px solid ${C.line}`, margin: "6px 0" }} />
            {row.direction === "PAY" && <Line k="Se le paga al mesero" v={formatMXN(amount)} strong good />}
            {row.direction === "COLLECT" && <Line k="El mesero completa (efectivo)" v={formatMXN(amount)} strong amber />}
            {row.direction === "EVEN" && <Line k="Queda a mano" v={formatMXN(0)} strong />}
          </div>

          {isCollect && (
            <>
              <label style={{ ...fld.label, marginTop: 14 }}>Efectivo recibido del mesero</label>
              <input
                style={{ ...fld.input, textAlign: "right" }}
                value={cash}
                onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder={amount.toFixed(2)}
                autoFocus
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.85rem" }}>
                <span style={{ color: C.faint }}>Cambio a devolver</span>
                <span style={{ color: change > 0 ? C.gold : C.dim, fontWeight: 800 }}>{formatMXN(change)}</span>
              </div>
              {!cashOk && cash !== "" && <div style={{ color: C.red, fontSize: "0.76rem", marginTop: 4 }}>Menor a lo que debe ({formatMXN(amount)}).</div>}
            </>
          )}

          <label style={{ ...fld.label, marginTop: 16 }}>PIN del mesero ({row.fullName}) para autorizar</label>
          <input
            style={{ ...fld.input, letterSpacing: "0.4em", textAlign: "center", fontSize: "1.2rem" }}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            type="password"
            autoComplete="off"
            placeholder="••••"
            autoFocus={!isCollect}
          />

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
            <button style={{ ...btn.primary, opacity: canConfirm ? 1 : 0.5 }} onClick={confirm} disabled={!canConfirm}>
              {busy ? "…" : row.direction === "PAY" ? "Pagar e imprimir" : row.direction === "COLLECT" ? "Cobrar e imprimir" : "Liquidar"}
            </button>
          </div>
          <div style={{ color: C.faint, fontSize: "0.72rem", textAlign: "center", marginTop: 8 }}>
            El PIN del mesero confirma que recibió/entregó el monto.
          </div>
        </>
      )}
    </Modal>
  );
}

function Line({ k, v, strong, good, amber }: { k: string; v: string; strong?: boolean; good?: boolean; amber?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: strong ? "0.95rem" : "0.85rem" }}>
      <span style={{ color: strong ? C.cream : C.faint }}>{k}</span>
      <span style={{ color: good ? C.green : amber ? C.amber : C.cream, fontWeight: strong ? 800 : 600 }}>{v}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  banner: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    background: "color-mix(in srgb, var(--sl-gold) 10%, var(--sl-panel))", border: "1px solid", borderRadius: 14, padding: "14px 16px",
  },
  bannerLabel: { color: C.gold, fontWeight: 800, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase" },
  bannerHint: { color: C.faint, fontSize: "0.74rem", marginTop: 3, maxWidth: 340 },
  bannerVal: { color: C.cream, fontWeight: 800, fontSize: "1.35rem" },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" },
  head: { display: "flex", justifyContent: "space-between", color: C.faint, fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 },
  waiter: { padding: "10px 0", borderBottom: `1px solid ${C.line}` },
  kv: { display: "flex", justifyContent: "space-between", fontSize: "0.86rem", padding: "3px 0" },
  ticket: { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" },
};
