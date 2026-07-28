import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import { getOpenSession } from "@/lib/caja";
import { loadWaiterBase, normalizePolicy } from "@/lib/tips";
import type { ApiResponse } from "@/types";

/**
 * GET /api/caja/tips/current — datos del reparto de propinas del turno ABIERTO.
 * Devuelve: el turno, la base por mesero (ventas + propinas registradas), el
 * reparto ya guardado (si existe) y la POLÍTICA (punto% + áreas) — que solo el
 * admin edita en Ajustes; Perla la ve pero no la cambia. requireCashier.
 */
export async function GET(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja" }, { status: 403 });

  const session = await getOpenSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: true, data: { session: null } });

  const [base, saved, settings] = await Promise.all([
    loadWaiterBase(session.id),
    prisma.tipSettlement.findUnique({
      where: { cashSessionId: session.id },
      include: {
        waiters: { include: { waiter: { select: { fullName: true } } } },
        areas: true,
      },
    }),
    prisma.restaurantSettings.findUnique({ where: { tenantId: TENANT }, select: { tipPolicy: true } }),
  ]);

  const policy = normalizePolicy(settings?.tipPolicy);

  return NextResponse.json<ApiResponse>({ success: true, data: { session, base, saved, policy } });
}
