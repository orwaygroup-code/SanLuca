import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/dualAuth";
import { TENANT, enqueueMessage } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

const AREAS = ["COCINA", "BARRA", "CAJA"] as const;

/**
 * POST /api/print/message — envía un MENSAJE libre a la impresora de un área. Cualquier
 * empleado logueado. Body: { area: "COCINA"|"BARRA"|"CAJA", text }. No va ligado a comanda.
 */
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
  if (actor.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const area = AREAS.includes(body?.area) ? (body.area as (typeof AREAS)[number]) : null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!area) return NextResponse.json<ApiResponse>({ success: false, error: "Elige el área (Cocina, Barra o Caja)" }, { status: 400 });
  if (!text) return NextResponse.json<ApiResponse>({ success: false, error: "Escribe el mensaje" }, { status: 400 });
  if (text.length > 300) return NextResponse.json<ApiResponse>({ success: false, error: "El mensaje es muy largo (máx. 300 caracteres)" }, { status: 400 });

  const staff = await prisma.staff.findUnique({ where: { id: actor.staffId }, select: { fullName: true } });
  const id = await enqueueMessage({ staffId: actor.staffId, area, text, fromName: staff?.fullName ?? null });

  return NextResponse.json<ApiResponse>({ success: true, data: { id, area } });
}
