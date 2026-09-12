import { NextRequest, NextResponse } from "next/server";
import type { PrepArea } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { canModifyComanda } from "@/lib/comandaRules";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const AREAS: PrepArea[] = ["COCINA", "BARRA"];

/**
 * POST /api/comandas/:id/notes — agrega una NOTA libre entre productos (append-only:
 * se agrega, nunca se edita ni borra). Va al ticket de cocina/barra del área elegida,
 * intercalada entre los productos por "tiempo" (course) y orden de captura, cuando se
 * envía la tanda a cocina. No es un platillo ni aparece en la cuenta del cliente.
 * Mismo control de acceso que agregar un item. Body: { text, area, course? }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, waiterId: true, openedById: true, tableId: true, status: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });

  // Mismo criterio que agregar un item: dueño (mesero / quien abrió) o supervisor;
  // para llevar (sin mesa) la maneja cualquier rol de caja.
  const isTakeout = comanda.tableId === null;
  const isCajaRole = s.role === "OPERATION" || s.role === "CAPTAIN" || s.role === "MANAGER";
  const isOwner = comanda.waiterId === s.staffId || comanda.openedById === s.staffId;
  if (!canModifyComanda(s.role, isOwner) && !(isTakeout && isCajaRole)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No puedes modificar esta comanda" }, { status: 403 });
  }
  if (comanda.status !== "OPEN" && comanda.status !== "IN_SERVICE") {
    return NextResponse.json<ApiResponse>({ success: false, error: `No se pueden agregar notas a una comanda ${comanda.status}` }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const rawText = typeof body?.text === "string" ? body.text.trim() : "";
  if (!rawText) return NextResponse.json<ApiResponse>({ success: false, error: "La nota no puede estar vacía" }, { status: 400 });
  const text = rawText.slice(0, 500);

  const area = body?.area as PrepArea;
  if (!AREAS.includes(area)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Área inválida (COCINA o BARRA)" }, { status: 400 });
  }
  // "tiempo" (course) para posicionarse entre productos: entero 0-10, 0 = Sin tiempo.
  const course = body?.course;
  const courseNum = Number.isInteger(course) && course >= 0 && course <= 10 ? course : 0;

  const staff = await prisma.staff.findUnique({ where: { id: s.staffId }, select: { fullName: true } });

  await prisma.comandaNote.create({
    data: {
      tenantId: TENANT,
      comandaId: id,
      text,
      area,
      course: courseNum,
      createdById: s.staffId,
      createdByName: staff?.fullName ?? "—",
    },
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated }, { status: 201 });
}
