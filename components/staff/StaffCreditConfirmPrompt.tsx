"use client";

import { useCallback, useEffect, useState } from "react";
import { useStaffSession } from "@/lib/staff-session-client";

interface Charge {
  id: number;
  folio: string;
  customName: string | null;
  total: number | string;
  table: { number: number } | null;
  employeeChargeStatus: string;
  status: string;
}

const C = {
  bg: "var(--sl-bg)",
  panel: "var(--sl-panel)",
  gold: "var(--sl-gold)",
  cream: "var(--sl-cream)",
  dim: "var(--sl-dim)",
  faint: "var(--sl-faint)",
  border: "var(--sl-border)",
  line: "var(--sl-line)",
  green: "var(--sl-green)",
  red: "var(--sl-red)",
};

/**
 * Aviso global en la tablet del empleado: si tiene una cuenta LIGADA a su nombre
 * pendiente de aprobar y YA IMPRESA (AWAITING_PAYMENT), aparece este modal (venga o
 * no el push). Mete su PIN y la cuenta se aprueba y se salda a su crédito de personal.
 * Se monta en el layout raíz; para cualquier empleado logueado.
 */
export function StaffCreditConfirmPrompt() {
  const { staff, loading } = useStaffSession();
  const [items, setItems] = useState<Charge[]>([]);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/staff/employee-charges", { credentials: "same-origin" });
      const d = await r.json().catch(() => null);
      if (d?.success) setItems((d.data as Charge[]).filter((c) => c.employeeChargeStatus === "PENDING" && c.status === "AWAITING_PAYMENT"));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (loading || !staff) return;
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [loading, staff, load]);

  const current = items[0] ?? null;

  const confirm = async () => {
    if (!current || pin.length !== 4 || busy) return;
    setBusy(true); setErr(null);
    const r = await fetch(`/api/comandas/${current.id}/employee-approve`, {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ pin }),
    });
    const d = await r.json().catch(() => null);
    setBusy(false);
    if (d?.success) { setPin(""); load(); }
    else setErr(d?.error ?? "No se pudo confirmar");
  };

  if (loading || !staff || !current) return null;

  const label = current.table ? `Mesa ${current.table.number}` : (current.customName || current.folio);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2147483600, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(3px)", padding: 20 }}>
      <div style={{ width: "min(94vw, 420px)", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: "26px 22px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ color: C.gold, fontSize: "0.74rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, textAlign: "center" }}>Confirmar crédito</div>
        <div style={{ color: C.cream, fontSize: "2.2rem", fontWeight: 800, textAlign: "center", margin: "10px 0 2px" }}>${Number(current.total).toFixed(2)}</div>
        <div style={{ color: C.dim, fontSize: "0.9rem", textAlign: "center" }}>{label} · a tu crédito de personal</div>
        <div style={{ color: C.faint, fontSize: "0.8rem", textAlign: "center", marginTop: 14 }}>Teclea tu PIN para aceptar este cargo a tu crédito.</div>

        <input type="password" inputMode="numeric" maxLength={4} autoFocus value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="• • • •"
          style={{ width: "100%", marginTop: 12, padding: "14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, color: C.cream, fontSize: "1.6rem", letterSpacing: "0.5em", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box" }} />
        {err && <div style={{ color: C.red, fontSize: "0.82rem", textAlign: "center", marginTop: 8 }}>{err}</div>}

        <button onClick={confirm} disabled={pin.length !== 4 || busy}
          style={{ width: "100%", marginTop: 16, padding: "15px", borderRadius: 12, border: "none", background: C.green, color: "var(--sl-bg)", fontWeight: 800, fontSize: "1rem", cursor: "pointer", fontFamily: "inherit", opacity: pin.length === 4 && !busy ? 1 : 0.55 }}>
          {busy ? "Confirmando…" : "Confirmar y cobrar"}
        </button>
        <div style={{ color: C.faint, fontSize: "0.72rem", textAlign: "center", marginTop: 12 }}>Si no eras tú, avisa a caja. La cuenta queda pendiente hasta confirmar.</div>
      </div>
    </div>
  );
}
