"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffSession } from "@/lib/staff-session-client";
import { C, Spinner, useStaffLogout } from "@/components/staff/ui";
import { StaffShell } from "@/components/staff/StaffShell";
import { ReportesOperacionView } from "@/components/staff/reportesOperacion";

/**
 * #R-2 Reportes de Operación (vista de Perla, por el riel). Guard + shell; el
 * cuerpo vive en components/staff/reportesOperacion.tsx para poder embeberse
 * también en el panel admin (/admin/reportes/operacion). onRefresh del riel
 * recarga vía refreshSignal sin perder el modo.
 */
export default function ReportesOperacionPage() {
  const router = useRouter();
  const { staff, loading } = useStaffSession();
  const logout = useStaffLogout();
  const [refreshSignal, setRefreshSignal] = useState(0);

  const allowed = staff && ["OPERATION", "CAPTAIN", "MANAGER"].includes(staff.role);

  useEffect(() => {
    if (loading) return;
    if (!staff) { router.replace("/staff/login?next=/staff/reportes"); return; }
    if (!allowed) { router.replace("/staff/login"); return; }
  }, [loading, staff, allowed, router]);

  if (loading || !staff || !allowed) {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><Spinner /></div>;
  }

  return (
    <StaffShell active="reportes" onRefresh={() => setRefreshSignal((n) => n + 1)} onLogout={logout} userName={staff.fullName} role={staff.role} maxWidth={1100}>
      <ReportesOperacionView refreshSignal={refreshSignal} />
    </StaffShell>
  );
}
