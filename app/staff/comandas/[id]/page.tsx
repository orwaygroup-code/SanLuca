"use client";

// Ruta staff de pantalla completa (con StaffHeader). La lógica vive en el componente
// compartido, que el panel /admin reusa en modo embebido (conserva su menú lateral).
import { ComandaDetailView } from "@/components/staff/ComandaDetailView";

export default function ComandaDetailPage() {
  return <ComandaDetailView />;
}
