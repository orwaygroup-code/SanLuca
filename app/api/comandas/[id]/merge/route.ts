import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT, COMANDA_INCLUDE, recalcComandaTotals, isEditableStatus, LOCKED_ACCOUNT_MSG } from "@/lib/comanda";
import { notify } from "@/lib/notify";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/merge — junta cuentas. TARGET = :id. requireCashier + authPin.
 * Body: { sourceComandaId, authPin, reason? }
 * Mueve todos los items NO cancelados de la cuenta origen a la destino; la origen
 * pasa a MERGED (libera su mesa). GUARD: la origen no debe tener pagos (evita
 * mezclar dinero ya cobrado). recalc ambas.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const targetId = parseId(params.id);
  if (!targetId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const sourceId = parseId(String(body?.sourceComandaId));
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;
  const authPin = typeof body?.authPin === "string" ? body.authPin : "";
  if (!sourceId) return NextResponse.json<ApiResponse>({ success: false, error: "sourceComandaId es obligatorio" }, { status: 400 });
  if (sourceId === targetId) return NextResponse.json<ApiResponse>({ success: false, error: "No puedes juntar una cuenta consigo misma" }, { status: 400 });

  const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT });
  if (!authorizedById) {
    return NextResponse.json<ApiResponse>({ success: false, error: "PIN de supervisor inválido (Capitán/Manager)" }, { status: 403 });
  }

  const [target, source] = await Promise.all([
    prisma.comanda.findFirst({ where: { id: targetId, tenantId: TENANT }, select: { id: true, status: true } }),
    prisma.comanda.findFirst({
      where: { id: sourceId, tenantId: TENANT },
      select: { id: true, status: true, folio: true, total: true, amountPaid: true },
    }),
  ]);
  if (!target) return NextResponse.json<ApiResponse>({ success: false, error: "Cuenta destino no encontrada" }, { status: 404 });
  if (!source) return NextResponse.json<ApiResponse>({ success: false, error: "Cuenta origen no encontrada" }, { status: 404 });
  if (!isEditableStatus(target.status)) {
    const locked = target.status === "AWAITING_PAYMENT" || target.status === "PARTIALLY_PAID";
    return NextResponse.json<ApiResponse>({ success: false, error: locked ? `Cuenta destino: ${LOCKED_ACCOUNT_MSG}` : `Cuenta destino ${target.status}: no admite juntar` }, { status: 409 });
  }
  if (!isEditableStatus(source.status)) {
    const locked = source.status === "AWAITING_PAYMENT" || source.status === "PARTIALLY_PAID";
    return NextResponse.json<ApiResponse>({ success: false, error: locked ? `Cuenta origen: ${LOCKED_ACCOUNT_MSG}` : `Cuenta origen ${source.status}: no admite juntar` }, { status: 409 });
  }
  if (Number(source.amountPaid) > 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta origen ya tiene pagos; reábrela/anúlala antes de juntar" }, { status: 409 });
  }

  const itemCount = await prisma.comandaItem.count({
    where: { comandaId: sourceId, tenantId: TENANT, status: { not: "CANCELLED" } },
  });
  if (itemCount === 0) return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta origen no tiene productos que juntar" }, { status: 409 });

  await prisma.$transaction([
    prisma.comandaItem.updateMany({
      where: { comandaId: sourceId, tenantId: TENANT, status: { not: "CANCELLED" } },
      data: { comandaId: targetId },
    }),
    prisma.comandaMerge.create({
      data: {
        tenantId: TENANT,
        sourceComandaId: sourceId,
        targetComandaId: targetId,
        sourceFolio: source.folio,
        itemCount,
        mergedTotalSnapshot: source.total,
        mergedById: authorizedById,
        reason,
      },
    }),
    prisma.comanda.update({
      where: { id: sourceId },
      data: { status: "MERGED", closedAt: new Date(), closedById: a.staffId },
    }),
  ]);

  await Promise.all([recalcComandaTotals(targetId), recalcComandaTotals(sourceId)]);

  const updated = await prisma.comanda.findFirst({ where: { id: targetId, tenantId: TENANT }, include: COMANDA_INCLUDE });
  void notify({ roles: ["MANAGER"], type: "audit", title: "Cuentas juntadas", body: `${source.folio} → ${updated?.folio ?? `#${targetId}`}`, url: "/admin/comandas" });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
