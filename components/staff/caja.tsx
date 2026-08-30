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
  WAITER_CREDIT: "Crédito de personal",
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
function SupervisorPin({ value, onChange, label = "PIN de Capitán/Manager (autoriza)" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Field label={label}>
      <PinInput value={value} onChange={onChange} />
      <div style={{ color: C.faint, fontSize: "0.72rem", marginTop: 6 }}>
        Se teclea el PIN de 4 dígitos para autorizar. Queda en la auditoría.
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
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setOpeningFloat(""); setNotes(""); setPin(""); } }, [open]);

  const submit = async () => {
    setBusy(true);
    // #1: al abrir turno también se abre el cajón (para meter el fondo). El endpoint encola
    // el DRAWER_KICK; aquí solo mandamos PIN + fondo.
    const r = await apiFetch<CashSession>("/api/caja/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat: num(openingFloat), notes: notes.trim() || null, authPin: pin }),
    });
    setBusy(false);
    if (r.ok) onOpened(r.data!);
    else onError(r.error ?? "No se pudo abrir el turno");
  };

  const canSubmit = pin.length === 4 && num(openingFloat) >= 0 && openingFloat.trim() !== "" && !busy;

  return (
    <Modal open={open} title="Iniciar turno" onClose={onClose}>
      <p style={{ margin: "0 0 4px", color: C.dim, fontSize: "0.86rem", lineHeight: 1.5 }}>
        Teclea tu PIN, cuenta el efectivo con el que arranca la caja (fondo inicial) y el cajón se
        abrirá para meterlo. Solo puede haber un turno abierto a la vez.
      </p>
      <SupervisorPin value={pin} onChange={setPin} label="Tu PIN de caja (Operación/Capitán/Manager)" />
      <Field label="Fondo inicial (efectivo en cajón)">
        <MoneyInput value={openingFloat} onChange={setOpeningFloat} />
      </Field>
      <Field label="Notas (opcional)">
        <input style={fld.input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ej. turno de la tarde, cajón 1" />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button style={btn.ghost} onClick={onClose} disabled={busy}>Cancelar</button>
        <button style={{ ...btn.primary, opacity: canSubmit ? 1 : 0.6 }} onClick={submit} disabled={!canSubmit}>
          {busy ? "Iniciando…" : "Iniciar turno y abrir cajón"}
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
          <button style={btn.primary} onClick={onOpenTurno}>Iniciar turno</button>
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
  const [excludeTip, setExcludeTip] = useState(false);
  const [excludeTipPin, setExcludeTipPin] = useState("");
  // Cobrar por CRÉDITO DE PERSONAL (desplegable): elegir empleado → confirmar en caja (PIN) o en tablet.
  const [scOpen, setScOpen] = useState(false);
  const [scEmp, setScEmp] = useState<number | null>(null);
  const [scSearch, setScSearch] = useState("");
  const [scPinMode, setScPinMode] = useState(false); // true = mostrando el input de PIN (confirmar en caja)
  const [scPin, setScPin] = useState("");
  const [scBusy, setScBusy] = useState(false);
  const [scSent, setScSent] = useState<string | null>(null); // nombre del empleado al que se le mandó a la tablet
  // #4 Cuenta YA LIGADA a un empleado: su NIP tecleado aquí mismo, en caja.
  const [empApprovePin, setEmpApprovePin] = useState("");

  useEffect(() => {
    if (!open || comandaId == null) { setComanda(null); setLoadErr(null); return; }
    setComanda(null); setLoadErr(null); setCreditWaiterId(""); setCreditPin(""); setExcludeTip(false); setExcludeTipPin("");
    setScOpen(false); setScEmp(null); setScPinMode(false); setScPin(""); setScSent(null); setScSearch("");
    apiFetch<{ id: number; fullName: string; role: string }[]>("/api/comandas/credit-staff").then((r) => { if (r.ok) setWaiters(r.data ?? []); });
    apiFetch<Comanda>(`/api/comandas/${comandaId}`).then((r) => {
      if (r.ok) {
        const c = r.data!;
        setComanda(c);
        if (c.chargedEmployeeId) setCreditWaiterId(String(c.chargedEmployeeId)); // #4 autoselecciona empleado ligado
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
  // #4 Cuenta ligada a empleado: el crédito va a ese empleado y su aprobación (en cartera)
  // reemplaza al PIN aquí. Si aún no la aprueba, no se puede cobrar a crédito.
  const linkedEmp = comanda?.chargedEmployeeId ?? null;
  const isLinkedApproved = linkedEmp != null && comanda?.employeeChargeStatus === "APPROVED";
  const creditReady = !hasCredit
    ? true
    : linkedEmp != null
    ? isLinkedApproved && Number(creditWaiterId) === linkedEmp
    : Number(creditWaiterId) > 0 && /^\d{4}$/.test(creditPin);
  const tipReady = !excludeTip || /^\d{4}$/.test(excludeTipPin);
  const canSubmit = !!comanda && coveredNow > 0 && creditReady && tipReady && !busy;

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
      body: JSON.stringify({ payments, ...(hasCredit ? { creditWaiterId: Number(creditWaiterId), creditWaiterPin: creditPin } : {}), ...(excludeTip ? { excludeTipPoint: true, tipPin: excludeTipPin } : {}) }),
    });
    setBusy(false);
    if (r.ok) onPaid(r.data!);
    else onError(r.error ?? "No se pudo cobrar");
  };

  // Cobrar TODO el saldo al crédito de personal del empleado, confirmando con su PIN aquí en caja.
  const payStaffCredit = async () => {
    if (!comanda || scEmp == null || scPin.length !== 4) return;
    setScBusy(true);
    const r = await apiFetch<PayResult>(`/api/comandas/${comanda.id}/pay`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payments: [{ method: "WAITER_CREDIT", amount: remaining, tip: 0, reference: "Crédito de personal" }], creditWaiterId: scEmp, creditWaiterPin: scPin }),
    });
    setScBusy(false);
    if (r.ok) onPaid(r.data!);
    else onError(r.error ?? "No se pudo cobrar a crédito");
  };

  // #1 Descuento de empleado, automático. Al elegir a la persona se aplica el
  // porcentaje configurado en Ajustes, de modo que el saldo que se cobra en
  // caja —y el que se manda a su tablet— ya venga descontado. Antes había que
  // aplicarlo a mano desde el modal de descuentos y se olvidaba.
  const pickStaffCreditEmployee = async (employeeId: number) => {
    setScEmp(employeeId); setScPinMode(false); setScPin(""); setScSearch("");
    if (!comanda) return;
    setScBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${comanda.id}/employee-discount`, { method: "POST" });
    setScBusy(false);
    if (r.ok && r.data) setComanda(r.data);
    else if (r.error) onError(r.error);
  };

  // Al cambiar de empleado o cerrar el desplegable se retira el descuento: si
  // la cuenta termina cobrándose por otra vía, no debe quedarse con él puesto.
  const clearStaffCreditEmployee = async () => {
    setScEmp(null); setScPinMode(false); setScPin("");
    if (!comanda) return;
    setScBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${comanda.id}/employee-discount`, { method: "DELETE" });
    setScBusy(false);
    if (r.ok && r.data) setComanda(r.data);
  };

  // #4 Aprobar EN CAJA una cuenta ya ligada. El endpoint employee-approve
  // siempre soportó este caso —valida el PIN del empleado ligado, venga de su
  // Cartera o de la terminal— pero sólo lo llamaba la pantalla del empleado.
  // Sin esto, ligar una cuenta la dejaba imposible de cobrar hasta que la
  // persona abriera su app: si estaba parada frente a la caja, no había vía.
  const approveLinkedEmployee = async () => {
    if (!comanda) return;
    setScBusy(true);
    const r = await apiFetch<Comanda>(`/api/comandas/${comanda.id}/employee-approve`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: empApprovePin }),
    });
    setScBusy(false);
    if (r.ok && r.data) { setComanda(r.data); setEmpApprovePin(""); }
    else onError(r.error ?? "No se pudo aprobar la cuenta");
  };

  // Mandar la confirmación a la TABLET del empleado. La cuenta queda pendiente hasta que confirme.
  const requestStaffCredit = async () => {
    if (!comanda || scEmp == null) return;
    setScBusy(true);
    const r = await apiFetch<{ employee: string }>(`/api/comandas/${comanda.id}/staff-credit/request`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: scEmp }),
    });
    setScBusy(false);
    if (r.ok) setScSent(r.data?.employee ?? "el empleado");
    else onError(r.error ?? "No se pudo enviar la confirmación");
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
            {Number(comanda.discountTotal) > 0 && (
              <div style={{ ...kv, color: C.green, fontSize: "0.78rem" }}>
                <span>Descuento aplicado</span><span>−{formatMXN(Number(comanda.discountTotal))}</span>
              </div>
            )}
            {paidBefore > 0 && <div style={{ ...kv, color: C.faint, fontSize: "0.78rem" }}><span>Pagado antes</span><span>{formatMXN(paidBefore)}</span></div>}
            <div style={{ ...kv, color: C.cream, fontWeight: 800 }}><span>Saldo por cobrar</span><span>{formatMXN(remaining)}</span></div>
          </div>

          {/* #4 Cuenta LIGADA a un empleado. /pay la rechaza mientras no esté
              APPROVED, y hasta ahora la única forma de aprobarla era que la
              persona entrara a su app: si estaba parada frente a la caja, la
              cuenta no se podía cerrar por ninguna vía. */}
          {comanda.chargedEmployeeId != null && (
            <div style={{ marginTop: 12, border: `1px solid ${comanda.employeeChargeStatus === "APPROVED" ? C.green : C.gold}`, borderRadius: 12, padding: "12px 14px" }}>
              {comanda.employeeChargeStatus === "APPROVED" ? (
                <div style={{ color: C.green, fontSize: "0.86rem", lineHeight: 1.5 }}>
                  Ligada a <b>{comanda.chargedEmployee?.fullName ?? "un empleado"}</b> · aprobada. Ya se puede cobrar a crédito.
                </div>
              ) : (
                <div>
                  <div style={{ color: C.cream, fontSize: "0.86rem", lineHeight: 1.5 }}>
                    Ligada a <b>{comanda.chargedEmployee?.fullName ?? "un empleado"}</b>. Debe aprobarla con su NIP —aquí en caja o desde su app— antes de cobrarla.
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={fld.label}>NIP de {comanda.chargedEmployee?.fullName ?? "el empleado"}</label>
                    <PinInput value={empApprovePin} onChange={setEmpApprovePin} />
                    <button
                      onClick={approveLinkedEmployee}
                      disabled={scBusy || empApprovePin.length !== 4}
                      style={{ ...btn.primary, width: "100%", marginTop: 10, opacity: empApprovePin.length === 4 && !scBusy ? 1 : 0.5 }}
                    >
                      {scBusy ? "Aprobando…" : "Aprobar en caja"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Cobrar por CRÉDITO DE PERSONAL (todo el saldo a un empleado). Flecha que despliega. */}
          <div style={{ marginTop: 12, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
            <button onClick={() => setScOpen((v) => !v)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", background: "transparent", border: "none", color: C.cream, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "0.9rem" }}>
              <span>Cobrar por crédito de personal</span>
              <span style={{ color: C.gold, display: "inline-block", transform: scOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span>
            </button>
            {scOpen && (
              <div style={{ padding: "0 14px 14px" }}>
                {scSent ? (
                  <div>
                    <div style={{ color: C.green, fontSize: "0.88rem", lineHeight: 1.5 }}>Confirmación enviada a <b>{scSent}</b>. La cuenta queda <b>pendiente</b> hasta que confirme en su tablet.</div>
                    <button style={{ ...btn.primary, marginTop: 12, width: "100%" }} onClick={onClose}>Listo</button>
                  </div>
                ) : scEmp == null ? (
                  <div>
                    <input
                      value={scSearch}
                      onChange={(e) => setScSearch(e.target.value)}
                      placeholder="Buscar persona…"
                      autoFocus
                      style={{ ...fld.input, width: "100%", boxSizing: "border-box" }}
                    />
                    <div style={{ marginTop: 8, maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                      {(() => {
                        const q = scSearch.trim().toLowerCase();
                        const groups = ([["Meseros", "WAITER"], ["Cocina", "KITCHEN"]] as const)
                          .map(([label, role]) => [label, waiters.filter((w) => w.role === role && (!q || w.fullName.toLowerCase().includes(q)))] as const)
                          .filter(([, list]) => list.length > 0);
                        if (groups.length === 0) return <div style={{ color: C.faint, fontSize: "0.82rem", padding: "8px 2px" }}>Sin coincidencias.</div>;
                        return groups.map(([label, list]) => (
                          <div key={label}>
                            <div style={{ color: C.faint, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, marginBottom: 5 }}>{label}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {list.map((w) => (
                                <button key={w.id} onClick={() => pickStaffCreditEmployee(w.id)}
                                  style={{ display: "block", width: "100%", textAlign: "left", background: "rgba(0,0,0,0.16)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px", color: C.cream, fontFamily: "inherit", fontSize: "0.86rem", cursor: "pointer" }}>
                                  {w.fullName}
                                </button>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ color: C.cream, fontWeight: 800 }}>{waiters.find((w) => w.id === scEmp)?.fullName ?? "Empleado"} · {formatMXN(remaining)}</span>
                      <button onClick={clearStaffCreditEmployee} style={{ background: "transparent", border: "none", color: C.gold, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>cambiar</button>
                    </div>
                    {!scPinMode ? (
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => setScPinMode(true)} disabled={scBusy} style={{ ...btn.primary, flex: 1, minHeight: 64, fontSize: "0.92rem" }}>Confirmar en caja</button>
                        <button onClick={requestStaffCredit} disabled={scBusy} style={{ ...btn.ghost, flex: 1, minHeight: 64, fontSize: "0.92rem", borderColor: C.gold, color: C.gold }}>{scBusy ? "Enviando…" : "Confirmar en tablet"}</button>
                      </div>
                    ) : (
                      <div>
                        <label style={fld.label}>PIN de {waiters.find((w) => w.id === scEmp)?.fullName ?? "el empleado"}</label>
                        <PinInput value={scPin} onChange={setScPin} />
                        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                          <button onClick={() => { setScPinMode(false); setScPin(""); }} disabled={scBusy} style={{ ...btn.ghost, flex: 1 }}>Atrás</button>
                          <button onClick={payStaffCredit} disabled={scBusy || scPin.length !== 4} style={{ ...btn.primary, flex: 1, opacity: scPin.length === 4 && !scBusy ? 1 : 0.5 }}>{scBusy ? "Cobrando…" : "Cobrar a crédito"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {hasCredit && linkedEmp != null && (
            // #4 Cuenta ligada: empleado fijo, sin picker ni PIN. La aprobación en cartera manda.
            <div style={{ border: `1px solid ${isLinkedApproved ? "#5aa06e" : "var(--sl-gold-soft)"}`, borderRadius: 12, padding: "12px 14px", marginTop: 12, background: "rgba(0,0,0,0.14)" }}>
              <div style={{ color: isLinkedApproved ? "#5aa06e" : "var(--sl-gold-soft)", fontWeight: 800, fontSize: "0.82rem", marginBottom: 6 }}>
                Crédito a empleado ligado · {comanda?.chargedEmployee?.fullName ?? "empleado"}
              </div>
              {isLinkedApproved ? (
                <div style={{ color: "#5aa06e", fontSize: "0.82rem" }}>✓ El empleado ya la aprobó en su cartera. No se requiere PIN aquí.</div>
              ) : (
                <div style={{ color: "var(--sl-gold-soft)", fontSize: "0.82rem" }}>Pendiente: el empleado debe palomearla en su cartera antes de cobrarla a crédito.</div>
              )}
            </div>
          )}
          {hasCredit && linkedEmp == null && (
            <div style={{ border: `1px solid ${C.gold}`, borderRadius: 12, padding: "12px 14px", marginTop: 12, background: "color-mix(in srgb, var(--sl-gold) 8%, transparent)" }}>
              <div style={{ color: C.gold, fontWeight: 800, fontSize: "0.82rem", marginBottom: 8 }}>Crédito de empleado · lo autoriza el empleado deudor con su PIN</div>
              <label style={fld.label}>Empleado al que se le carga</label>
              <GoldSelect
                value={creditWaiterId}
                onChange={setCreditWaiterId}
                options={[{ value: "", label: "Elige empleado…" }, ...waiters.map((w) => ({ value: String(w.id), label: w.fullName }))]}
              />
              <label style={{ ...fld.label, marginTop: 10 }}>PIN del empleado</label>
              <PinInput value={creditPin} onChange={setCreditPin} />
              <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 6 }}>Se le descuenta de su nómina. Queda como cuenta por cobrar.</div>
            </div>
          )}

          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", marginTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: C.cream, fontSize: "0.86rem", cursor: "pointer" }}>
              <input type="checkbox" checked={excludeTip} onChange={(e) => setExcludeTip(e.target.checked)} />
              No contar el punto (7%) al mesero
            </label>
            {excludeTip && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: C.faint, fontSize: "0.74rem", marginBottom: 8 }}>
                  Esta venta NO se sumará a la base del 7% del mesero. Autoriza con PIN de supervisor (queda registrado quién lo hizo).
                </div>
                <SupervisorPin value={excludeTipPin} onChange={setExcludeTipPin} />
              </div>
            )}
          </div>

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

export function DiscountModal({ open, comandaId, itemId, itemName, itemIds, onClose, onDone, onError }: {
  open: boolean; comandaId: number | null; itemId?: number | null; itemName?: string; itemIds?: number[];
  onClose: () => void; onDone: (c: Comanda) => void; onError: (m: string) => void;
}) {
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [empPct, setEmpPct] = useState(50); // #5 % de descuento a empleados (configurable en Ajustes)

  useEffect(() => { if (open) { setType("PERCENT"); setValue(""); setReason(""); setPin(""); } }, [open]);
  useEffect(() => {
    if (!open) return;
    apiFetch<{ employeeDiscountPercent?: number | string }>("/api/admin/settings").then((r) => {
      if (r.ok && r.data?.employeeDiscountPercent != null) setEmpPct(Number(r.data.employeeDiscountPercent));
    });
  }, [open]);

  const submit = async () => {
    if (comandaId == null) return;
    setBusy(true);
    const batch = itemIds != null && itemIds.length > 0;
    const path = batch
      ? `/api/comandas/${comandaId}/items/batch-discount`
      : itemId != null
      ? `/api/comandas/${comandaId}/items/${itemId}/discount`
      : `/api/comandas/${comandaId}/discount`;
    const r = await apiFetch<Comanda>(path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(batch ? { itemIds } : {}), type, value: num(value), reason: reason.trim(), authPin: pin }),
    });
    setBusy(false);
    if (r.ok) onDone(r.data!);
    else onError(r.error ?? "No se pudo aplicar el descuento");
  };

  const canSubmit = num(value) > 0 && reason.trim().length > 0 && pin.length === 4 && !busy;

  return (
    <Modal open={open} title={itemIds != null && itemIds.length > 0 ? `Descuento · ${itemIds.length} productos` : itemId != null ? `Descuento · ${itemName ?? "producto"}` : "Descuento a la cuenta"} onClose={onClose}>
      <Field label="Tipo de descuento">
        <div style={{ display: "flex", gap: 8 }}>
          {(["PERCENT", "FIXED"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{ ...btn.ghost, flex: 1, ...(type === t ? { background: C.gold, color: "var(--sl-on-accent)", borderColor: C.gold, fontWeight: 800 } : {}) }}
            >{t === "PERCENT" ? "Porcentaje %" : "Monto fijo $"}</button>
          ))}
        </div>
      </Field>
      <Field label={type === "PERCENT" ? "Porcentaje (ej. 10 = 10%)" : "Monto en pesos"}>
        <MoneyInput value={value} onChange={setValue} autoFocus />
      </Field>
      {/* Atajos de % para el descuento A LA CUENTA (no por producto): 50% (empleado) y 100%
          (matar/cortesía). El 100% deja la cuenta en $0 → luego se cierra con "Cerrar en $0". */}
      {type === "PERCENT" && itemId == null && (itemIds == null || itemIds.length === 0) && (
        <div style={{ display: "flex", gap: 8, marginTop: -6, marginBottom: 6 }}>
          <button onClick={() => setValue(String(empPct))} style={{ ...btn.ghost, flex: 1, padding: "8px 10px", fontSize: "0.82rem", ...(value === String(empPct) ? { borderColor: C.gold, color: C.gold } : {}) }}>{empPct}% empleado</button>
          <button onClick={() => setValue("100")} style={{ ...btn.ghost, flex: 1, padding: "8px 10px", fontSize: "0.82rem", ...(value === "100" ? { borderColor: C.gold, color: C.gold, fontWeight: 800 } : {}) }}>100% matar cuenta</button>
        </div>
      )}
      <Field label="Motivo (obligatorio)">
        <input style={fld.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej. cortesía, queja de servicio" />
      </Field>
      <SupervisorPin value={pin} onChange={setPin} label="PIN de Operación/Capitán/Manager (autoriza)" />
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

export function TransferItemModal({ open, from, itemIds, onClose, onDone, onError }: {
  open: boolean; from: Comanda | null; itemIds?: number[];
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

  const batch = itemIds != null && itemIds.length > 0;
  const submit = async () => {
    if (!from || !toId || (!batch && !selectedItem)) return;
    setBusy(true);
    const r = batch
      ? await apiFetch<{ from: Comanda; to: Comanda }>(`/api/comandas/${from.id}/transfer-items`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toComandaId: Number(toId), itemIds, authPin: pin, reason: reason.trim() || null }),
        })
      : await apiFetch<{ from: Comanda; to: Comanda }>(`/api/comandas/${from.id}/transfer-item`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toComandaId: Number(toId), itemId: selectedItem!.id, quantity: qty, authPin: pin, reason: reason.trim() || null }),
        });
    setBusy(false);
    if (r.ok) onDone(r.data!.from);
    else onError(r.error ?? "No se pudo traspasar el producto");
  };

  const canSubmit = !!toId && pin.length === 4 && !busy && (batch || (!!selectedItem && qty >= 1 && qty <= maxQty));

  return (
    <Modal open={open} title={batch ? "Traspasar productos" : "Traspasar producto"} onClose={onClose}>
      {batch ? (
        <div style={{ color: C.dim, fontSize: "0.88rem", marginBottom: 12 }}>
          Se moverán <b style={{ color: C.cream }}>{itemIds!.length} producto(s)</b> completos a la cuenta destino.
        </div>
      ) : (
        <>
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
        </>
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
