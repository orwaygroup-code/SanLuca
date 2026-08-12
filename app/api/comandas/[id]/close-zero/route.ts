import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE, settleComanda } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { getOpenSession } from "@/lib/caja";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/close-zero — cierra ("mata") una cuenta cuyo total es $0 sin
 * cobro (cortesía / mesa sin consumo). Deja HUELLA: la settlea a PAID con un pago de
 * $0 (reference "Cierre en $0") + closedBy. requireCashier + turno abierto. Body opcional:
 * { reason }. Solo se permite si NO hay saldo pendiente (remaining ≤ 0).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja (Operación/Capitán/Manager)" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const session = await getOpenSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Abre un turno de caja antes de cerrar" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true, total: true, amountPaid: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede cerrar` }, { status: 409 });
  }

  const total = round2(Number(comanda.total));
  const remaining = round2(total - Number(comanda.amountPaid));
  if (remaining > 0.005) {
    return NextResponse.json<ApiResponse>({ success: false, error: `La cuenta tiene saldo pendiente (${remaining.toFixed(2)}); no se puede cerrar en $0` }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const note = typeof body?.reason === "string" ? body.reason.trim().slice(0, 120) : "";

  await prisma.$transaction(async (tx) => {
    await tx.comandaPayment.create({
      data: {
        tenantId: TENANT,
        comandaId: id,
        cashSessionId: session.id,
        method: "CASH",
        amount: 0,
        received: 0,
        changeGiven: 0,
        tip: 0,
        reference: note ? `Cierre en $0 · ${note}` : "Cierre en $0",
        receivedById: a.staffId as number,
      },
    });
    await tx.comanda.update({ where: { id }, data: { amountPaid: total } });
    await settleComanda(tx, id, a.staffId as number, session.id);
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: { comanda: updated, settled: true, closedZero: true } });
}
