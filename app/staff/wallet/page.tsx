"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { C, StaffHeader, Spinner, EmptyState, useStaffLogout, formatMXN } from "@/components/staff/ui";
import { apiFetch } from "@/components/staff/types";

interface Credit { id: number; amount: number; status: string; note: string | null; folio: string | null; createdAt: string; paidAt: string | null }
interface Wallet { pending: number; credits: Credit[] }

/** Wallet del empleado: su saldo pendiente en cuentas a crédito + movimientos. Solo lectura. */
export default function WalletPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const [w, setW] = useState<Wallet | null>(null);

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/wallet"); return; }
    if (staff) apiFetch<Wallet>("/api/staff/wallet").then((r) => { if (r.ok) setW(r.data!); });
  }, [loading, staff, router]);

  if (loading || !w) return <div style={{ minHeight: "100vh", background: C.bg }}><Spinner /></div>;

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <StaffHeader title="Mi saldo" role={staff?.role} userName={staff?.fullName} onLogout={logout} onBack={() => router.back()} />
      <main style={{ padding: 18, maxWidth: 640, margin: "0 auto", paddingBottom: 60 }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 20px", marginBottom: 18 }}>
          <div style={{ color: C.faint, fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Saldo pendiente por pagar</div>
          <div style={{ color: w.pending > 0 ? C.amber : C.green, fontWeight: 800, fontSize: "2rem", marginTop: 6 }}>{formatMXN(w.pending)}</div>
          <div style={{ color: C.dim, fontSize: "0.8rem", marginTop: 4 }}>
            {w.pending > 0 ? "Se descuenta de tu nómina o lo pagas en caja." : "Estás al corriente."}
          </div>
        </div>

        <div style={{ color: C.faint, fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, margin: "0 2px 10px" }}>Movimientos</div>
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
