import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { TENANT, ACTIVE_STATUSES } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * GET /api/comandas/tables-status — todas las mesas activas con su estado de
 * comanda (libre / OPEN / IN_SERVICE / AWAITING_PAYMENT) para el mapa de
 * Operación y Capitán, y para que el Mesero elija mesa libre al abrir comanda.
 * Realm sl_staff (WAITER/OPERATION/CAPTAIN/MANAGER) — vista de piso, solo lectura.
 */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, ["WAITER", "OPERATION", "CAPTAIN", "MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const tables = await prisma.table.findMany({
    where: { isActive: true },
    select: { id: true, number: true, capacity: true, section: { select: { name: true } } },
    orderBy: { number: "asc" },
  });

  const activeComandas = await prisma.comanda.findMany({
    where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] } },
    select: {
      id: true, folio: true, status: true, tableId: true, total: true, guestsActual: true,
      waiter: { select: { id: true, fullName: true } },
      prints: { where: { type: "CUSTOMER_FINAL" }, select: { id: true }, take: 1 }, // ¿ya se imprimió la cuenta?
    },
  });
  const byTable = new Map(activeComandas.map((c) => [c.tableId, c]));

  const data = tables.map((t) => {
    const c = byTable.get(t.id);
    return {
      id: t.id,
      number: t.number,
      capacity: t.capacity,
      section: t.section.name,
      state: c ? c.status : "FREE",
      comanda: c
        ? { id: c.id, folio: c.folio, status: c.status, total: Number(c.total), guests: c.guestsActual, waiter: c.waiter, billPrinted: c.prints.length > 0 }
        : null,
    };
  });

  return NextResponse.json<ApiResponse>({ success: true, data });
}
