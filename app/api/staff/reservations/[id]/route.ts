import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { editReservation, moveReservationTable, changeReservationStatus, deleteReservation, type SvcResult } from "@/lib/reservations";
import type { ApiResponse } from "@/types";

const HOSTESS_ROLES = ["OPERATION", "CAPTAIN", "MANAGER"] as const;
const respond = (r: SvcResult) =>
  NextResponse.json<ApiResponse>(r.ok ? { success: true, data: r.data } : { success: false, error: r.error }, { status: r.status });

/**
 * PATCH /api/staff/reservations/:id — realm STAFF (hostess).
 * Body: { action: "edit-reservation", ... } | { action: "move-table", ... } | { status }
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, [...HOSTESS_ROLES]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  let r: SvcResult;
  if (body?.action === "edit-reservation") r = await editReservation(params.id, body);
  else if (body?.action === "move-table") r = await moveReservationTable(params.id, body);
  else r = await changeReservationStatus(params.id, body?.status);
  return respond(r);
}

/** DELETE /api/staff/reservations/:id — solo estados terminales. realm STAFF. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await requireStaffRole(request, [...HOSTESS_ROLES]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const r = await deleteReservation(params.id);
  return respond(r);
}
