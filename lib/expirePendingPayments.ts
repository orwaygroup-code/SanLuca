import { prisma } from "./prisma";

/**
 * Cancel any PENDING_PAYMENT reservation whose hold window has passed.
 * Called lazily before any availability lookup or reservation creation
 * so expired holds release their tables without needing a cron job.
 */
export async function expirePendingPayments() {
  await prisma.reservation.updateMany({
    where: {
      status: "PENDING_PAYMENT",
      expiresAt: { lt: new Date() },
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "Expiró sin pago",
    },
  });
}
