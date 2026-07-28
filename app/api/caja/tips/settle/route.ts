import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import {
  loadWaiterBase, normalizeAreas, sumAreaPercents, computeDeduction, computeNetTip, distributeToAreas,
  type TipArea,
} from "@/lib/tips";
import type { ApiResponse } from "@/types";

/**
 * POST /api/caja/tips/settle — guarda el reparto de propinas de un turno.
 * Body: { cashSessionId, areas:[{name,percent}], waiters:[{waiterId, cashTipsDeclared}], notes? }
 * TODO el cálculo se rehace en el servidor (no se confía en el cliente):
 * ventas/propinas registradas desde la BD, + efectivo declarado del body.
 * Upsert 1-por-turno. Guarda las áreas como política default.
 */
export async function POST(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const cashSessionId = Number(body?.cashSessionId);
  if (!Number.isInteger(cashSessionId) || cashSessionId <= 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Turno inválido" }, { status: 400 });
  }
  const areas: TipArea[] = normalizeAreas({ areas: body?.areas });
  if (areas.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "Define al menos un área de reparto" }, { status: 400 });
  const notes = typeof body?.notes === "string" ? body.notes : null;

  const session = await prisma.cashSession.findFirst({ where: { id: cashSessionId, tenantId: TENANT }, select: { id: true } });
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Turno no encontrado" }, { status: 404 });

  // Efectivo declarado por mesero (del body), acotado a ≥0.
  const declaredById = new Map<number, number>();
  if (Array.isArray(body?.waiters)) {
    for (const w of body.waiters) {
      const id = Number((w as { waiterId?: unknown })?.waiterId);
      const cash = round2(Number((w as { cashTipsDeclared?: unknown })?.cashTipsDeclared) || 0);
      if (Number.isInteger(id) && id > 0) declaredById.set(id, Math.max(0, cash));
    }
  }

  // Base fresca desde la BD + cálculo por mesero.
  const base = await loadWaiterBase(cashSessionId);
  const pointPercent = sumAreaPercents(areas);
  const waiterRows = base.map((w) => {
    const cashTipsDeclared = declaredById.get(w.waiterId) ?? 0;
    const deduction = computeDeduction(w.salesTotal, pointPercent);
    const netTip = computeNetTip(w.tipsRegistered, cashTipsDeclared, deduction);
    return {
      tenantId: TENANT, waiterId: w.waiterId, salesTotal: w.salesTotal, tipsRegistered: w.tipsRegistered,
      cashTipsDeclared, pointPercent, deduction, netTip,
    };
  });

  const salesTotal = round2(base.reduce((s, w) => s + w.salesTotal, 0));
  const tipsRegistered = round2(base.reduce((s, w) => s + w.tipsRegistered, 0));
  const cashTipsDeclared = round2(waiterRows.reduce((s, w) => s + w.cashTipsDeclared, 0));
  const poolTotal = round2(waiterRows.reduce((s, w) => s + w.deduction, 0));
  const areaRows = distributeToAreas(salesTotal, areas).map((ar) => ({ tenantId: TENANT, name: ar.name, percent: ar.percent, amount: ar.amount }));

  const saved = await prisma.$transaction(async (tx) => {
    await tx.tipSettlement.deleteMany({ where: { cashSessionId } }); // upsert 1-por-turno (cascade hijos)
    const created = await tx.tipSettlement.create({
      data: {
        tenantId: TENANT, cashSessionId, pointPercent, salesTotal, tipsRegistered, cashTipsDeclared, poolTotal, notes,
        createdById: a.staffId as number,
        waiters: { create: waiterRows },
        areas: { create: areaRows },
      },
      include: { waiters: { include: { waiter: { select: { fullName: true } } } }, areas: true },
    });
    // Guardar áreas como política default.
    const policy = { areas } as unknown as Prisma.InputJsonValue;
    await tx.restaurantSettings.upsert({
      where: { tenantId: TENANT },
      update: { tipPolicy: policy },
      create: { tenantId: TENANT, tipPolicy: policy },
    });
    return created;
  });

  return NextResponse.json<ApiResponse>({ success: true, data: saved });
}
