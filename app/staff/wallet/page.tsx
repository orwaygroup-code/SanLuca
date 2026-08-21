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

  const load = useCallback(async () => {
    const r = await apiFetch<Wallet>("/api/staff/wallet");
    if (r.ok) setW(r.data!);
  }, []);

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
const btnPrimary: React.CSSProperties = { flex: 1, padding: "10px 16px", borderRadius: 9, border: "none", background: C.gold, color: "#16201f", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
