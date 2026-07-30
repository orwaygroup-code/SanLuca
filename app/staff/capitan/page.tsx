"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { C, StaffHeader, Spinner, btn, useStaffLogout } from "@/components/staff/ui";
import { CapitanBoard } from "@/components/staff/CapitanBoard";
import { Tour, type TourStep } from "@/components/staff/Tour";

/** Tutorial guiado de la vista Capitán. */
const CAPITAN_TOUR: TourStep[] = [
  { title: "Vista Capitán", body: "Supervisas TODAS las comandas del piso, sin importar de qué mesero sean. Desde aquí mueves mesas, reasignas meseros o cancelas cuentas." },
  { target: "grid", title: "Todo el piso a la vista", body: "Cada tarjeta es una comanda activa: folio, mesa o cuenta, mesero, número de personas y total en vivo." },
  { target: "acciones", title: "Acciones de supervisión", body: "En cada cuenta: «Ver» abre el detalle, «Mover mesa» la cambia de lugar, «Cambiar mesero» la reasigna, y «Cancelar» la anula (pide motivo para auditoría)." },
  { target: "refrescar", title: "Mantén el piso al día", body: "El piso cambia rápido. Toca «↻ Actualizar» para refrescar la lista, o reabre este tutorial con el botón «?»." },
];

/** Vista Capitán (realm STAFF) — encabezado + tablero de piso compartido. */
export default function CapitanPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const [tourOpen, setTourOpen] = useState(false);
  const autoTourDone = useRef(false);

  const allowed = staff && (staff.role === "CAPTAIN" || staff.role === "MANAGER");

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/capitan"); return; }
    if (staff && !allowed) { router.replace("/staff/login"); return; }
  }, [loading, staff, allowed, router]);

  // Auto-abrir el tutorial la primera vez (una vez por dispositivo).
  useEffect(() => {
    if (!autoTourDone.current && staff && allowed && typeof window !== "undefined" && !localStorage.getItem("sl_tour_capitan_v1")) {
      autoTourDone.current = true;
      setTourOpen(true);
    }
  }, [staff, allowed]);
  const closeTour = () => { setTourOpen(false); try { localStorage.setItem("sl_tour_capitan_v1", "1"); } catch { /* ignore */ } };

  if (loading || !staff || !allowed) return <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><Spinner /></div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <StaffHeader
        title="Capitán"
        role={staff.role}
        userName={staff.fullName}
        onLogout={logout}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {staff.role === "MANAGER" && (
              <button style={{ ...btn.ghost, minHeight: 40, padding: "0 14px", fontSize: "0.82rem" }} onClick={() => router.push("/admin")}>Panel</button>
            )}
            <button onClick={() => setTourOpen(true)} title="Tutorial" aria-label="Abrir tutorial"
              style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 800, fontSize: "1.05rem", cursor: "pointer" }}>?</button>
          </div>
        }
      />
      <CapitanBoard />
      <Tour steps={CAPITAN_TOUR} open={tourOpen} onClose={closeTour} />
    </div>
  );
}
