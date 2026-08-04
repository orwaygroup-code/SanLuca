// app/api/caja/drawer/route.ts
// Abre el cajón de dinero manualmente (botón "Abrir cajón" en la vista de caja).
// Encola un DRAWER_KICK para el PrintBridge de CAJA. requireCashier (OPERATION/
// CAPTAIN/MANAGER/ADMIN).

import { NextRequest, NextResponse } from "next/server";
import { requireCashier } from "@/lib/dualAuth";
import { enqueueDrawerKick } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  await enqueueDrawerKick({ staffId: a.staffId as number, comandaId: null });
  return NextResponse.json<ApiResponse>({ success: true, data: { ok: true } });
}
