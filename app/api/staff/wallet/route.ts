import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { TENANT } from "@/lib/comanda";
import { normalizePolicy, computeDeduction } from "@/lib/tips";
import type { ApiResponse } from "@/types";

const MX_TZ = "America/Mexico_City";
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/staff/wallet — cartera del EMPLEADO logueado:
 * - Créditos: sus cuentas a crédito (consumo que paga después / se descuenta de nómina).
 * - Propinas de HOY: registradas en caja (Σ tip de sus comandas) + las de efectivo que él
 *   mismo registró (WaiterCashTip, no declaradas a caja). Solo lectura de lo propio.
 */
export async function GET(request: NextRequest) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ }).format(new Date());
  const todayStart = new Date(`${today}T00:00:00.000-06:00`);

  const [credits, tipAgg, cashRows, settings, salesAgg] = await Promise.all([
    prisma.waiterCredit.findMany({
      where: { tenantId: TENANT, waiterId: s.staffId },
      select: { id: true, amount: true, status: true, note: true, createdAt: true, paidAt: true, comanda: { select: { folio: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.comandaPayment.aggregate({
      where: { tenantId: TENANT, voided: false, createdAt: { gte: todayStart }, comanda: { waiterId: s.staffId } },
      _sum: { tip: true },
    }),
    prisma.waiterCashTip.findMany({
      where: { tenantId: TENANT, waiterId: s.staffId, createdAt: { gte: todayStart } },
      select: { id: true, amount: true, note: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.restaurantSettings.findUnique({ where: { tenantId: TENANT }, select: { tipPolicy: true } }),
    prisma.comanda.aggregate({
      // Base del punto: ventas PAGADAS del mesero hoy (excluye las marcadas sin punto).
      where: { tenantId: TENANT, waiterId: s.staffId, status: "PAID", excludeTipPoint: false, closedAt: { gte: todayStart } },
      _sum: { total: true },
    }),
  ]);

  const pending = credits.filter((c) => c.status === "OUTSTANDING").reduce((sum, c) => sum + Number(c.amount), 0);
  const tipsRegistered = round(Number(tipAgg._sum.tip ?? 0));
  const cashTips = round(cashRows.reduce((acc, c) => acc + Number(c.amount), 0));
  const tipsTotal = round(tipsRegistered + cashTips);
  // Puntos: el % de venta que el mesero aporta al pool (misma base que la liquidación).
  // Neto = propinas − puntos = lo que efectivamente le queda al mesero.
  const pointPercent = normalizePolicy(settings?.tipPolicy).pointPercent;
  const salesToday = round(Number(salesAgg._sum.total ?? 0));
  const puntos = computeDeduction(salesToday, pointPercent);
  const neto = round(tipsTotal - puntos);

  const data = {
    pending: round(pending),
    credits: credits.map((c) => ({
      id: c.id, amount: Number(c.amount), status: c.status, note: c.note,
      folio: c.comanda?.folio ?? null,
      createdAt: c.createdAt.toISOString(), paidAt: c.paidAt ? c.paidAt.toISOString() : null,
    })),
    tips: {
      registered: tipsRegistered,
      cash: cashTips,
      total: tipsTotal,
      salesToday,
      pointPercent,
      puntos,
      neto,
      cashList: cashRows.map((c) => ({ id: c.id, amount: Number(c.amount), note: c.note, createdAt: c.createdAt.toISOString() })),
    },
  };
  return NextResponse.json<ApiResponse>({ success: true, data });
}
