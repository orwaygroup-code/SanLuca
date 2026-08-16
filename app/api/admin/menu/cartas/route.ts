import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import type { ApiResponse } from "@/types";

/** GET /api/admin/menu/cartas?turno=&clase= — cartas (filtradas). ADMIN. */
export async function GET(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const turno = searchParams.get("turno");
  const clase = searchParams.get("clase");

  const cartas = await prisma.carta.findMany({
    where: {
      ...(turno === "COMIDA" || turno === "BRUNCH" ? { turno } : {}),
      ...(clase === "COCINA" || clase === "BARRA" ? { clase } : {}),
    },
    orderBy: [{ turno: "asc" }, { position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, turno: true, clase: true, position: true, isPrincipal: true, _count: { select: { categories: true } } },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: cartas });
}

/** POST /api/admin/menu/cartas { name, turno, clase, position? } — crea carta. ADMIN. */
export async function POST(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  const turno = body?.turno;
  const clase = body?.clase;
  const position = Number.isInteger(body?.position) ? body.position : null;
  if (!name) return NextResponse.json<ApiResponse>({ success: false, error: "Ponle nombre a la carta" }, { status: 400 });
  if (turno !== "COMIDA" && turno !== "BRUNCH") return NextResponse.json<ApiResponse>({ success: false, error: "Turno inválido" }, { status: 400 });
  if (clase !== "COCINA" && clase !== "BARRA") return NextResponse.json<ApiResponse>({ success: false, error: "Clase inválida" }, { status: 400 });

  const dup = await prisma.carta.findFirst({ where: { turno, name }, select: { id: true } });
  if (dup) return NextResponse.json<ApiResponse>({ success: false, error: "Ya existe una carta con ese nombre en ese turno" }, { status: 409 });

  const created = await prisma.carta.create({
    data: { name, turno, clase, position },
    select: { id: true, name: true, turno: true, clase: true, position: true },
  });
  return NextResponse.json<ApiResponse>({ success: true, data: created }, { status: 201 });
}
