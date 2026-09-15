import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { enqueueMessage } from "@/lib/comanda";
import { buildReportData } from "@/lib/reportsData";
import { reportToTicketText, subHasRows, TICKET_COLS, type ReportSub } from "@/lib/reportExport";
import type { ApiResponse } from "@/types";

/**
 * POST /api/admin/reports/print — manda un reporte a la impresora de CAJA. Solo ADMIN.
 *
 * Dos formas de body:
 *  - { kind: "ventas", sub, range?, from?, to?, cashSessionId? }: el reporte de ventas
 *    se ARMA EN EL SERVIDOR (misma agregación que la pantalla), para que el papel sea
 *    evidencia y no un texto que el cliente pudo inventar. Lleva la cabecera de reporte
 *    del sistema.
 *  - { kind: "pantalla", text } (o { text } sin kind, por compatibilidad): imprime el
 *    texto que arma el cliente (Cierres e Historial, cuya evidencia vive en otro lado),
 *    marcado como reporte de pantalla para que nunca se confunda con un documento del
 *    sistema. El límite MAX se comprueba con la cabecera ya incluida.
 */

const MAX = 4000;
const REPORT_SUBS: ReportSub[] = ["todo", "producto", "menus", "secciones", "meseros"];
const mxStamp = () => new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

export async function POST(request: NextRequest) {
  const a = await requireAdminSession(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 403 });
  if (a.staffId == null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario admin no está vinculado a un empleado (Staff)" }, { status: 409 });
  }

  const staff = await prisma.staff.findUnique({ where: { id: a.staffId }, select: { fullName: true } });
  const quien = staff?.fullName ?? "—";
  const body = await request.json().catch(() => ({}));

  let text: string;
  if (body?.kind === "ventas") {
    const sub = body?.sub as ReportSub;
    if (!REPORT_SUBS.includes(sub)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Vista de reporte inválida" }, { status: 400 });
    }
    // Reconstruye los searchParams del rango en el servidor y rearma las cifras.
    const sp = new URLSearchParams();
    for (const k of ["range", "from", "to", "cashSessionId"] as const) {
      const v = body?.[k];
      if (v != null && v !== "") sp.set(k, String(v));
    }
    const { data, rangeLabel } = await buildReportData(sp);
    if (!subHasRows(data, sub)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Esa vista no tiene datos en el rango" }, { status: 409 });
    }
    const cuerpo = reportToTicketText(data, rangeLabel, sub);
    text = `*** REPORTE DEL SISTEMA ***\nGenerado por ${quien} · ${mxStamp()}\n\n${cuerpo}`;
  } else {
    const raw = typeof body?.text === "string" ? body.text.trimEnd() : "";
    if (!raw) return NextResponse.json<ApiResponse>({ success: false, error: "No hay nada que imprimir" }, { status: 400 });
    text = `*** REPORTE DE PANTALLA ***\nGenerado por ${quien} · ${mxStamp()}\n\n${raw}`;
  }

  if (text.length > MAX) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `El reporte es demasiado largo para el ticket (${text.length} de ${MAX} caracteres). Acota el rango o expórtalo a hoja de cálculo.` },
      { status: 400 },
    );
  }

  // pre: el reporte llega con sus columnas ya alineadas y su propio encabezado.
  // cols: el ancho en el que se armó, para que el puente lo centre si la impresora es más ancha.
  const id = await enqueueMessage({
    staffId: a.staffId, area: "CAJA", text, fromName: quien,
    pre: true, cols: TICKET_COLS,
  });

  return NextResponse.json<ApiResponse>({ success: true, data: { id } });
}
