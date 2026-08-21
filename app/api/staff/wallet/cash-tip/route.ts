import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * POST /api/staff/wallet/cash-tip { amount, note? } — el mesero registra una propina en
 * EFECTIVO que recibió directo y NO declara a caja (p. ej. el cambio que le dejan). Es solo su
 * conteo personal: NO entra al corte ni al pool de propinas. La asocia al turno abierto si hay.
 */
export async function POST(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const amount = Math.round(Number(body?.amount) * 100) / 100;
  const note = typeof body?.note === "string" ? (body.note.trim().slice(0, 200) || null) : null;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Monto inválido" }, { status: 400 });
  }

  const session = await prisma.cashSession.findFirst({ where: { tenantId: TENANT, status: "OPEN" }, select: { id: true } });

  await prisma.waiterCashTip.create({
    data: { tenantId: TENANT, waiterId: s.staffId, cashSessionId: session?.id ?? null, amount, note },
  });

  return NextResponse.json<ApiResponse>({ success: true, data: { ok: true } });
}
