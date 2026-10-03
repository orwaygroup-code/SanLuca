import { ReportesOperacionView } from "@/components/staff/reportesOperacion";

/**
 * Reportes de Operación embebidos en el panel admin (manager) — la MISMA vista que
 * /staff/reportes pero DENTRO del sidebar, sin cambiar de panel ni pedir PIN. Sin guard
 * propio, igual que /admin/caja: AdminShell ya resuelve el acceso al panel y los endpoints
 * son el guardia real (requireCashier admite ADMIN/OPERATION/CAPTAIN/MANAGER; un ADMIN sin
 * Staff vinculado recibe 403).
 */
export default function AdminReportesOperacionPage() {
  return <ReportesOperacionView embedded />;
}
