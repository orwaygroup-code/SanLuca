// lib/closeStaleReservations.ts
// Cierra reservaciones que ya pasaron pero quedaron en estado activo.
// Una reserva se considera "stale" si su fecha es anterior al inicio del
// día actual en hora de México (UTC-6), independientemente de si fue
// confirmada o no manualmente.

import { prisma } from "@/lib/prisma";

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

  const [c1, c2, ns] = await Promise.all([
    // Walk-ins / clientes que estuvieron pero no se cerró la mesa
    prisma.reservation.updateMany({
      where: {
        date:   { lt: cutoff },
        status: { in: ["IN_PROGRESS", "DELAYED"] },
      },
      data: { status: "COMPLETED" },
    }),
    // Check-in registrado pero nunca pasó a COMPLETED
    prisma.reservation.updateMany({
      where: {
        date:        { lt: cutoff },
        status:      { in: ["PENDING", "CONFIRMED"] },
        checkedInAt: { not: null },
      },
      data: { status: "COMPLETED" },
    }),
    // No se presentaron
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

  return {
    completed: c1.count + c2.count,
    noShow:    ns.count,
  };
}
