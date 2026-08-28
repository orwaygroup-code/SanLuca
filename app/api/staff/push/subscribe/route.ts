import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * POST /api/staff/push/subscribe — guarda la suscripción Web Push del dispositivo del
 * empleado logueado. Body: { endpoint, keys: { p256dh, auth } }. Upsert por endpoint.
 * DELETE /api/staff/push/subscribe { endpoint } — la quita (al desactivar notificaciones).
 */
export async function POST(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Suscripción incompleta" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { staffId: s.staffId, p256dh, auth },
    create: { tenantId: TENANT, staffId: s.staffId, endpoint, p256dh, auth },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: { ok: true } });
}

export async function DELETE(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, staffId: s.staffId } });
  return NextResponse.json<ApiResponse>({ success: true, data: { ok: true } });
}
