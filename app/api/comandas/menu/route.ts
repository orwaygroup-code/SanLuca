import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { getStaffMenuCategories } from "@/lib/db";
import type { ApiResponse } from "@/types";

/**
 * GET /api/comandas/menu — menú para el comandero (staff). Incluye los platillos
 * del menú (available) MÁS los extras/especiales (isExtra) que están ocultos del
 * menú público. Un platillo agotado (available=false, no extra) queda fuera.
 * Misma forma que /api/menu. Cualquier rol de staff.
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
