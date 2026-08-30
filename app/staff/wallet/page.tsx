"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { C, StaffHeader, Spinner, EmptyState, useStaffLogout, formatMXN, usePoll } from "@/components/staff/ui";
import { apiFetch } from "@/components/staff/types";

interface Credit { id: number; amount: number; status: string; note: string | null; folio: string | null; createdAt: string; paidAt: string | null }
interface CashTip { id: number; amount: number; note: string | null; createdAt: string }
interface Tips { registered: number; cash: number; total: number; salesToday: number; pointPercent: number; puntos: number; neto: number; cashList: CashTip[] }
interface Wallet { pending: number; credits: Credit[]; tips: Tips }
// #4 Cuentas (para llevar) ligadas a este empleado, esperando su aprobación.
interface ChargeItem { id: number; quantity: number | string; dishNameSnapshot: string; lineTotal: number | string }
interface Charge { id: number; folio: string; customName: string | null; total: number | string; openedAt: string; employeeChargeStatus: "PENDING" | "APPROVED"; openedBy: { fullName: string } | null; items: ChargeItem[] }

/** Wallet del empleado: propinas de hoy (caja + efectivo propio) y saldo a crédito. */
export default function WalletPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const [w, setW] = useState<Wallet | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState("");
  const [tipNote, setTipNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [charges, setCharges] = useState<Charge[]>([]); // #4 cuentas por aprobar/aprobadas
  const [approveId, setApproveId] = useState<number | null>(null); // tarjeta con PIN abierto
  const [approvePin, setApprovePin] = useState("");
  const [approveErr, setApproveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, ch] = await Promise.all([
      apiFetch<Wallet>("/api/staff/wallet"),
      apiFetch<Charge[]>("/api/staff/employee-charges"),
    ]);
    if (r.ok) setW(r.data!);
    if (ch.ok) setCharges(ch.data ?? []);
  }, []);

  const approve = async (id: number) => {
    if (approvePin.length !== 4 || busy) return;
    setBusy(true); setApproveErr(null);
    const r = await apiFetch<unknown>(`/api/comandas/${id}/employee-approve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: approvePin }),
    });
    setBusy(false);
    if (r.ok) { setApproveId(null); setApprovePin(""); load(); }
    else setApproveErr(r.error ?? "No se pudo aprobar");
  };

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/wallet"); return; }
    if (staff) load();
  }, [loading, staff, router, load]);

  usePoll(load, 15000, !!staff); // se actualiza en vivo conforme caja registra propinas

  const addCashTip = async () => {
    const a = Number(tipAmount);
    if (!(a > 0) || busy) return;
    setBusy(true);
    const r = await apiFetch("/api/staff/wallet/cash-tip", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: a, note: tipNote.trim() || null }),
    });
    setBusy(false);
    if (r.ok) { setTipOpen(false); setTipAmount(""); setTipNote(""); load(); }
  };

  if (loading || !w) return <div style={{ minHeight: "100vh", background: C.bg }}><Spinner /></div>;

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <StaffHeader title="Mi cartera" role={staff?.role} userName={staff?.fullName} onLogout={logout} onBack={() => router.back()} />
      <main style={{ padding: 18, maxWidth: 640, margin: "0 auto", paddingBottom: 60 }}>

        {/* #4 Cuentas por aprobar: cuentas para llevar que caja ligó a este empleado. Debe
            palomearlas con su PIN antes de que caja pueda cobrarlas a su crédito. */}
        {charges.length > 0 && (
          <div style={{ background: "rgba(90,160,110,0.08)", border: "1px solid rgba(90,160,110,0.5)", borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ color: C.green, fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, marginBottom: 10 }}>Cuentas por aprobar · {charges.filter((c) => c.employeeChargeStatus === "PENDING").length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {charges.map((c) => {
                const approved = c.employeeChargeStatus === "APPROVED";
                return (
                  <div key={c.id} style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: C.cream, fontWeight: 700, fontSize: "0.9rem" }}>{c.customName || `Cuenta ${c.folio}`}</div>
                        <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 2 }}>{fmtTime(c.openedAt)}{c.openedBy ? ` · abrió ${c.openedBy.fullName}` : ""}</div>
                      </div>
                      <div style={{ color: C.cream, fontWeight: 800 }}>{formatMXN(Number(c.total))}</div>
                    </div>
                    <div style={{ marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                      {c.items.map((it) => (
                        <div key={it.id} style={{ display: "flex", gap: 8, fontSize: "0.8rem" }}>
                          <span style={{ color: C.faint, minWidth: 28 }}>{Number(it.quantity)}×</span>
                          <span style={{ color: C.dim, flex: 1, minWidth: 0 }}>{it.dishNameSnapshot}</span>
                          <span style={{ color: C.dim }}>{formatMXN(Number(it.lineTotal))}</span>
                        </div>
                      ))}
                    </div>
                    {approved ? (
                      <div style={{ marginTop: 10, color: C.green, fontWeight: 700, fontSize: "0.82rem" }}>✓ Aprobada · esperando que caja la cobre a tu crédito</div>
                    ) : approveId === c.id ? (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ color: C.faint, fontSize: "0.74rem" }}>Teclea tu PIN para aceptar este cargo a tu crédito.</div>
                        <input type="password" inputMode="numeric" maxLength={4} autoFocus value={approvePin}
                          onChange={(e) => setApprovePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          placeholder="PIN de 4 dígitos" style={inp} />
                        {approveErr && <div style={{ color: C.amber, fontSize: "0.78rem" }}>{approveErr}</div>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => approve(c.id)} disabled={approvePin.length !== 4 || busy} style={{ ...btnPrimary, background: C.green, opacity: approvePin.length === 4 && !busy ? 1 : 0.5 }}>Aprobar</button>
                          <button onClick={() => { setApproveId(null); setApprovePin(""); setApproveErr(null); }} style={btnGhost2}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setApproveId(c.id); setApprovePin(""); setApproveErr(null); }} style={{ marginTop: 10, padding: "9px 14px", borderRadius: 9, border: "none", background: C.green, color: "var(--sl-bg)", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", width: "100%" }}>✓ Aprobar esta cuenta</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Propinas de hoy */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 20px", marginBottom: 16 }}>
          <div style={{ color: C.faint, fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Tu neto de hoy (propinas − puntos)</div>
          <div style={{ color: w.tips.neto >= 0 ? C.gold : C.amber, fontWeight: 800, fontSize: "2rem", marginTop: 6 }}>{formatMXN(w.tips.neto)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10, color: C.dim, fontSize: "0.82rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>Propinas (caja {formatMXN(w.tips.registered)} + efectivo {formatMXN(w.tips.cash)})</span>
              <span style={{ color: C.cream, fontWeight: 700, whiteSpace: "nowrap" }}>{formatMXN(w.tips.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>Puntos ({w.tips.pointPercent}% de tu venta {formatMXN(w.tips.salesToday)})</span>
              <span style={{ color: C.amber, fontWeight: 700, whiteSpace: "nowrap" }}>−{formatMXN(w.tips.puntos)}</span>
            </div>
          </div>

          {!tipOpen ? (
            <button onClick={() => setTipOpen(true)} style={btnGhost}>+ Agregar propina en efectivo</button>
          ) : (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ color: C.faint, fontSize: "0.72rem" }}>Propina en efectivo que te quedas y NO declaras a caja (ej. el cambio que te dejan). Solo tu conteo.</div>
              <input inputMode="decimal" autoFocus value={tipAmount} onChange={(e) => setTipAmount(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Monto (ej. 50)" style={inp} />
              <input value={tipNote} onChange={(e) => setTipNote(e.target.value)} placeholder="Nota (opcional, ej. mesa 4)" maxLength={200} style={inp} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={addCashTip} disabled={!(Number(tipAmount) > 0) || busy} style={{ ...btnPrimary, opacity: Number(tipAmount) > 0 && !busy ? 1 : 0.5 }}>Guardar</button>
                <button onClick={() => { setTipOpen(false); setTipAmount(""); setTipNote(""); }} style={btnGhost2}>Cancelar</button>
              </div>
            </div>
          )}

          {w.tips.cashList.length > 0 && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {w.tips.cashList.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.8rem" }}>
                  <span style={{ color: C.faint, fontSize: "0.72rem", whiteSpace: "nowrap" }}>{fmtTime(t.createdAt)}</span>
                  <span style={{ color: C.cream, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.note ?? "Efectivo"}</span>
                  <span style={{ color: C.gold, fontWeight: 700 }}>{formatMXN(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Saldo a crédito */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", marginBottom: 18 }}>
          <div style={{ color: C.faint, fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Saldo pendiente por pagar</div>
          <div style={{ color: w.pending > 0 ? C.amber : C.green, fontWeight: 800, fontSize: "1.6rem", marginTop: 6 }}>{formatMXN(w.pending)}</div>
          <div style={{ color: C.dim, fontSize: "0.8rem", marginTop: 4 }}>
            {w.pending > 0 ? "Se descuenta de tu nómina o lo pagas en caja." : "Estás al corriente."}
          </div>
        </div>

        <div style={{ color: C.faint, fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, margin: "0 2px 10px" }}>Movimientos de crédito</div>
        {w.credits.length === 0 ? (
          <EmptyState text="Sin cuentas a crédito." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {w.credits.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.panel }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.cream, fontWeight: 700, fontSize: "0.9rem" }}>{c.folio ? `Cuenta ${c.folio}` : "Cargo a crédito"}</div>
                  <div style={{ color: C.faint, fontSize: "0.74rem", marginTop: 2 }}>{fmtDate(c.createdAt)}{c.note ? ` · ${c.note}` : ""}{c.paidAt ? ` · pagado ${fmtDate(c.paidAt)}` : ""}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ color: C.cream, fontWeight: 800 }}>{formatMXN(c.amount)}</div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, color: c.status === "PAID" ? C.green : C.amber }}>{c.status === "PAID" ? "Pagado" : "Pendiente"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "11px 12px", minHeight: 44, borderRadius: 9, boxSizing: "border-box", border: `1px solid ${C.border}`, background: C.bg, color: C.cream, fontSize: "0.9rem", fontFamily: "inherit" };
const btnGhost: React.CSSProperties = { marginTop: 14, padding: "10px 14px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
const btnGhost2: React.CSSProperties = { padding: "10px 16px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
const btnPrimary: React.CSSProperties = { flex: 1, padding: "10px 16px", borderRadius: 9, border: "none", background: C.gold, color: "var(--sl-on-accent)", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
