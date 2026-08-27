"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { C, Spinner, EmptyState, Badge, formatMXN, useToasts, ToastHost, useStaffLogout } from "@/components/staff/ui";
import { StaffShell } from "@/components/staff/StaffShell";
import { apiFetch } from "@/components/staff/types";
import type { CashSession } from "@/components/staff/types";

const MX_TZ = "America/Mexico_City";
function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
function fmtHour(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
const METHOD_LABEL: Record<string, string> = { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", OTHER: "Otro" };

interface HistItem { id: number; quantity: number | string; dishNameSnapshot: string; unitPriceSnapshot: number | string; lineTotal: number | string; discountAmount: number | string }
interface HistPayment { method: string; amount: number | string; tip: number | string }
interface HistComanda {
  id: number; folio: string; customName: string | null; guestsActual: number | null;
  subtotal: number | string; taxAmount: number | string; discountTotal: number | string; total: number | string; tipTotal: number | string; amountPaid: number | string;
  openedAt: string; closedAt: string | null; reopenCount: number;
  table: { number: number; section: { name: string } } | null;
  waiter: { fullName: string } | null;
  items: HistItem[];
  payments: HistPayment[];
}

/** #13 Historial de mesas — cuentas PAID por turno, con productos. SOLO LECTURA. */
export default function CuentasHistorialPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [sessions, setSessions] = useState<CashSession[] | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [comandas, setComandas] = useState<HistComanda[] | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const allowed = staff && ["OPERATION", "CAPTAIN", "MANAGER"].includes(staff.role);

  const loadSessions = useCallback(async () => {
    const r = await apiFetch<CashSession[]>("/api/caja/sessions");
    if (r.ok) {
      setSessions(r.data!);
      setSessionId((prev) => prev ?? (r.data!.length ? r.data![0].id : null));
    } else { setSessions([]); push(r.error ?? "Error al cargar turnos", "error"); }
  }, [push]);

  const loadComandas = useCallback(async (sid: number) => {
    setComandas(null);
    const r = await apiFetch<HistComanda[]>(`/api/caja/sessions/${sid}/comandas`);
    if (r.ok) setComandas(r.data!);
    else { setComandas([]); push(r.error ?? "Error al cargar cuentas", "error"); }
  }, [push]);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/cuentas"); return; }
    if (staff && !allowed) { router.replace("/staff/login"); return; }
    if (staff && allowed) loadSessions();
  }, [loading, staff, allowed, router, loadSessions]);

  useEffect(() => { if (sessionId != null) loadComandas(sessionId); }, [sessionId, loadComandas]);

  const toggle = (id: number) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const totals = useMemo(() => {
    if (!comandas) return null;
    const ventas = comandas.reduce((s, c) => s + Number(c.total), 0);
    const propinas = comandas.reduce((s, c) => s + Number(c.tipTotal), 0);
    const desc = comandas.reduce((s, c) => s + Number(c.discountTotal), 0);
    return { ventas, propinas, desc, n: comandas.length };
  }, [comandas]);

  if (loading || !staff || !allowed) return <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><Spinner /></div>;

  const curSession = sessions?.find((s) => s.id === sessionId) ?? null;

  return (
    <>
      <StaffShell active="cuentas" onRefresh={() => sessionId != null && loadComandas(sessionId)} onLogout={logout} userName={staff.fullName} role={staff.role} maxWidth={1000}>
        <div style={hi.head}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={hi.h1}>Historial de mesas</h1>
            {totals && <span style={hi.sub}>{totals.n} {totals.n === 1 ? "cuenta pagada" : "cuentas pagadas"}</span>}
          </div>
        </div>

        {/* Selector de turno */}
        <div style={{ marginBottom: 14 }}>
          <label style={hi.lbl}>Turno</label>
          {sessions === null ? <Spinner /> : sessions.length === 0 ? (
            <div style={{ color: C.faint, fontSize: "0.82rem" }}>No hay turnos registrados.</div>
          ) : (
            <select value={sessionId ?? ""} onChange={(e) => setSessionId(Number(e.target.value))} style={hi.select}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.folio} · {s.shift ?? "turno"} · {fmtTime(s.openedAt)}{s.status === "OPEN" ? " · ABIERTO" : ` – ${fmtHour(s.closedAt)}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {curSession && totals && (
          <div style={hi.summary}>
            <SummaryCell label="Ventas del turno" value={formatMXN(totals.ventas)} />
            <SummaryCell label="Propinas" value={formatMXN(totals.propinas)} />
            <SummaryCell label="Descuentos" value={formatMXN(totals.desc)} />
          </div>
        )}

        {comandas === null ? <Spinner /> :
        comandas.length === 0 ? <EmptyState text="No hay cuentas pagadas en este turno." /> : (
          <div style={hi.list}>
            {comandas.map((c) => {
              const label = c.table ? `Mesa ${c.table.number} · ${c.table.section.name}` : (c.customName || "Cuenta sin mesa");
              const isOpen = expanded.has(c.id);
              return (
                <div key={c.id} style={hi.card}>
                  <button style={hi.cardHead} onClick={() => toggle(c.id)} aria-expanded={isOpen}>
                    <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ color: C.cream, fontWeight: 700 }}>{label}</span>
                        <Badge text={`FOLIO ${c.folio}`} color={C.dim} />
                        {c.reopenCount > 0 && <Badge text="REABIERTA" color="#e09632" />}
                        {Number(c.discountTotal) > 0.005 && <Badge text="CON DESCUENTO" color="#63aede" />}
                      </div>
                      <div style={{ color: C.dim, fontSize: "0.8rem", marginTop: 3 }}>
                        {fmtHour(c.closedAt)} · {c.waiter?.fullName ?? "—"} · {c.guestsActual ?? 1} pers
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.02rem" }}>{formatMXN(Number(c.total))}</div>
                      <div style={{ color: C.faint, fontSize: "0.72rem" }}>{isOpen ? "ocultar" : "ver productos"}</div>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={hi.body}>
                      {c.items.length === 0 ? (
                        <div style={{ color: C.faint, fontSize: "0.8rem", padding: "6px 0" }}>Sin productos activos.</div>
                      ) : c.items.map((it) => (
                        <div key={it.id} style={hi.line}>
                          <span style={{ color: C.dim, minWidth: 34 }}>{fmtQty(Number(it.quantity))}×</span>
                          <span style={{ color: C.cream, flex: 1, minWidth: 0 }}>{it.dishNameSnapshot}</span>
                          {Number(it.discountAmount) > 0.005 && <span style={{ color: "#63aede", fontSize: "0.74rem" }}>-{formatMXN(Number(it.discountAmount))}</span>}
                          <span style={{ color: C.cream }}>{formatMXN(Number(it.lineTotal) - Number(it.discountAmount))}</span>
                        </div>
                      ))}
                      <div style={hi.totRow}>
                        {Number(c.discountTotal) > 0.005 && <Row k="Descuento a la cuenta" v={"-" + formatMXN(Number(c.discountTotal))} dim />}
                        <Row k="Subtotal" v={formatMXN(Number(c.subtotal))} dim />
                        {Number(c.taxAmount) > 0 && <Row k="IVA" v={formatMXN(Number(c.taxAmount))} dim />}
                        <Row k="Total" v={formatMXN(Number(c.total))} strong />
                        {Number(c.tipTotal) > 0 && <Row k="Propina" v={formatMXN(Number(c.tipTotal))} dim />}
                        <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 6 }}>
                          Pago: {c.payments.length === 0 ? "—" : c.payments.map((p) => `${METHOD_LABEL[p.method] ?? p.method} ${formatMXN(Number(p.amount))}`).join(" · ")}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </StaffShell>
      <ToastHost toasts={toasts} onClose={dismiss} />
    </>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ color: C.faint, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ color: C.cream, fontWeight: 800, fontSize: "1.05rem", marginTop: 2 }}>{value}</div>
    </div>
  );
}
function Row({ k, v, dim, strong }: { k: string; v: string; dim?: boolean; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
      <span style={{ color: dim ? C.dim : C.cream, fontSize: strong ? "0.92rem" : "0.82rem", fontWeight: strong ? 800 : 400 }}>{k}</span>
      <span style={{ color: strong ? C.cream : C.dim, fontSize: strong ? "0.92rem" : "0.82rem", fontWeight: strong ? 800 : 400 }}>{v}</span>
    </div>
  );
}

const hi: Record<string, React.CSSProperties> = {
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "8px 0 16px" },
  h1: { margin: 0, fontSize: "1.15rem", fontWeight: 800, color: C.cream, letterSpacing: "0.01em" },
  sub: { fontSize: "0.8rem", color: C.faint },
  lbl: { display: "block", color: C.faint, fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 },
  select: { width: "100%", maxWidth: 520, padding: "10px 12px", borderRadius: 10, background: C.panel, border: `1px solid ${C.border}`, color: C.cream, fontFamily: "inherit", fontSize: "0.86rem" },
  summary: { display: "flex", gap: 16, flexWrap: "wrap", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 16px", width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" },
  body: { borderTop: `1px solid ${C.border}`, padding: "12px 16px", background: "rgba(0,0,0,0.12)" },
  line: { display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontSize: "0.86rem" },
  totRow: { borderTop: `1px dashed ${C.border}`, marginTop: 8, paddingTop: 8 },
};
