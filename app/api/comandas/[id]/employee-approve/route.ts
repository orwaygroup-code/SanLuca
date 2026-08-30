import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/dualAuth";
import { verifyWaiterPin } from "@/lib/staff";
import { TENANT, ACTIVE_STATUSES, COMANDA_INCLUDE, settleComanda } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { getOpenSession } from "@/lib/caja";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/employee-approve — #4 El empleado APRUEBA (palomea) que la cuenta
 * ligada se le cargue a crédito. Body: { pin }. Se valida el PIN del empleado ligado, así
 * funciona tanto desde su propia pantalla (Cartera) como tecleado en la terminal de caja.
 * Deja la cuenta APPROVED; recién entonces caja puede cobrarla a crédito.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const pin = typeof body?.pin === "string" ? body.pin : "";

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, status: true, chargedEmployeeId: true, employeeChargeStatus: true, total: true, amountPaid: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (comanda.chargedEmployeeId == null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Esta cuenta no está ligada a ningún empleado" }, { status: 409 });
  }
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: ya no se puede aprobar` }, { status: 409 });
  }

  const okPin = await verifyWaiterPin(comanda.chargedEmployeeId, pin);
  if (!okPin) return NextResponse.json<ApiResponse>({ success: false, error: "PIN del empleado inválido" }, { status: 403 });

  await prisma.comanda.update({
    where: { id },
    data: { employeeChargeStatus: "APPROVED", employeeChargeApprovedAt: new Date() },
  });

  // Las dos vías de aprobación terminan distinto, a propósito:
  //
  //  - Desde SU app: aceptar la deuda ES el cobro. La cuenta se salda sola y
  //    pasa a archivo como cualquier mesa cobrada. Antes sólo quedaba marcada
  //    APPROVED y la mesa seguía ocupada hasta que caja la cobrara aparte.
  //  - Tecleando el NIP EN CAJA: sólo desbloquea. La cajera cobra después con
  //    su botón, que es donde elige método y cierra el turno.
  //
  // Se distingue por quién ejecuta: si el actor es el propio empleado ligado,
  // viene de su sesión; si es otra persona, es la terminal de caja.
  const selfApproved = actor.staffId != null && actor.staffId === comanda.chargedEmployeeId;
  let settled = false;

  if (selfApproved) {
    const session = await getOpenSession();
    const remaining = round2(Number(comanda.total) - Number(comanda.amountPaid));

    // Sin turno abierto no hay dónde registrar el pago. La aprobación queda
    // hecha y caja lo cobra al abrir turno, en vez de perderse.
    if (session && remaining > 0) {
      const employeeId = comanda.chargedEmployeeId!;
      const newAmountPaid = round2(Number(comanda.amountPaid) + remaining);
      settled = true;

      await prisma.$transaction(async (tx) => {
        await tx.comandaPayment.create({
          data: {
            tenantId: TENANT, comandaId: id, cashSessionId: session.id, method: "WAITER_CREDIT",
            amount: remaining, received: 0, changeGiven: 0, tip: 0,
            reference: "Crédito de personal (aprobado por el empleado)", receivedById: employeeId,
          },
        });
        await tx.waiterCredit.create({
          data: { tenantId: TENANT, waiterId: employeeId, comandaId: id, cashSessionId: session.id, amount: remaining, authorizedById: employeeId },
        });
        await tx.comanda.update({ where: { id }, data: { amountPaid: newAmountPaid } });
        await settleComanda(tx, id, employeeId, session.id);
      });
    }
  }

  // Sin campo aparte para `settled`: la comanda devuelta ya viene en PAID
  // cuando el cobro se ejecutó, y el cliente decide el mensaje con eso.
  void settled;
  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
