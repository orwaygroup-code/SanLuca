import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { canModifyComanda } from "@/lib/comandaRules";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/send-to-cashier — el mesero pide la cuenta.
 * Pasa la comanda a AWAITING_PAYMENT. WAITER de su comanda, o CAPTAIN/MANAGER.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, waiterId: true, openedById: true, tableId: true, status: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  // Para llevar (sin mesa): la maneja caja → cualquier rol de caja puede operarla.
  const isTakeout = comanda.tableId === null;
  const isCajaRole = s.role === "OPERATION" || s.role === "CAPTAIN" || s.role === "MANAGER";
  const isOwner = comanda.waiterId === s.staffId || comanda.openedById === s.staffId;
  if (!canModifyComanda(s.role, isOwner) && !(isTakeout && isCajaRole)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No puedes modificar esta comanda" }, { status: 403 });
  }
  if (comanda.status !== "OPEN" && comanda.status !== "IN_SERVICE") {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no aplica pedir cuenta` }, { status: 409 });
  }

  await prisma.comanda.update({ where: { id }, data: { status: "AWAITING_PAYMENT" } });
  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
