"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { C, Modal, Badge, Spinner, EmptyState, btn, fld, formatMXN } from "./ui";
import {
  apiFetch,
  comandaLabel,
  type Comanda,
  type CItem,
  type CashSession,
  type CutSnapshot,
  type PaymentMethod,
  type PayResult,
} from "./types";
import { GoldSelect } from "@/components/ui/GoldSelect";
import { splitPaymentLines } from "@/lib/paymentSplit";

/**
 * Componentes de CAJA (POS) — Fase 2. Todos controlados: la página dueña del
 * estado los abre con `open` y recibe el resultado por callback. Reutilizan el
 * kit de `ui.tsx` (Modal, btn, fld, formatMXN). Las acciones sensibles
 * (descuento/merge/traspaso) piden PIN de un Capitán/Manager (override inline).
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : 0; };
const MX_TZ = "America/Mexico_City";
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD_DEBIT: "Tarjeta débito",
  CARD_CREDIT: "Tarjeta crédito",
  TRANSFER: "Transferencia",
  WAITER_CREDIT: "Crédito mesero",
};
const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({
  value: m,
  label: PAYMENT_METHOD_LABEL[m],
}));

// ── primitivos ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <label style={fld.label}>{label}</label>
      {children}
    </div>
  );
}

function MoneyInput({ value, onChange, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <input
      style={fld.input}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
      inputMode="decimal"
      placeholder={placeholder ?? "0.00"}
      autoFocus={autoFocus}
      autoComplete="off"
    />
  );
}

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      style={{ ...fld.input, letterSpacing: "0.5em", textAlign: "center", fontSize: "1.15rem" }}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      inputMode="numeric"
      type="password"
      placeholder="••••"
      autoComplete="off"
      aria-label="PIN de supervisor"
    />
  );
}

/** Bloque de PIN de supervisor con nota — reutilizado por descuento/merge/traspaso. */
function SupervisorPin({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="PIN de Capitán/Manager (autoriza)">
      <PinInput value={value} onChange={onChange} />
      <div style={{ color: C.faint, fontSize: "0.72rem", marginTop: 6 }}>
        Un supervisor teclea su PIN de 4 dígitos para autorizar. Queda en la auditoría.
      </div>
    </Field>
  );
}

const kv: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", fontSize: "0.86rem" };

// ── hook: comandas activas (para juntar / traspasar) ────────────────────────

function useActiveComandas(open: boolean, excludeId: number) {
  const [list, setList] = useState<Comanda[] | null>(null);
  useEffect(() => {
    if (!open) { setList(null); return; }
    apiFetch<Comanda[]>("/api/comandas").then((r) => {
      setList(r.ok ? (r.data ?? []).filter((c) => c.id !== excludeId) : []);
    });
  }, [open, excludeId]);
  return list;
}

// ════════════════════════════════════════════════════════ OpenTurnoModal ══

export function OpenTurnoModal({ open, onClose, onOpened, onError }: {
  open: boolean; onClose: () => void; onOpened: (s: CashSession) => void; onError: (m: string) => void;
}) {
  const [openingFloat, setOpeningFloat] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setOpeningFloat(""); setNotes(""); } }, [open]);

  const submit = async () => {
    setBusy(true);
    const r = await apiFetch<CashSession>("/api/caja/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat: num(openingFloat), notes: notes.trim() || null }),
    });
    setBusy(false);
    if (r.ok) onOpened(r.data!);
    else onError(r.error ?? "No se pudo abrir el turno");
  };

  return (
    <Modal open={open} title="Abrir cajón (turno)" onClose={onClose}>
      <p style={{ margin: "0 0 4px", color: C.dim, fontSize: "0.86rem", lineHeight: 1.5 }}>
        Cuenta el efectivo con el que arranca la caja (fondo inicial). Solo puede haber un turno abierto a la vez.
      </p>
      <Field label="Fondo inicial (efectivo en cajón)">
        <MoneyInput value={openingFloat} onChange={setOpeningFloat} autoFocus />
      </Field>
      <Field label="Notas (opcional)">
        <input style={fld.input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ej. turno de la tarde, cajón 1" />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy}>
          {busy ? "Abriendo…" : "Abrir turno"}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════ CloseCashSessionModal ══

export function CloseCashSessionModal({ open, session, cut, onClose, onClosed, onError }: {
  open: boolean; session: CashSession | null; cut: CutSnapshot | null;
  onClose: () => void; onClosed: (r: { session: CashSession; cut: CutSnapshot; difference: number }) => void; onError: (m: string) => void;
}) {
  const [countedCash, setCountedCash] = useState("");
  const [countedCard, setCountedCard] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setCountedCash(""); setCountedCard(""); setNotes(""); } }, [open]);

  const expected = cut?.expectedCash ?? 0;
  const difference = countedCash.trim() ? round2(num(countedCash) - expected) : null;
  const cardExpected = round2(
    (cut?.byMethod.find((m) => m.method === "CARD_DEBIT")?.amount ?? 0) +
    (cut?.byMethod.find((m) => m.method === "CARD_CREDIT")?.amount ?? 0),
  );
  const cardDiff = countedCard.trim() ? round2(num(countedCard) - cardExpected) : null;

  const submit = async () => {
    if (!session) return;
    setBusy(true);
    const r = await apiFetch<{ session: CashSession; cut: CutSnapshot; difference: number }>(
      `/api/caja/sessions/${session.id}/close`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countedCash: num(countedCash), countedCard: countedCard.trim() ? num(countedCard) : null, notes: notes.trim() || null }) },
    );
    setBusy(false);
    if (r.ok) onClosed(r.data!);
    else onError(r.error ?? "No se pudo cerrar el turno");
  };

  return (
    <Modal open={open} title="Cerrar caja · Corte Z" onClose={onClose} width={460}>
      {cut && (
        <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ ...kv, color: C.dim }}><span>Fondo inicial</span><span>{formatMXN(cut.openingFloat)}</span></div>
          <div style={{ ...kv, color: C.dim }}><span>Efectivo cobrado</span><span>{formatMXN(cut.cashCollected)}</span></div>
          {cut.cashIn > 0 && <div style={{ ...kv, color: C.green }}><span>+ Entradas de efectivo</span><span>{formatMXN(cut.cashIn)}</span></div>}
          {cut.cashOut > 0 && <div style={{ ...kv, color: C.red }}><span>− Salidas de efectivo</span><span>{formatMXN(cut.cashOut)}</span></div>}
          <div style={{ ...kv, color: C.cream, fontWeight: 800, borderTop: `1px solid ${C.line}`, marginTop: 4, paddingTop: 6 }}>
            <span>Efectivo esperado</span><span>{formatMXN(cut.expectedCash)}</span>
          </div>
          <div style={{ ...kv, color: C.faint, fontSize: "0.78rem" }}><span>Tarjetas + transferencias</span><span>{formatMXN(round2(cut.totalCollected - cut.cashCollected))}</span></div>
          <div style={{ ...kv, color: C.faint, fontSize: "0.78rem" }}><span>Propinas (aparte de caja)</span><span>{formatMXN(cut.totalTips)}</span></div>
        </div>
      )}
      <Field label="Arqueo: efectivo contado en el cajón">
        <MoneyInput value={countedCash} onChange={setCountedCash} autoFocus />
      </Field>
      {difference !== null && (
        <div style={{
          ...kv, marginTop: 10, fontWeight: 800,
          color: Math.abs(difference) < 0.01 ? C.green : difference > 0 ? C.blue : C.red,
        }}>
          <span>{Math.abs(difference) < 0.01 ? "Efectivo cuadra" : difference > 0 ? "Efectivo: sobra" : "Efectivo: falta"}</span>
          <span>{formatMXN(Math.abs(difference))}</span>
        </div>
      )}
      <Field label={`Declaración: tarjeta según terminales (esperado ${formatMXN(cardExpected)})`}>
        <MoneyInput value={countedCard} onChange={setCountedCard} placeholder="0.00" />
      </Field>
      {cardDiff !== null && (
        <div style={{
          ...kv, marginTop: 10, fontWeight: 800,
          color: Math.abs(cardDiff) < 0.01 ? C.green : cardDiff > 0 ? C.blue : C.red,
        }}>
          <span>{Math.abs(cardDiff) < 0.01 ? "Tarjeta cuadra" : cardDiff > 0 ? "Tarjeta: sobra" : "Tarjeta: falta"}</span>
          <span>{formatMXN(Math.abs(cardDiff))}</span>
        </div>
      )}
      <Field label="Notas del corte (opcional)">
        <input style={fld.input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ej. faltante justificado por…" />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: !countedCash.trim() || busy ? 0.5 : 1 }} onClick={submit} disabled={!countedCash.trim() || busy}>
          {busy ? "Cerrando…" : "Cerrar turno"}
        </button>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════ TurnoBar ══

export function TurnoBar({ session, cut, onOpenTurno, onCloseTurno }: {
  session: CashSession | null; cut: CutSnapshot | null; onOpenTurno: () => void; onCloseTurno: () => void;
}) {
  return (
    <div style={bar.root}>
      {!session ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge text="Cajón cerrado" color={C.faint} />
            <span style={{ color: C.dim, fontSize: "0.82rem" }}>Abre el turno para poder cobrar.</span>
          </div>
          <button style={btn.primary} onClick={onOpenTurno}>Abrir cajón</button>
        </>
      ) : (
        <>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Badge text="Turno abierto" color={C.green} />
              <span style={{ color: C.cream, fontWeight: 700, fontSize: "0.86rem" }}>{session.folio}</span>
            </div>
            <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 4 }}>
              Desde {hhmm(session.openedAt)} · esperado en cajón {formatMXN(cut?.expectedCash ?? Number(session.openingFloat))}
              {cut ? ` · ${cut.comandasSettled} cuentas` : ""}
            </div>
          </div>
          <button style={btn.ghost} onClick={onCloseTurno}>Cerrar caja / corte</button>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════ CajaMonitor ══

export function CajaMonitor({ session, cut }: { session: CashSession | null; cut: CutSnapshot | null }) {
  if (!session) return <EmptyState text="No hay turno abierto. Abre el cajón para ver el corte." />;
  if (!cut) return <Spinner label="Calculando corte…" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={mon.grid}>
        <Kpi label="Cobrado (turno)" value={formatMXN(cut.totalCollected)} big />
        <Kpi label="Propinas (apartado)" value={formatMXN(cut.totalTips)} />
        <Kpi label="Efectivo esperado" value={formatMXN(cut.expectedCash)} />
        <Kpi label="Cuentas cobradas" value={String(cut.comandasSettled)} />
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={mon.head}>Desglose por método</div>
        {cut.byMethod.filter((m) => m.count > 0 || m.amount > 0).length === 0 ? (
          <div style={{ padding: "16px 18px", color: C.faint, fontSize: "0.84rem" }}>Aún sin pagos en este turno.</div>
        ) : (
          cut.byMethod.map((m) => (
            <div key={m.method} style={mon.row}>
              <span style={{ color: C.cream, fontSize: "0.88rem" }}>{PAYMENT_METHOD_LABEL[m.method]}</span>
              <span style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ color: C.faint, fontSize: "0.74rem" }}>{m.count} pago{m.count === 1 ? "" : "s"}</span>
                {m.tip > 0 && <span style={{ color: C.faint, fontSize: "0.74rem" }}>prop. {formatMXN(m.tip)}</span>}
                <span style={{ color: C.cream, fontWeight: 700, minWidth: 90, textAlign: "right" }}>{formatMXN(m.amount)}</span>
              </span>
            </div>
          ))
        )}
        <div style={{ ...mon.row, borderTop: `1px solid ${C.border}` }}>
          <span style={{ color: C.dim, fontSize: "0.78rem" }}>Fondo inicial {formatMXN(cut.openingFloat)}</span>
          <span style={{ color: C.cream, fontWeight: 800 }}>Esperado {formatMXN(cut.expectedCash)}</span>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={mon.kpi}>
      <div style={{ color: C.faint, fontSize: "0.66rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
      <div style={{ color: C.cream, fontWeight: 800, fontSize: big ? "1.35rem" : "1.05rem", marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════ PayModal ══

interface DraftLine { method: PaymentMethod; tendered: string; reference: string }
const newLine = (tendered = ""): DraftLine => ({ method: "CASH", tendered, reference: "" });

export function PayModal({ open, comandaId, hasOpenSession, onClose, onPaid, onError }: {
  open: boolean; comandaId: number | null; hasOpenSession: boolean;
  onClose: () => void; onPaid: (r: PayResult) => void; onError: (m: string) => void;
}) {
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [waiters, setWaiters] = useState<{ id: number; fullName: string; role: string }[]>([]);
  const [creditWaiterId, setCreditWaiterId] = useState("");
  const [creditPin, setCreditPin] = useState("");

  useEffect(() => {
    if (!open || comandaId == null) { setComanda(null); setLoadErr(null); return; }
    setComanda(null); setLoadErr(null); setCreditWaiterId(""); setCreditPin("");
    apiFetch<{ id: number; fullName: string; role: string }[]>("/api/comandas/waiters").then((r) => { if (r.ok) setWaiters(r.data ?? []); });
    apiFetch<Comanda>(`/api/comandas/${comandaId}`).then((r) => {
      if (r.ok) {
        const c = r.data!;
        setComanda(c);
        const remaining = round2(Number(c.total) - Number(c.amountPaid));
        setLines([newLine(remaining > 0 ? remaining.toFixed(2) : "")]);
      } else setLoadErr(r.error ?? "No se pudo cargar la cuenta");
    });
  }, [open, comandaId]);

  const total = comanda ? round2(Number(comanda.total)) : 0;
  const paidBefore = comanda ? round2(Number(comanda.amountPaid)) : 0;
  const remaining = round2(total - paidBefore);

  const calc = splitPaymentLines(lines.map((l) => ({ method: l.method, tendered: num(l.tendered), reference: l.reference })), remaining);
  const coveredNow = round2(calc.reduce((s, c) => s + c.billPortion, 0));
  const sumTip = round2(calc.reduce((s, c) => s + c.tip, 0));
  const sumChange = round2(calc.reduce((s, c) => s + c.change, 0));
  const newRemaining = round2(remaining - coveredNow);
  const settledPreview = newRemaining <= 0.01;
  const hasCredit = calc.some((c) => c.method === "WAITER_CREDIT" && c.billPortion > 0);
  const creditReady = !hasCredit || (Number(creditWaiterId) > 0 && /^\d{4}$/.test(creditPin));
  const canSubmit = !!comanda && coveredNow > 0 && creditReady && !busy;

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, newLine(newRemaining > 0 ? newRemaining.toFixed(2) : "")]);
  const removeLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const submit = async () => {
    if (!comanda) return;
    setBusy(true);
    // Envía a cada método SOLO lo que cubre de la cuenta (amount). En efectivo,
    // received = lo entregado → el server calcula el cambio. En tarjeta/transfer,
    // el excedente va como tip (propina del mesero).
    const payments = calc
      .filter((c) => c.billPortion > 0)
      .map((c) => ({
        method: c.method,
        amount: c.billPortion,
        received: c.method === "CASH" ? c.tendered : null,
        tip: c.tip,
        reference: c.reference.trim() || null,
      }));
    const r = await apiFetch<PayResult>(`/api/comandas/${comanda.id}/pay`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payments, ...(hasCredit ? { creditWaiterId: Number(creditWaiterId), creditWaiterPin: creditPin } : {}) }),
    });
    setBusy(false);
    if (r.ok) onPaid(r.data!);
    else onError(r.error ?? "No se pudo cobrar");
  };

  return (
    <Modal open={open} title="Cobrar cuenta" onClose={onClose} width={520}>
      {!hasOpenSession ? (
        <EmptyState text="Abre un turno de caja antes de cobrar." />
      ) : loadErr ? (
        <EmptyState text={loadErr} />
      ) : !comanda ? (
        <Spinner label="Cargando cuenta…" />
      ) : remaining <= 0 ? (
        <EmptyState text="La cuenta ya está saldada." />
      ) : (
        <>
          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ ...kv, color: C.dim }}><span>{comanda.folio} · {comandaLabel(comanda)}</span><span>Total {formatMXN(total)}</span></div>
            {paidBefore > 0 && <div style={{ ...kv, color: C.faint, fontSize: "0.78rem" }}><span>Pagado antes</span><span>{formatMXN(paidBefore)}</span></div>}
            <div style={{ ...kv, color: C.cream, fontWeight: 800 }}><span>Saldo por cobrar</span><span>{formatMXN(remaining)}</span></div>
          </div>

          {calc.map((c, i) => {
            const isCash = c.method === "CASH";
            return (
              <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px", marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: C.faint, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Pago {i + 1}</span>
                  {lines.length > 1 && <button style={pill.remove} onClick={() => removeLine(i)}>Quitar</button>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                  <div>
                    <label style={fld.label}>Método</label>
                    <GoldSelect value={c.method} onChange={(v) => setLine(i, { method: v as PaymentMethod })} options={METHOD_OPTIONS} />
                  </div>
                  <div>
                    <label style={fld.label}>{isCash ? "Efectivo recibido" : "Monto a cobrar"}</label>
                    <MoneyInput value={lines[i].tendered} onChange={(v) => setLine(i, { tendered: v })} placeholder={c.remainingBefore > 0 ? c.remainingBefore.toFixed(2) : "0.00"} />
                  </div>
                </div>
                {!isCash && (
                  <div style={{ marginTop: 8 }}>
                    <label style={fld.label}>Referencia (opcional)</label>
                    <input style={fld.input} value={lines[i].reference} onChange={(e) => setLine(i, { reference: e.target.value })} placeholder="últimos 4 / auth" />
                  </div>
                )}
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ ...kv, color: C.faint, fontSize: "0.78rem" }}><span>Cubre de la cuenta</span><span>{formatMXN(c.billPortion)}</span></div>
                  {isCash && c.change > 0 && (
                    <div style={{ ...kv, color: C.blue, fontWeight: 700, fontSize: "0.82rem" }}><span>Cambio a entregar</span><span>{formatMXN(c.change)}</span></div>
                  )}
                  {!isCash && c.tip > 0 && (
                    <div style={{ ...kv, color: C.gold, fontWeight: 700, fontSize: "0.82rem" }}><span>Propina al mesero (excedente)</span><span>{formatMXN(c.tip)}</span></div>
                  )}
                </div>
              </div>
            );
          })}

          <button style={{ ...btn.ghost, marginTop: 12, width: "100%", opacity: settledPreview ? 0.5 : 1 }} onClick={addLine} disabled={busy || settledPreview}>
            + Agregar otro método{newRemaining > 0 ? ` · falta ${formatMXN(newRemaining)}` : ""}
          </button>

          {hasCredit && (
            <div style={{ border: `1px solid ${C.gold}`, borderRadius: 12, padding: "12px 14px", marginTop: 12, background: "color-mix(in srgb, #ba843c 8%, transparent)" }}>
              <div style={{ color: C.gold, fontWeight: 800, fontSize: "0.82rem", marginBottom: 8 }}>Crédito de mesero · lo autoriza el mesero deudor con su PIN</div>
              <label style={fld.label}>Mesero al que se le carga</label>
              <GoldSelect
                value={creditWaiterId}
                onChange={setCreditWaiterId}
                options={[{ value: "", label: "Elige mesero…" }, ...waiters.map((w) => ({ value: String(w.id), label: w.fullName }))]}
              />
              <label style={{ ...fld.label, marginTop: 10 }}>PIN del mesero</label>
              <PinInput value={creditPin} onChange={setCreditPin} />
              <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 6 }}>Se le descuenta de su nómina. Queda como cuenta por cobrar.</div>
            </div>
          )}

          <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", marginTop: 12 }}>
            <div style={{ ...kv, color: C.cream, fontWeight: 700 }}><span>Cubierto ahora</span><span>{formatMXN(coveredNow)}</span></div>
            {sumTip > 0 && <div style={{ ...kv, color: C.gold, fontSize: "0.82rem" }}><span>Propina al mesero</span><span>{formatMXN(sumTip)}</span></div>}
            {sumChange > 0 && <div style={{ ...kv, color: C.blue, fontSize: "0.82rem" }}><span>Cambio a entregar</span><span>{formatMXN(sumChange)}</span></div>}
            <div style={{ ...kv, color: settledPreview ? C.green : C.amber, fontWeight: 800, borderTop: `1px solid ${C.line}`, marginTop: 4, paddingTop: 6 }}>
              <span>{settledPreview ? "Salda la cuenta" : "Falta por cubrir"}</span>
              <span>{settledPreview ? "✓" : formatMXN(Math.max(0, newRemaining))}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18, position: "sticky", bottom: 0, background: C.panel, paddingTop: 10 }}>
            <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
            <button style={{ ...btn.primary, opacity: canSubmit ? 1 : 0.5 }} onClick={submit} disabled={!canSubmit}>
              {busy ? "Cobrando…" : settledPreview ? "Cobrar y cerrar" : "Registrar abono"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════ DiscountModal ══

export function DiscountModal({ open, comandaId, itemId, itemName, onClose, onDone, onError }: {
  open: boolean; comandaId: number | null; itemId?: number | null; itemName?: string;
  onClose: () => void; onDone: (c: Comanda) => void; onError: (m: string) => void;
}) {
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setType("PERCENT"); setValue(""); setReason(""); setPin(""); } }, [open]);

  const submit = async () => {
    if (comandaId == null) return;
    setBusy(true);
    const path = itemId != null
      ? `/api/comandas/${comandaId}/items/${itemId}/discount`
      : `/api/comandas/${comandaId}/discount`;
    const r = await apiFetch<Comanda>(path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value: num(value), reason: reason.trim(), authPin: pin }),
    });
    setBusy(false);
    if (r.ok) onDone(r.data!);
    else onError(r.error ?? "No se pudo aplicar el descuento");
  };

  const canSubmit = num(value) > 0 && reason.trim().length > 0 && pin.length === 4 && !busy;

  return (
    <Modal open={open} title={itemId != null ? `Descuento · ${itemName ?? "producto"}` : "Descuento a la cuenta"} onClose={onClose}>
      <Field label="Tipo de descuento">
        <div style={{ display: "flex", gap: 8 }}>
          {(["PERCENT", "FIXED"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{ ...btn.ghost, flex: 1, ...(type === t ? { background: C.gold, color: "#16201f", borderColor: C.gold, fontWeight: 800 } : {}) }}
            >{t === "PERCENT" ? "Porcentaje %" : "Monto fijo $"}</button>
          ))}
        </div>
      </Field>
      <Field label={type === "PERCENT" ? "Porcentaje (ej. 10 = 10%)" : "Monto en pesos"}>
        <MoneyInput value={value} onChange={setValue} autoFocus />
      </Field>
      <Field label="Motivo (obligatorio)">
        <input style={fld.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej. cortesía, queja de servicio" />
      </Field>
      <SupervisorPin value={pin} onChange={setPin} />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: canSubmit ? 1 : 0.5 }} onClick={submit} disabled={!canSubmit}>
          {busy ? "Aplicando…" : "Aplicar descuento"}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════ MergeModal ══

export function MergeModal({ open, target, onClose, onDone, onError }: {
  open: boolean; target: Comanda | null;
  onClose: () => void; onDone: (c: Comanda) => void; onError: (m: string) => void;
}) {
  const list = useActiveComandas(open, target?.id ?? -1);
  const [sourceId, setSourceId] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setSourceId(""); setReason(""); setPin(""); } }, [open]);

  // Solo cuentas sin pagos pueden juntarse (el endpoint lo exige).
  const candidates = (list ?? []).filter((c) => Number(c.amountPaid) === 0);
  const options = candidates.map((c) => ({ value: String(c.id), label: `${c.folio} · ${comandaLabel(c)} · ${formatMXN(Number(c.total))}` }));

  const submit = async () => {
    if (!target || !sourceId) return;
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${target.id}/merge`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceComandaId: Number(sourceId), authPin: pin, reason: reason.trim() || null }),
    });
    setBusy(false);
    if (r.ok) onDone(r.data!);
    else onError(r.error ?? "No se pudieron juntar las cuentas");
  };

  const canSubmit = !!sourceId && pin.length === 4 && !busy;

  return (
    <Modal open={open} title="Juntar cuentas" onClose={onClose}>
      <p style={{ margin: "0 0 4px", color: C.dim, fontSize: "0.86rem", lineHeight: 1.5 }}>
        Los productos de la cuenta origen se mueven a <b style={{ color: C.cream }}>{target?.folio}</b> (esta cuenta) y la origen se cierra.
      </p>
      <Field label="Cuenta origen (se vacía)">
        {list === null ? <Spinner label="Cargando cuentas…" /> : options.length === 0 ? (
          <div style={{ color: C.faint, fontSize: "0.82rem", padding: "8px 0" }}>No hay otras cuentas sin pagos para juntar.</div>
        ) : (
          <GoldSelect value={sourceId} onChange={setSourceId} options={options} placeholder="— Selecciona cuenta —" />
        )}
      </Field>
      <Field label="Motivo (opcional)">
        <input style={fld.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej. misma mesa, se unieron comensales" />
      </Field>
      <SupervisorPin value={pin} onChange={setPin} />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: canSubmit ? 1 : 0.5 }} onClick={submit} disabled={!canSubmit}>
          {busy ? "Juntando…" : "Juntar en esta cuenta"}
        </button>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════ TransferItemModal ══

export function TransferItemModal({ open, from, onClose, onDone, onError }: {
  open: boolean; from: Comanda | null;
  onClose: () => void; onDone: (c: Comanda) => void; onError: (m: string) => void;
}) {
  const list = useActiveComandas(open, from?.id ?? -1);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [toId, setToId] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const liveItems: CItem[] = useMemo(() => (from?.items ?? []).filter((i) => i.status !== "CANCELLED"), [from]);
  const selectedItem = liveItems.find((i) => String(i.id) === itemId) ?? null;

  useEffect(() => { if (open) { setItemId(""); setQty(1); setToId(""); setReason(""); setPin(""); } }, [open]);
  useEffect(() => { setQty(1); }, [itemId]);

  const itemOptions = liveItems.map((i) => ({ value: String(i.id), label: `${i.quantity}× ${i.dishNameSnapshot}` }));
  const targetOptions = (list ?? []).map((c) => ({ value: String(c.id), label: `${c.folio} · ${comandaLabel(c)}` }));
  const maxQty = selectedItem ? Number(selectedItem.quantity) : 1;

  const submit = async () => {
    if (!from || !selectedItem || !toId) return;
    setBusy(true);
    const r = await apiFetch<{ from: Comanda; to: Comanda }>(`/api/comandas/${from.id}/transfer-item`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toComandaId: Number(toId), itemId: selectedItem.id, quantity: qty, authPin: pin, reason: reason.trim() || null }),
    });
    setBusy(false);
    if (r.ok) onDone(r.data!.from);
    else onError(r.error ?? "No se pudo traspasar el producto");
  };

  const canSubmit = !!selectedItem && !!toId && qty >= 1 && qty <= maxQty && pin.length === 4 && !busy;

  return (
    <Modal open={open} title="Traspasar producto" onClose={onClose}>
      <Field label="Producto a mover">
        {itemOptions.length === 0 ? (
          <div style={{ color: C.faint, fontSize: "0.82rem", padding: "8px 0" }}>Sin productos para traspasar.</div>
        ) : (
          <GoldSelect value={itemId} onChange={setItemId} options={itemOptions} placeholder="— Selecciona producto —" />
        )}
      </Field>
      {selectedItem && maxQty > 1 && (
        <Field label={`Cantidad (de ${maxQty})`}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={stepper} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span style={{ color: C.cream, fontWeight: 800, fontSize: "1.2rem", minWidth: 36, textAlign: "center" }}>{qty}</span>
            <button style={stepper} onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>+</button>
          </div>
        </Field>
      )}
      <Field label="Cuenta destino">
        {list === null ? <Spinner label="Cargando cuentas…" /> : targetOptions.length === 0 ? (
          <div style={{ color: C.faint, fontSize: "0.82rem", padding: "8px 0" }}>No hay otra cuenta activa.</div>
        ) : (
          <GoldSelect value={toId} onChange={setToId} options={targetOptions} placeholder="— Selecciona destino —" />
        )}
      </Field>
      <Field label="Motivo (opcional)">
        <input style={fld.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej. se cambió de mesa" />
      </Field>
      <SupervisorPin value={pin} onChange={setPin} />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: canSubmit ? 1 : 0.5 }} onClick={submit} disabled={!canSubmit}>
          {busy ? "Traspasando…" : "Traspasar"}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════ ReopenModal ══

export function ReopenModal({ open, comanda, onClose, onDone, onError }: {
  open: boolean; comanda: Comanda | null;
  onClose: () => void; onDone: (c: Comanda) => void; onError: (m: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [voidPayments, setVoidPayments] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setReason(""); setPin(""); setVoidPayments(true); } }, [open]);

  const submit = async () => {
    if (!comanda) return;
    setBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${comanda.id}/reopen`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim(), authPin: pin, voidPayments }),
    });
    setBusy(false);
    if (r.ok) onDone(r.data!);
    else onError(r.error ?? "No se pudo reabrir la cuenta");
  };

  const canSubmit = reason.trim().length > 0 && pin.length === 4 && !busy;

  return (
    <Modal open={open} title="Reabrir cuenta" onClose={onClose}>
      <p style={{ margin: "0 0 4px", color: C.dim, fontSize: "0.86rem", lineHeight: 1.5 }}>
        La cuenta <b style={{ color: C.cream }}>{comanda?.folio}</b> volverá a «Por cobrar».
      </p>
      <Field label="¿Qué pasa con los pagos ya registrados?">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={radioRow}>
            <input type="radio" checked={voidPayments} onChange={() => setVoidPayments(true)} />
            <span><b style={{ color: C.cream }}>Anular pagos</b><br /><span style={{ color: C.faint, fontSize: "0.78rem" }}>Revierte del corte y deja el saldo en cero (corrección de cobro).</span></span>
          </label>
          <label style={radioRow}>
            <input type="radio" checked={!voidPayments} onChange={() => setVoidPayments(false)} />
            <span><b style={{ color: C.cream }}>Conservar pagos</b><br /><span style={{ color: C.faint, fontSize: "0.78rem" }}>Solo agregar/ajustar productos sin tocar el dinero cobrado.</span></span>
          </label>
        </div>
      </Field>
      <Field label="Motivo (obligatorio)">
        <input style={fld.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej. faltó cobrar un postre" />
      </Field>
      <SupervisorPin value={pin} onChange={setPin} />
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.danger, opacity: canSubmit ? 1 : 0.5 }} onClick={submit} disabled={!canSubmit}>
          {busy ? "Reabriendo…" : "Reabrir cuenta"}
        </button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────── styles ──

const bar: Record<string, React.CSSProperties> = {
  root: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: "10px 14px", maxWidth: 1200, margin: "12px auto 0", width: "100%", boxSizing: "border-box",
  },
};

const mon: Record<string, React.CSSProperties> = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 },
  kpi: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px" },
  head: { padding: "12px 18px", borderBottom: `1px solid ${C.line}`, color: C.faint, fontSize: "0.66rem", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: `1px solid ${C.line}` },
};

const pill: Record<string, React.CSSProperties> = {
  remove: { padding: "4px 10px", borderRadius: 7, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontSize: "0.7rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};

const stepper: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 9, border: `1px solid ${C.line}`,
  background: "transparent", color: C.cream, fontSize: "1.3rem", cursor: "pointer",
};

const radioRow: React.CSSProperties = {
  display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px",
  border: `1px solid ${C.line}`, borderRadius: 10, cursor: "pointer",
};
