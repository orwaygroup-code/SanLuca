import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * GET /api/caja/sessions/:id/comandas — #13 Historial de mesas (SOLO LECTURA).
 * Devuelve las cuentas PAID ligadas a ese turno, con sus productos, para consultarlas
 * después del cobro. requireCashier. No modifica nada.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const session = await prisma.cashSession.findFirst({ where: { id, tenantId: TENANT }, select: { id: true } });
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Turno no encontrado" }, { status: 404 });

  const comandas = await prisma.comanda.findMany({
    where: { tenantId: TENANT, cashSessionId: id, status: "PAID" },
    orderBy: { closedAt: "desc" },
    select: {
      id: true, folio: true, customName: true, guestsActual: true,
      subtotal: true, taxAmount: true, discountTotal: true, total: true, tipTotal: true, amountPaid: true,
      openedAt: true, closedAt: true, reopenCount: true,
      table: { select: { number: true, section: { select: { name: true } } } },
      waiter: { select: { fullName: true } },
      items: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { id: "asc" },
        select: { id: true, quantity: true, dishNameSnapshot: true, unitPriceSnapshot: true, lineTotal: true, discountAmount: true },
      },
      payments: {
        where: { voided: false },
        select: { method: true, amount: true, tip: true },
      },
    },
  });

  return NextResponse.json<ApiResponse>({ success: true, data: comandas });
}
