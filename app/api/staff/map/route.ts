import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { getStaffTableMap, setTableBlock, type BlockAction } from "@/lib/tableMap";
import type { ApiResponse } from "@/types";

const HOSTESS_ROLES = ["OPERATION", "CAPTAIN", "MANAGER"] as const;

/** GET /api/staff/map — estado en vivo de mesas por sección (reservas + comandas + bloqueos). realm STAFF. */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, [...HOSTESS_ROLES]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  try {
    const data = await getStaffTableMap();
    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (e) {
    console.error("[staff map GET]", e);
    return NextResponse.json<ApiResponse>({ success: false, error: "Error al cargar el mapa" }, { status: 500 });
  }
}

/** PATCH /api/staff/map — bloquear/desbloquear mesa o sección. realm STAFF. */
export async function PATCH(request: NextRequest) {
  const s = await requireStaffRole(request, [...HOSTESS_ROLES]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const r = await setTableBlock(body?.action as BlockAction, { tableId: body?.tableId, sectionId: body?.sectionId, note: body?.note });
  return NextResponse.json<ApiResponse>(r.ok ? { success: true, data: null } : { success: false, error: r.error }, { status: r.status });
}
