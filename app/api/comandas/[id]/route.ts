import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** GET /api/comandas/:id — detalle. WAITER solo la suya; OPERATION+ cualquiera. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    include: COMANDA_INCLUDE,
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });

  if (s.role === "WAITER" && comanda.waiterId !== s.staffId) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
  }
  return NextResponse.json<ApiResponse>({ success: true, data: comanda });
}
