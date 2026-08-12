import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { getStaffMenuCategories } from "@/lib/db";
import type { ApiResponse } from "@/types";

/**
 * GET /api/comandas/menu — menú para el comandero (staff). Muestra TODOS los
 * productos activos, incluidos los ocultos del menú público (available=false) y los
 * extras/especiales (isExtra): "ocultar del menú" es solo para el sitio público, el
 * mesero debe poder ordenar cualquier producto. Misma forma que /api/menu.
 */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, ["WAITER", "OPERATION", "CAPTAIN", "MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const categories = await getStaffMenuCategories();
  const serialized = categories.map((cat) => ({
    ...cat,
    dishes: cat.dishes.map((item) => ({ ...item, price: Number(item.price) })),
  }));
  return NextResponse.json<ApiResponse>({ success: true, data: serialized });
}
