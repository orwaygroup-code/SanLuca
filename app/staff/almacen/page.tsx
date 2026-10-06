"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { useSession } from "@/lib/session-client";
import { C, StaffHeader, Spinner, btn, useToasts, ToastHost, useStaffLogout } from "@/components/staff/ui";
import { AlmacenView } from "@/components/staff/almacen";

const ALLOWED = ["OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"];

/** Pantalla de Almacén (Ola A-3). Guard + cabecera; la interfaz vive en <AlmacenView>. */
export default function AlmacenPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const panel = useSession(); // sesión del panel admin, solo para mostrar el enlace a la auditoría
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();
  const [adminMode, setAdminMode] = useState(false); // "Administrar" (solo MANAGER); vive aquí porque el botón va en el StaffHeader

  useEffect(() => {
    const here = window.location.pathname + window.location.search;
    if (!loading && !staff) { router.replace(`/staff/login?next=${encodeURIComponent(here)}`); return; }
    if (staff && !ALLOWED.includes(staff.role)) router.replace("/staff/login");
  }, [loading, staff, router]);

  if (loading || !staff || !ALLOWED.includes(staff.role)) {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><Spinner /></div>;
  }

  const isManager = staff.role === "MANAGER";
  // La auditoría vive en el panel y su guard exige ADMIN; el enlace solo se muestra a quien lo es.
  const canAudit = panel.user?.role === "ADMIN";

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <StaffHeader
        title="Almacén"
        role={staff.role}
        userName={staff.fullName}
        onBack={() => router.back()}
        onLogout={logout}
        right={isManager || canAudit ? (
          <div style={{ display: "flex", gap: 8 }}>
            {canAudit && (
              <button style={btn.ghost} onClick={() => router.push("/admin/almacen?tab=auditoria")}>Auditoría</button>
            )}
            {isManager && (
              <button style={{ ...(adminMode ? btn.primary : btn.ghost) }} onClick={() => setAdminMode((v) => !v)}>
                {adminMode ? "Listo" : "Administrar"}
              </button>
            )}
          </div>
        ) : undefined}
      />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 22px 48px", boxSizing: "border-box" }}>
        <AlmacenView role={staff.role} push={push} adminMode={isManager && adminMode} />
      </main>
      <ToastHost toasts={toasts} onClose={dismiss} />
    </div>
  );
}
