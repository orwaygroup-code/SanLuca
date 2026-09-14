import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMpPaymentById } from "@/lib/mercadopago";

/**
 * MercadoPago webhook receiver.
 * MP sends notifications with type=payment and data.id=<paymentId>.
 * We fetch the full payment, find the reservation by external_reference,
 * and update statuses accordingly.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);

    // MP can send the type via query param or body
    const type =
      url.searchParams.get("type") ||
      url.searchParams.get("topic") ||
      body?.type ||
      body?.topic ||
      "";

    const paymentId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      body?.data?.id ||
      body?.resource ||
      "";

    if (type !== "payment" || !paymentId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Idempotencia (el catch devuelve 500 y MP reintenta): si este pago ya está
    // approved y su reserva ya salió de PENDING_PAYMENT, el evento ya se procesó
    // por completo. No basta con "ya está approved": si la promoción de la reserva
    // falló tras escribir el pago, el reintento debe poder terminarla.
    const yaProcesado = await prisma.payment.findUnique({
      where: { mpPaymentId: String(paymentId) },
      select: { status: true, reservation: { select: { status: true } } },
    });
    if (yaProcesado?.status === "approved" && yaProcesado.reservation?.status !== "PENDING_PAYMENT") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const mpPayment = await getMpPaymentById(String(paymentId));
    const status = mpPayment.status || "unknown";
    const externalRef = mpPayment.external_reference;

    if (!externalRef) {
      console.warn("[mp-webhook] payment without external_reference", paymentId);
      return NextResponse.json({ ok: true });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: externalRef },
      include: { payment: true },
    });
    if (!reservation) {
      console.warn("[mp-webhook] reservation not found", externalRef);
      return NextResponse.json({ ok: true });
    }

    // Update / create Payment row linked to this reservation
    if (reservation.payment) {
      await prisma.payment.update({
        where: { id: reservation.payment.id },
        data: {
          mpPaymentId: String(paymentId),
          // No degradar: un webhook fuera de orden (p.ej. "pending" tras "approved")
          // no debe pisar un pago ya aprobado.
          status: reservation.payment.status === "approved" ? "approved" : status,
          rawData: mpPayment as object,
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          mpPaymentId: String(paymentId),
          amount: mpPayment.transaction_amount ?? 0,
          status,
          customerEmail: mpPayment.payer?.email ?? "",
          customerName:
            `${mpPayment.payer?.first_name ?? ""} ${mpPayment.payer?.last_name ?? ""}`.trim() ||
            reservation.guestName,
          customerPhone: reservation.guestPhone,
          reservationId: reservation.id,
          rawData: mpPayment as object,
        },
      });
    }

    // Promote reservation if payment was approved
    if (status === "approved") {
      // Validar el monto pagado contra el requerido ANTES de promover: un pago por
      // debajo del anticipo no confirma la reserva.
      const esperado = Number(reservation.payment?.amount ?? 0);
      const pagado = Number(mpPayment.transaction_amount ?? 0);
      if (esperado > 0 && pagado + 0.01 < esperado) {
        console.error("[mp-webhook] monto insuficiente", { externalRef, esperado, pagado });
        await prisma.payment.update({ where: { id: reservation.payment!.id }, data: { status: "underpaid" } });
        return NextResponse.json({ ok: true, underpaid: true });
      }
      if (reservation.status === "PENDING_PAYMENT") {
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: {
            status: "CONFIRMED",
            paymentStatus: "PAID",
            confirmedAt: new Date(),
            expiresAt: null,
            amountPaid: mpPayment.transaction_amount ?? 0,
          },
        });
      }
    } else if (status === "rejected" || status === "cancelled") {
      // leave the reservation to expire — do not auto-cancel here in case the
      // user retries with another payment method on the same MP checkout
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mp-webhook] error:", error);
    // 500 para que MercadoPago reintente: el handler es idempotente, así que un
    // reintento tras una caída transitoria termina la confirmación sin duplicar.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
