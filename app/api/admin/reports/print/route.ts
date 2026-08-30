import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { enqueueMessage } from "@/lib/comanda";
import { TICKET_COLS } from "@/lib/reportExport";
import type { ApiResponse } from "@/types";

/**
 * POST /api/admin/reports/print { text } — manda el reporte de ventas a la
 * impresora de CAJA. Solo ADMIN.
 *
 * El texto llega ya formado desde la pantalla, a propósito: así lo impreso es
 * exactamente lo que el administrador tenía en el rango que eligió. Rearmarlo
 * aquí con otra consulta abriría la puerta a que el papel y la pantalla no
 * coincidan si el rango cambió entre una cosa y otra. Es el mismo criterio de
 * /api/print/message, que también imprime texto enviado por el cliente; la
 * diferencia es el límite, porque un reporte no cabe en 300 caracteres.
 */

const MAX = 4000;

export async function POST(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
  if (a.staffId == null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario admin no está vinculado a un empleado (Staff)" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trimEnd() : "";
  if (!text) return NextResponse.json<ApiResponse>({ success: false, error: "No hay nada que imprimir" }, { status: 400 });
  if (text.length > MAX) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `El reporte es demasiado largo para el ticket (${text.length} de ${MAX} caracteres). Acota el rango o expórtalo a hoja de cálculo.` },
      { status: 400 },
    );
  }

  const staff = await prisma.staff.findUnique({ where: { id: a.staffId }, select: { fullName: true } });
  // pre: el reporte llega con sus columnas ya alineadas y trae su propio
  // encabezado. cols: el ancho en el que se armó, para que el puente lo centre
  // si la impresora es más ancha.
  const id = await enqueueMessage({
    staffId: a.staffId, area: "CAJA", text, fromName: staff?.fullName ?? null,
    pre: true, cols: TICKET_COLS,
  });

  return NextResponse.json<ApiResponse>({ success: true, data: { id } });
}

