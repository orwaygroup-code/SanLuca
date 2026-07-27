import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import {
  TENANT,
  ACTIVE_STATUSES,
  COMANDA_INCLUDE,
  settleComanda,
  completeLinkedReservation,
} from "@/lib/comanda";
import { round2 } from "@/lib/comandaTotals";
import { getOpenSession, computePaymentOutcome, PAY_EPS } from "@/lib/caja";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const METHODS = ["CASH", "CARD_DEBIT", "CARD_CREDIT", "TRANSFER"] as const;
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
    select: { id: true, status: true, total: true, amountPaid: true, tipTotal: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!ACTIVE_STATUSES.includes(comanda.status as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede cobrar` }, { status: 409 });
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

  const newAmountPaid = outcome.newAmountPaid;
  const newTipTotal = round2(Number(comanda.tipTotal) + outcome.sumTip);
  const settled = outcome.settled;

  await prisma.$transaction(async (tx) => {
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

    await tx.comanda.update({
      where: { id },
      data: {
        amountPaid: newAmountPaid,
        tipTotal: newTipTotal,
        ...(settled ? {} : { status: "PARTIALLY_PAID", cashSessionId: session.id }),
      },
    });

    if (settled) await settleComanda(tx, id, a.staffId as number, session.id);
  });

  if (settled) await completeLinkedReservation(id);

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      comanda: updated,
      settled,
      amountPaid: newAmountPaid,
      remaining: outcome.newRemaining,
      changeGiven: outcome.changeTotal,
    },
  });
}
