import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

/**
 * GET /api/staff/notifications — feed de la campana in-app: notificaciones recientes cuyos
 * `roles` incluyen el rol del empleado logueado. Las últimas 40, más nuevas primero. El
 * "no leído" lo lleva el cliente por dispositivo (localStorage).
 */
export async function GET(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const list = await prisma.notification.findMany({
    where: { tenantId: TENANT, roles: { has: s.role } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, type: true, title: true, body: true, url: true, createdAt: true },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: list });
}
