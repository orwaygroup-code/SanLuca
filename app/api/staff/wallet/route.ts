import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * GET /api/staff/wallet — saldo y movimientos de crédito del EMPLEADO logueado (sus
 * cuentas a crédito de mesero: consumo que paga después / se descuenta de nómina).
 * Solo lectura de lo propio; saldar lo hace caja/admin.
 */
export async function GET(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const credits = await prisma.waiterCredit.findMany({
    where: { tenantId: TENANT, waiterId: s.staffId },
    select: {
      id: true, amount: true, status: true, note: true, createdAt: true, paidAt: true,
      comanda: { select: { folio: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = credits.filter((c) => c.status === "OUTSTANDING").reduce((sum, c) => sum + Number(c.amount), 0);

  const data = {
    pending: Math.round(pending * 100) / 100,
    credits: credits.map((c) => ({
      id: c.id, amount: Number(c.amount), status: c.status, note: c.note,
      folio: c.comanda?.folio ?? null,
      createdAt: c.createdAt.toISOString(), paidAt: c.paidAt ? c.paidAt.toISOString() : null,
    })),
  };
  return NextResponse.json<ApiResponse>({ success: true, data });
}
