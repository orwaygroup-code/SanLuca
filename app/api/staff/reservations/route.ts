import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staff-auth-server";
import { listReservations, createReservation, type SvcResult } from "@/lib/reservations";
import type { ApiResponse } from "@/types";

const HOSTESS_ROLES = ["OPERATION", "CAPTAIN", "MANAGER"] as const;
const respond = (r: SvcResult) =>
  NextResponse.json<ApiResponse>(r.ok ? { success: true, data: r.data } : { success: false, error: r.error }, { status: r.status });

/** GET /api/staff/reservations?section=&date=&search=&archived=&all= — realm STAFF (hostess). */
export async function GET(request: NextRequest) {
  const s = await requireStaffRole(request, [...HOSTESS_ROLES]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const r = await listReservations({
    section: searchParams.get("section"),
    date: searchParams.get("date"),
    search: searchParams.get("search"),
    archived: searchParams.get("archived") === "1",
    all: searchParams.get("all") === "1",
  });
  return respond(r);
}

/** POST /api/staff/reservations — crea reserva (sin restricciones). realm STAFF. */
export async function POST(request: NextRequest) {
  const s = await requireStaffRole(request, [...HOSTESS_ROLES]);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  // El staff no tiene User id → createdById null (createdBy es FK a User, opcional).
  const r = await createReservation(body, null);
  return respond(r);
}
