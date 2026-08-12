"use client";

// Detalle de comanda DENTRO del panel admin: reutiliza el componente compartido en
// modo `embedded`, así el menú lateral de /admin se queda visible mientras se ve/opera
// la comanda. La ruta staff (/staff/comandas/[id]) usa el mismo componente sin embed.
import { ComandaDetailView } from "@/components/staff/ComandaDetailView";

export default function AdminComandaDetailPage() {
  return <ComandaDetailView embedded />;
}
