"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { C, StaffHeader, Spinner, btn, useToasts, ToastHost, useStaffLogout } from "@/components/staff/ui";
import { AlmacenView } from "@/components/staff/almacen";

const ALLOWED = ["OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"];

/** Pantalla de Almacén (Ola A-3). Guard + cabecera; la interfaz vive en <AlmacenView>. */
export default function AlmacenPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();
  const [adminMode, setAdminMode] = useState(false); // "Administrar" (solo MANAGER); vive aquí porque el botón va en el StaffHeader

  useEffect(() => {
    if (!loading && !staff) { router.replace("/staff/login?next=/staff/almacen"); return; }
    if (staff && !ALLOWED.includes(staff.role)) router.replace("/staff/login");
  }, [loading, staff, router]);

  if (loading || !staff || !ALLOWED.includes(staff.role)) {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><Spinner /></div>;
  }

  const isManager = staff.role === "MANAGER";

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <StaffHeader
        title="Almacén"
        role={staff.role}
        userName={staff.fullName}
        onBack={() => router.back()}
        onLogout={logout}
        right={isManager ? (
          <button style={{ ...(adminMode ? btn.primary : btn.ghost) }} onClick={() => setAdminMode((v) => !v)}>
            {adminMode ? "Listo" : "Administrar"}
          </button>
        ) : undefined}
      />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 22px 48px", boxSizing: "border-box" }}>
        <AlmacenView role={staff.role} push={push} adminMode={isManager && adminMode} />
      </main>
      <ToastHost toasts={toasts} onClose={dismiss} />
    </div>
  );
}
