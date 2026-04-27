import { prisma } from "./prisma";

/** Sum of unused credits matching email AND phone. */
export async function getAvailableCredit(email: string, phone: string): Promise<number> {
  const e = email.trim().toLowerCase();
  const p = phone.replace(/\D/g, "");
  if (!e || !p) return 0;

  const credits = await prisma.credit.findMany({
    where: {
      used: false,
      customerEmail: e,
      customerPhone: p,
    },
    select: { amount: true },
  });
  return credits.reduce((s, c) => s + c.amount, 0);
}

/**
 * Apply available credits to cover `amountNeeded`. Returns the actual amount
 * applied and marks consumed credits as used. Partial coverage is supported.
 */
export async function applyCreditsToReservation(
  email: string,
  phone: string,
  amountNeeded: number,
  reservationId: string
): Promise<number> {
  const e = email.trim().toLowerCase();
  const p = phone.replace(/\D/g, "");
  if (!e || !p || amountNeeded <= 0) return 0;

  const credits = await prisma.credit.findMany({
    where: { used: false, customerEmail: e, customerPhone: p },
    orderBy: { createdAt: "asc" },
  });

  let remaining = amountNeeded;
  let applied = 0;
  for (const c of credits) {
    if (remaining <= 0) break;
    if (c.amount <= remaining) {
      // consume entirely
      await prisma.credit.update({
        where: { id: c.id },
        data: {
          used: true,
          appliedReservationId: reservationId,
          usedAt: new Date(),
        },
      });
      remaining -= c.amount;
      applied += c.amount;
    } else {
      // split: mark the existing as used and create remainder
      await prisma.credit.update({
        where: { id: c.id },
        data: {
          used: true,
          amount: remaining,
          appliedReservationId: reservationId,
          usedAt: new Date(),
        },
      });
      const leftover = c.amount - remaining;
      await prisma.credit.create({
        data: {
          customerEmail: c.customerEmail,
          customerPhone: c.customerPhone,
          amount: leftover,
          source: c.source,
          originReservationId: c.originReservationId,
          notes: "Sobrante tras aplicación parcial",
        },
      });
      applied += remaining;
      remaining = 0;
    }
  }
  return applied;
}

/**
 * Create a credit when a paid reservation is cancelled. The credit equals the
 * actual amount paid (after deducting any credit already applied).
 */
export async function createCreditFromCancelledReservation(reservationId: string) {
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { payment: true },
  });
  if (!r) return null;
  // Effective cash paid = payment.amount (does NOT include creditUsed)
  const cashPaid = r.payment?.amount ?? 0;
  if (cashPaid <= 0) return null;

  const email = r.payment?.customerEmail || "";
  const phone = r.payment?.customerPhone || r.guestPhone.replace(/\D/g, "");
  if (!email || !phone) return null;

  return prisma.credit.create({
    data: {
      customerEmail: email.toLowerCase(),
      customerPhone: phone,
      amount: cashPaid,
      source: "cancelled_reservation",
      originReservationId: reservationId,
      notes: `Cancelación de reserva ${reservationId}`,
    },
  });
}
