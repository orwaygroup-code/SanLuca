import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import {
  TENANT,
  ACTIVE_STATUSES,
  COMANDA_INCLUDE,
  settleComanda,
  completeLinkedReservation,
  enqueueDrawerKick,
  EMPLOYEE_DISCOUNT_REASON,
} from "@/lib/comanda";
import { billHasVigentTicket } from "@/lib/comandaRules";
import { round2 } from "@/lib/comandaTotals";
import { getOpenSession, computePaymentOutcome, PAY_EPS } from "@/lib/caja";
import { verifyWaiterPin, verifySupervisorPin } from "@/lib/staff";
import { allow, reset } from "@/lib/rateLimit";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const METHODS = ["CASH", "CARD_DEBIT", "CARD_CREDIT", "TRANSFER", "WAITER_CREDIT"] as const;
type Method = (typeof METHODS)[number];

interface PayLine {
  method: Method;
  amount: number; // porción del total que salda este pago
  received: number | null; // efectivo entregado (solo CASH)
  changeGiven: number;
  tip: number;
  reference: string | null;
  splitTicketNumber: number | null;
}

/**
 * POST /api/comandas/:id/pay — cobra una comanda. requireCashier + turno OPEN.
 * Soporta pago MIXTO (varias líneas) y PARCIAL (Σ < total). Body:
 *   { payments: [{ method, amount, received?, tip?, reference?, splitTicketNumber? }] }
 * - amount = porción aplicada al total (NUNCA excede el saldo). received = efectivo
 *   entregado; changeGiven = received − amount. tip NO cuenta al total.
 * - Si amountPaid ≥ total → PAID + settleComanda (libera mesa, completa reserva).
 *   Si no → PARTIALLY_PAID (sigue ocupando la mesa).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja (Operación/Capitán/Manager)" }, { status: 403 });
  if (a.staffId == null) return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const session = await getOpenSession();
  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Abre un turno de caja antes de cobrar" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const rawLines: unknown[] = Array.isArray(body?.payments) ? body.payments : [];
  if (rawLines.length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Sin líneas de pago" }, { status: 400 });
  }

  // ── Validación y normalización de cada línea de pago ──────────────────────
  const lines: PayLine[] = [];
  for (const raw of rawLines) {
    const p = raw as Record<string, unknown>;
    const method = p?.method as Method;
    if (!METHODS.includes(method)) {
      return NextResponse.json<ApiResponse>({ success: false, error: `Método de pago inválido: ${String(p?.method)}` }, { status: 400 });
    }
    const amount = round2(Number(p?.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Monto de pago inválido" }, { status: 400 });
    }
    const tip = p?.tip != null ? round2(Number(p.tip)) : 0;
    if (!Number.isFinite(tip) || tip < 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Propina inválida" }, { status: 400 });
    }
    let received: number | null = null;
    let changeGiven = 0;
    if (method === "CASH" && p?.received != null) {
      received = round2(Number(p.received));
      if (!Number.isFinite(received) || received < amount - PAY_EPS) {
        return NextResponse.json<ApiResponse>({ success: false, error: "Efectivo recibido menor al monto a cobrar" }, { status: 400 });
      }
      changeGiven = round2(Math.max(0, received - amount));
    }
    const reference = typeof p?.reference === "string" ? p.reference.slice(0, 60) : null;
    const splitTicketNumber = Number.isInteger(p?.splitTicketNumber) ? (p.splitTicketNumber as number) : null;
    lines.push({ method, amount, received, changeGiven, tip, reference, splitTicketNumber });
  }

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: {
      id: true, status: true, total: true, amountPaid: true, tipTotal: true, chargedEmployeeId: true, employeeChargeStatus: true,
      prints: { select: { type: true, printedAt: true } },
      reopens: { orderBy: { reopenedAt: "desc" }, take: 1, select: { reopenedAt: true } },
    },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede cobrar` }, { status: 409 });
  }

  // No cobrar sin un ticket de cliente VIGENTE (posterior a la última reapertura):
  // mismo criterio que /print (billHasVigentTicket). Tras reabrir hay que reimprimir.
  if (!billHasVigentTicket(comanda.prints, comanda.reopens[0]?.reopenedAt)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Imprime la cuenta antes de cobrar" }, { status: 409 });
  }

  // Guarda del descuento de empleado: ese descuento solo es válido cobrado a crédito
  // de personal. Si la cuenta lo trae y ninguna línea de pago es WAITER_CREDIT, se
  // rechaza — cierra el hueco de cobrar el 50% en efectivo cuando la cajera abandonó
  // el panel de crédito dejando el descuento pegado en la base.
  const empDisc = await prisma.comandaDiscount.findFirst({
    where: { comandaId: id, tenantId: TENANT, scope: "BILL", reason: { startsWith: EMPLOYEE_DISCOUNT_REASON } },
    select: { id: true },
  });
  if (empDisc && !lines.some((l) => l.method === "WAITER_CREDIT")) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "La cuenta tiene descuento de empleado. Cóbrala por crédito de personal, o retira el descuento eligiendo al empleado y pulsando \"cambiar\"." },
      { status: 409 },
    );
  }

  const total = round2(Number(comanda.total));
  const alreadyPaid = round2(Number(comanda.amountPaid));
  const outcome = computePaymentOutcome(total, alreadyPaid, lines);
  if (outcome.remaining <= 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "La cuenta ya está saldada" }, { status: 409 });
  }
  if (outcome.overpay) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `El pago ($${outcome.sumAmount.toFixed(2)}) excede el saldo ($${outcome.remaining.toFixed(2)})` },
      { status: 400 },
    );
  }

  // El desenlace final se fija DENTRO de la transacción, con la comanda fresca
  // (candado optimista). Estos valores externos son solo el arranque/respaldo.
  let settled = false;
  let finalAmountPaid = outcome.newAmountPaid;
  let finalRemaining = outcome.newRemaining;

  // Crédito de mesero: si hay una línea WAITER_CREDIT, la autoriza el PROPIO mesero
  // deudor con su PIN (puede no ser quien atiende). Perla ya está autorizada (requireCashier).
  const creditLines = lines.filter((l) => l.method === "WAITER_CREDIT");
  let creditWaiterId: number | null = null;
  if (creditLines.length > 0) {
    creditWaiterId = Number(body?.creditWaiterId);
    const pin = typeof body?.creditWaiterPin === "string" ? body.creditWaiterPin : "";
    if (!Number.isInteger(creditWaiterId) || creditWaiterId <= 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Elige el mesero al que se le carga el crédito" }, { status: 400 });
    }
    const waiter = await prisma.staff.findFirst({ where: { id: creditWaiterId, tenantId: TENANT, active: true }, select: { id: true } });
    if (!waiter) return NextResponse.json<ApiResponse>({ success: false, error: "Mesero no encontrado o inactivo" }, { status: 404 });
    if (comanda.chargedEmployeeId != null) {
      // #4 Cuenta LIGADA: el crédito solo puede ir a ese empleado y solo si ya la aprobó en su
      // cartera. Esa aprobación (con PIN, ya registrada) ES la autorización — no se pide PIN otra
      // vez aquí, así el empleado no tiene que estar en caja al momento de cobrar.
      if (creditWaiterId !== comanda.chargedEmployeeId) {
        return NextResponse.json<ApiResponse>({ success: false, error: "Esta cuenta está ligada a otro empleado; el crédito debe ir a ese empleado" }, { status: 409 });
      }
      if (comanda.employeeChargeStatus !== "APPROVED") {
        return NextResponse.json<ApiResponse>({ success: false, error: "El empleado aún no aprueba esta cuenta. Debe palomearla en su cartera antes de cobrarla a crédito." }, { status: 409 });
      }
    } else {
      // Crédito ad-hoc (sin ligar): el empleado deudor lo autoriza con su PIN aquí mismo.
      if (!allow(`waiter-pin:${creditWaiterId}`, 5, 15 * 60_000)) {
        return NextResponse.json<ApiResponse>({ success: false, error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
      }
      if (!(await verifyWaiterPin(creditWaiterId, pin))) {
        return NextResponse.json<ApiResponse>({ success: false, error: "PIN del mesero incorrecto" }, { status: 403 });
      }
      reset(`waiter-pin:${creditWaiterId}`);
    }
  }

  // Opción "no contar el punto (7%)" para esta venta: la autoriza un supervisor con su
  // PIN (queda registrado quién). Excluye la venta de la base del 7% del mesero.
  const wantExcludeTip = body?.excludeTipPoint === true;
  let tipPointExcludedById: number | null = null;
  if (wantExcludeTip) {
    const tipPin = typeof body?.tipPin === "string" ? body.tipPin : "";
    if (!allow(`sup-pin:${a.staffId}`, 5, 15 * 60_000)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }
    tipPointExcludedById = await verifySupervisorPin(tipPin, { tenantId: TENANT });
    if (!tipPointExcludedById) {
      return NextResponse.json<ApiResponse>({ success: false, error: "PIN de supervisor inválido para excluir el punto" }, { status: 403 });
    }
    reset(`sup-pin:${a.staffId}`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Se relee la comanda DENTRO de la transacción: el saldo pudo cambiar entre
      // la validación temprana y aquí (doble toque en la tablet, reintento por red
      // lenta). El outcome se recalcula sobre esos valores frescos y la escritura
      // es CONDICIONAL a ellos (candado optimista): dos cobros concurrentes no
      // pueden saldar dos veces la misma cuenta ni dejarla con dos pagos y un total.
      const fresh = await tx.comanda.findFirst({
        where: { id, tenantId: TENANT },
        select: { status: true, total: true, amountPaid: true, tipTotal: true },
      });
      if (!fresh) throw Object.assign(new Error("Comanda no encontrada"), { httpStatus: 404 });
      const freshOutcome = computePaymentOutcome(round2(Number(fresh.total)), round2(Number(fresh.amountPaid)), lines);
      if (freshOutcome.overpay) throw Object.assign(new Error("El pago excede el saldo"), { httpStatus: 409 });

      await tx.comandaPayment.createMany({
        data: lines.map((l) => ({
          tenantId: TENANT,
          comandaId: id,
          cashSessionId: session.id,
          method: l.method,
          amount: l.amount,
          received: l.received,
          changeGiven: l.changeGiven,
          tip: l.tip,
          reference: l.reference,
          splitTicketNumber: l.splitTicketNumber,
          receivedById: a.staffId as number,
        })),
      });

      // Registra la(s) cuenta(s) por cobrar del mesero (se salda al descontar nómina).
      if (creditLines.length > 0 && creditWaiterId) {
        await tx.waiterCredit.createMany({
          data: creditLines.map((l) => ({
            tenantId: TENANT,
            waiterId: creditWaiterId as number,
            comandaId: id,
            cashSessionId: session.id,
            amount: l.amount,
            authorizedById: a.staffId as number,
          })),
        });
      }

      const upd = await tx.comanda.updateMany({
        where: { id, amountPaid: fresh.amountPaid }, // ← candado optimista
        data: {
          amountPaid: freshOutcome.newAmountPaid,
          tipTotal: round2(Number(fresh.tipTotal) + freshOutcome.sumTip),
          ...(wantExcludeTip ? { excludeTipPoint: true, tipPointExcludedById } : {}),
          ...(freshOutcome.settled ? {} : { status: "PARTIALLY_PAID", cashSessionId: session.id }),
        },
      });
      if (upd.count === 0) throw Object.assign(new Error("La cuenta cambió durante el cobro. Vuelve a intentarlo."), { httpStatus: 409 });

      if (freshOutcome.settled) await settleComanda(tx, id, a.staffId as number, session.id);

      settled = freshOutcome.settled;
      finalAmountPaid = freshOutcome.newAmountPaid;
      finalRemaining = freshOutcome.newRemaining;
    });
  } catch (e) {
    const httpStatus =
      typeof e === "object" && e !== null && typeof (e as { httpStatus?: unknown }).httpStatus === "number"
        ? (e as { httpStatus: number }).httpStatus
        : 500;
    const message = httpStatus === 500 ? "No se pudo procesar el cobro"
                  : e instanceof Error ? e.message : "No se pudo procesar el cobro";
    if (httpStatus === 500) console.error("[pay] transacción falló", e);
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: httpStatus });
  }

  if (settled) await completeLinkedReservation(id);

  // Abre el cajón cuando el cobro incluyó EFECTIVO (para dar cambio). Con tarjeta
  // o transferencia no se abre. Fire-and-forget: no estorba si el bridge está caído.
  if (lines.some((l) => l.method === "CASH")) await enqueueDrawerKick({ staffId: a.staffId as number, comandaId: id });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      comanda: updated,
      settled,
      amountPaid: finalAmountPaid,
      remaining: finalRemaining,
      changeGiven: outcome.changeTotal,
    },
  });
}
