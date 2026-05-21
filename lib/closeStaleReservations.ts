// lib/closeStaleReservations.ts
// Cierra reservaciones que ya pasaron pero quedaron en estado activo.
// Una reserva se considera "stale" si su fecha es anterior al inicio del
// día actual en hora de México (UTC-6), independientemente de si fue
// confirmada o no manualmente.

import { prisma } from "@/lib/prisma";
import { reEvalUserRule } from "@/lib/tagRules";

const MX_TZ = "America/Mexico_City";

/**
 * Reglas de cierre automático al pasar el día:
 *
 * - IN_PROGRESS, DELAYED                    → COMPLETED  (el cliente estuvo)
 * - PENDING, CONFIRMED con checkedInAt     → COMPLETED  (hubo check-in pero
 *                                                         nadie cerró la mesa)
 * - PENDING, CONFIRMED sin checkedInAt     → NO_SHOW    (nunca llegaron)
 *
 * Las reservas en PENDING_PAYMENT, CANCELLED, COMPLETED, NO_SHOW no se tocan.
 *
 * Retorna el conteo de reservaciones cerradas en cada categoría.
 */
export async function closeStaleReservations(): Promise<{
  completed: number;
  noShow:    number;
}> {
  // Inicio del día actual en hora de México (UTC-6 fijo, sin DST desde 2023)
  const nowUTC = new Date();
  const mxDateStr = nowUTC.toLocaleDateString("en-CA", { timeZone: MX_TZ }); // "YYYY-MM-DD"
  const cutoff = new Date(`${mxDateStr}T00:00:00.000-06:00`);

  // Para el trigger de auto-tagging (VIP) necesitamos los userIds de las
  // reservas que pasan a COMPLETED. Hacemos findMany → updateMany para
  // capturarlos sin pagar N+1 (las 4 queries siguen siendo bulk).
  // Las NO_SHOW no afectan VIP (no cuentan como completadas).
  const [stale1, stale2] = await Promise.all([
    prisma.reservation.findMany({
      where:  { date: { lt: cutoff }, status: { in: ["IN_PROGRESS", "DELAYED"] } },
      select: { id: true, userId: true },
    }),
    prisma.reservation.findMany({
      where:  { date: { lt: cutoff }, status: { in: ["PENDING", "CONFIRMED"] }, checkedInAt: { not: null } },
      select: { id: true, userId: true },
    }),
  ]);

  const [c1, c2, ns] = await Promise.all([
    stale1.length > 0
      ? prisma.reservation.updateMany({
          where: { id: { in: stale1.map((r) => r.id) } },
          data:  { status: "COMPLETED" },
        })
      : Promise.resolve({ count: 0 }),
    stale2.length > 0
      ? prisma.reservation.updateMany({
          where: { id: { in: stale2.map((r) => r.id) } },
          data:  { status: "COMPLETED" },
        })
      : Promise.resolve({ count: 0 }),
    prisma.reservation.updateMany({
      where: {
        date:        { lt: cutoff },
        status:      { in: ["PENDING", "CONFIRMED"] },
        checkedInAt: null,
      },
      data: {
        status:       "NO_SHOW",
        cancelledAt:  nowUTC,
        cancelReason: "Auto-cierre fin de día",
      },
    }),
  ]);

  // Triggers fire-and-forget de VIP por cada user que recibió un COMPLETED
  // nuevo. Deduplicar por userId para no spamear con la misma re-eval.
  const completedUserIds = new Set<string>();
  for (const r of [...stale1, ...stale2]) {
    if (r.userId) completedUserIds.add(r.userId);
  }
  for (const userId of completedUserIds) {
    reEvalUserRule(userId, "VIP").catch((e) =>
      console.error("[AUTO_TAG] reEval VIP failed (close-day):", e),
    );
  }

  return {
    completed: c1.count + c2.count,
    noShow:    ns.count,
  };
}
