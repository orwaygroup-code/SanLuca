"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { C, StaffHeader, Spinner, btn, useToasts, ToastHost, useStaffLogout } from "@/components/staff/ui";
import { StaffShell } from "@/components/staff/StaffShell";
import { FaltantesPanel } from "@/components/staff/FaltantesPanel";

/**
 * #6 Panel 86 (faltantes) + #7 Panel 101 (priorizar venta). El contenido vive en
 * <FaltantesPanel> (reutilizado también como panel embebido en la vista del mesero).
 * Aquí solo se resuelve el chrome según el rol: Perla (Operación/Capitán/Manager) con
 * su riel lateral; cualquier otro (mesero que entre por URL directa) con header simple.
 */
export default function CocinaPanelPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const { toasts, push, dismiss } = useToasts();

  const [initialTab, setInitialTab] = useState<"86" | "101">("86");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "101" || t === "86") setInitialTab(t);
  }, []);

  useEffect(() => {
    if (!loading && !staff) router.replace("/staff/login?next=/staff/cocina");
  }, [loading, staff, router]);

  if (loading || !staff) return <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><Spinner /></div>;

  const isPerla = ["OPERATION", "CAPTAIN", "MANAGER"].includes(staff.role ?? "");
  const panel = <FaltantesPanel role={staff.role} initialTab={initialTab} push={push} />;

  return (
    <>
      {isPerla ? (
        <StaffShell active="cocina" onLogout={logout} userName={staff.fullName} role={staff.role} maxWidth={900}>
          {panel}
        </StaffShell>
      ) : (
        <div style={{ minHeight: "100vh", background: C.bg }}>
          <StaffHeader
            title="Faltantes / Priorizar"
            role={staff.role}
            userName={staff.fullName}
            onLogout={logout}
            right={<button onClick={() => router.push("/staff/comandas")} style={btn.ghost}>← Mis comandas</button>}
          />
          <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px 22px 48px", boxSizing: "border-box" }}>{panel}</main>
        </div>
      )}
      <ToastHost toasts={toasts} onClose={dismiss} />
    </>
  );
}
