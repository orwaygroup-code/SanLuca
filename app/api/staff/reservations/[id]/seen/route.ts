import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { markReservationSeen } from "@/lib/reservations";
import type { ApiResponse } from "@/types";

/** POST /api/staff/reservations/:id/seen — marca la reserva como vista. realm STAFF. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, ["OPERATION", "CAPTAIN", "MANAGER"]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const r = await markReservationSeen(params.id);
  return NextResponse.json<ApiResponse>(r.ok ? { success: true, data: r.data } : { success: false, error: r.error }, { status: r.status });
}
