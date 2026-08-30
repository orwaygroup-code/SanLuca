"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { C, StaffHeader, Spinner, useStaffLogout } from "@/components/staff/ui";
import { CapitanBoard } from "@/components/staff/CapitanBoard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { StaffRail } from "@/components/staff/StaffRail";
import { useSession } from "@/lib/session-client";
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
  const [menuOpen, setMenuOpen] = useState(false); // drawer de navegación (hamburguesa)
  const autoTourDone = useRef(false);

  const allowed = staff && (staff.role === "CAPTAIN" || staff.role === "MANAGER");
  // ¿Este MANAGER además tiene acceso al panel /admin (User ADMIN ligado)? Solo entonces
  // se muestra "Panel": DAVID (#3) es MANAGER SIN puente admin y el botón lo atascaba.
  // Del contexto de sesión que ya monta el layout raíz, en vez de un fetch
  // propio: se resuelve de inmediato, así el drawer abre directamente con el
  // menú correcto en lugar de mostrar el de staff mientras llegaba la
  // respuesta.
  const { user } = useSession();
  const hasAdmin = staff?.role === "MANAGER" && (user?.role === "ADMIN" || user?.role === "HOSTES");

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
            {/* Siempre visible. Antes se ocultaba a quien no tuviera puente
                admin —y esos managers se quedaban SIN navegación alguna en
                esta vista—. Lo que cambia no es el botón, sino a dónde lleva:
                el menú del panel para quien puede entrar a /admin, y el riel
                de staff para el resto. */}
            <button onClick={() => setMenuOpen(true)} title="Menú" aria-label="Abrir menú"
              style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 800, fontSize: "1.15rem", lineHeight: 1, cursor: "pointer" }}>☰</button>
            <button onClick={() => setTourOpen(true)} title="Tutorial" aria-label="Abrir tutorial"
              style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.gold, fontWeight: 800, fontSize: "1.05rem", cursor: "pointer" }}>?</button>
          </div>
        }
      />

      {/* Drawer de navegación. Con puente admin abre el menú del panel; sin él,
          el riel de staff — mismos destinos a los que sí tiene acceso. */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div onClick={() => setMenuOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }} />
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: hasAdmin ? 260 : 112, maxWidth: "82vw", boxShadow: "4px 0 24px rgba(0,0,0,0.5)", overflowY: "auto" }}
          >
            {hasAdmin ? (
              <AdminSidebar userName={staff.fullName} onLogout={logout} onNavigate={() => setMenuOpen(false)} />
            ) : (
              <StaffRail active="mesas" role={staff.role} userName={staff.fullName} onLogout={logout} />
            )}
          </div>
        </div>
      )}
      <CapitanBoard />
      <Tour steps={CAPITAN_TOUR} open={tourOpen} onClose={closeTour} />
    </div>
  );
}
