import { OperacionView } from "@/components/staff/OperacionView";

/**
 * Caja embebida en el panel admin (manager) — misma vista de Operación pero DENTRO del
 * sidebar de admin, sin cambiar de panel. El tab lo controla ?tab= (server component →
 * prop reactivo a la navegación del dropdown). Los endpoints de caja aceptan al manager
 * (requireCashier admite ADMIN/OPERATION/CAPTAIN/MANAGER).
 */
export default function AdminCajaPage({ searchParams }: { searchParams: { tab?: string } }) {
  return <OperacionView embedded controlledTab={searchParams.tab} />;
}
