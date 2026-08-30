import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TENANT } from "@/lib/comanda";
import { getSchedule } from "@/lib/schedule";
import { resolveShift } from "@/lib/shifts";
import { notify } from "@/lib/notify";
import type { ApiResponse } from "@/types";

/**
 * GET/POST /api/admin/jobs/shift-close — avisa a caja cuando un turno de caja
 * sigue abierto después de que ya cambió el turno de servicio.
 *
 * El problema que resuelve: el turno de brunch se quedaba corriendo hasta la
 * noche porque nadie cerraba caja al cambiar de turno, y las ventas de la
 * comida caían dentro del corte del brunch. Al pasar la hora de cambio —13:00
 * por configuración— este trabajo detecta el corte rezagado y lo recuerda.
 *
 * Pensado para correr por cron cada 15 minutos. Es idempotente y no acumula
 * avisos: si ya mandó el mismo en la última hora, no lo repite. Sin esa
 * guarda, un corte olvidado generaría cuatro avisos por hora hasta cerrarse.
 *
 * No cierra nada por su cuenta: el arqueo lo hace una persona contando el
 * dinero, y cerrar un turno sin contarlo dejaría un descuadre sin dueño.
 */

const AVISO_ROLES = ["OPERATION", "CAPTAIN", "MANAGER"];
const NO_REPETIR_MIN = 60;

async function yaAvisado(title: string, body: string): Promise<boolean> {
  const desde = new Date(Date.now() - NO_REPETIR_MIN * 60_000);
  const prev = await prisma.notification.findFirst({
    where: { tenantId: TENANT, title, body, createdAt: { gte: desde } },
    select: { id: true },
  });
  return !!prev;
}

async function run() {
  const cfg = await getSchedule();
  const now = new Date();
  const actual = resolveShift(now, cfg);

  const abiertas = await prisma.cashSession.findMany({
    where: { tenantId: TENANT, status: "OPEN" },
    select: { id: true, folio: true, shift: true, openedAt: true },
    orderBy: { openedAt: "asc" },
  });

  const avisos: { folio: string; motivo: string }[] = [];

  for (const s of abiertas) {
    // La ventana del turno en que se abrió el corte: si ya terminó, va tarde.
    const suyo = resolveShift(s.openedAt, cfg);
    const vencido = actual.start.getTime() > suyo.start.getTime();
    if (!vencido) continue;

    // Un corte de otro día es más grave: significa que nadie cerró en toda una
    // jornada y las ventas de hoy se están sumando al arqueo de ayer.
    const dias = Math.floor((now.getTime() - suyo.end.getTime()) / 86_400_000);
    const atrasado = dias >= 1;

    const title = atrasado ? "Corte de caja atrasado" : "Falta cerrar el turno";
    const body = atrasado
      ? `${s.folio} sigue abierto desde el turno «${suyo.name}» de hace ${dias === 1 ? "un día" : `${dias} días`}. Ciérralo: las ventas de hoy se están sumando a ese corte.`
      : `${s.folio} quedó abierto en el turno «${suyo.name}» y ya empezó «${actual.name}». Haz el corte para que las ventas no se mezclen.`;

    if (await yaAvisado(title, body)) continue;
    await notify({ roles: AVISO_ROLES, type: "turno", title, body, url: "/staff/operacion" });
    avisos.push({ folio: s.folio, motivo: atrasado ? "atrasado" : "turno vencido" });
  }

  return { turnoActual: actual.key, abiertas: abiertas.length, avisos };
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  // Misma cabecera y clave que close-day y auto-tag, para que el cron del VPS
  // no necesite un secreto distinto por trabajo.
  const key = request.headers.get("x-bot-key");
  if (!key || key !== process.env.BOT_API_KEY) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const data = await run();
  return NextResponse.json<ApiResponse>({ success: true, data });
}
