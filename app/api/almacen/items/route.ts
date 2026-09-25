import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * GET /api/almacen/items — catálogo de almacén para las pantallas de inventario.
 * Roles: OPERATION, CAPTAIN, MANAGER, KITCHEN. Query:
 *   categoryId (número), q (busca en el nombre, insensitive), includeArchived=1.
 * Devuelve categorías ACTIVAS (position asc, name asc), cada una con sus items en el
 * mismo orden (activos, o todos con includeArchived). Decimal → Number. Cada item lleva
 * `low` = minStock no null && stock < minStock.
 */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, ["OPERATION", "CAPTAIN", "MANAGER", "KITCHEN"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const categoryIdRaw = searchParams.get("categoryId");
  const categoryId = categoryIdRaw != null && Number.isInteger(Number(categoryIdRaw)) ? Number(categoryIdRaw) : null;
  const q = (searchParams.get("q") ?? "").trim();
  const includeArchived = searchParams.get("includeArchived") === "1";

  const categories = await prisma.stockCategory.findMany({
    where: { tenantId: TENANT, active: true, ...(categoryId != null ? { id: categoryId } : {}) },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      items: {
        where: {
          ...(includeArchived ? {} : { active: true }),
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      },
    },
  });

  const data = categories.map((cat) => ({
    ...cat,
    items: cat.items.map((it) => {
      const stock = Number(it.stock);
      const minStock = it.minStock != null ? Number(it.minStock) : null;
      return {
        ...it,
        stock,
        minStock,
        lastCost: it.lastCost != null ? Number(it.lastCost) : null,
        low: minStock != null && stock < minStock,
      };
    }),
  }));

  return NextResponse.json<ApiResponse>({ success: true, data });
}
