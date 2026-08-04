// app/api/caja/movements/route.ts
// Entradas/salidas de efectivo del cajón en el turno abierto (depósito de fondo, pago
// a proveedor, retiro, etc.). Afectan el efectivo esperado del corte, no las ventas.
// Abre el cajón (#7). requireCashier (OPERATION/CAPTAIN/MANAGER/ADMIN).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { TENANT, enqueueDrawerKick } from "@/lib/comanda";
import { getOpenSession } from "@/lib/caja";
import { round2 } from "@/lib/comandaTotals";
import type { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const session = await getOpenSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Abre un turno de caja antes de registrar movimientos" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const direction = body?.direction === "OUT" ? "OUT" : body?.direction === "IN" ? "IN" : null;
  const amount = round2(Number(body?.amount));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!direction) return NextResponse.json<ApiResponse>({ success: false, error: "Indica si es entrada o salida" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json<ApiResponse>({ success: false, error: "Monto inválido" }, { status: 400 });
  if (!reason) return NextResponse.json<ApiResponse>({ success: false, error: "Escribe el motivo" }, { status: 400 });

  const mov = await prisma.cashMovement.create({
    data: { tenantId: TENANT, cashSessionId: session.id, direction, amount, reason, createdById: a.staffId as number },
    select: { id: true, direction: true, amount: true, reason: true, createdAt: true },
  });

  await enqueueDrawerKick({ staffId: a.staffId as number, comandaId: null }); // #7: el cajón abre en movimientos de dinero

  return NextResponse.json<ApiResponse>({ success: true, data: mov }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const session = await getOpenSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: true, data: [] });

  const movs = await prisma.cashMovement.findMany({
    where: { tenantId: TENANT, cashSessionId: session.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, direction: true, amount: true, reason: true, createdAt: true },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: movs });
}
