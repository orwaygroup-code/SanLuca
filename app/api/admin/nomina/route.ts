import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";
import { TENANT } from "@/lib/comanda";
import { currentSalary, netPay } from "@/lib/payroll";
import type { ApiResponse } from "@/types";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Guard de nómina: ADMIN + Staff ligado con `payrollAccess: true`. Devuelve el staffId del
 * actor (para `createdById`) o null si no tiene acceso. Local a nómina; lo usan los 3 handlers.
 */
export async function requirePayroll(request: NextRequest): Promise<number | null> {
  const a = await requireAdminSession(request);
  if (!a || a.staffId == null) return null;
  const staff = await prisma.staff.findUnique({ where: { id: a.staffId }, select: { payrollAccess: true } });
  return staff?.payrollAccess ? a.staffId : null;
}

/**
 * GET /api/admin/nomina — una fila por empleado activo (menos el sistema "llevar") con su
 * sueldo VIGENTE, su crédito pendiente y el neto. Más `totals` (las tres sumas excluyen a
 * quien no tiene sueldo; por eso va `sinSueldo`). Solo con payrollAccess. Decimal → Number.
 */
export async function GET(request: NextRequest) {
  const actorId = await requirePayroll(request);
  if (actorId == null) return NextResponse.json<ApiResponse>({ success: false, error: "No tienes acceso a nómina" }, { status: 403 });

  const staff = await prisma.staff.findMany({
    where: { tenantId: TENANT, active: true, username: { not: "llevar" } },
    orderBy: { fullName: "asc" },
    select: {
      id: true, fullName: true, username: true, role: true,
      salaries: { select: { id: true, amount: true, period: true, effectiveFrom: true, note: true } },
    },
  });

  const creditRows = await prisma.waiterCredit.groupBy({
    by: ["waiterId"],
    where: { tenantId: TENANT, status: "OUTSTANDING" },
    _sum: { amount: true },
  });
  const creditByStaff = new Map(creditRows.map((c) => [c.waiterId, Number(c._sum.amount ?? 0)]));

  let sinCreditoRestado = 0, creditos = 0, conCreditoRestado = 0, sinSueldo = 0;
  const rows = staff.map((s) => {
    const vig = currentSalary(s.salaries);
    const salary = vig
      ? { amount: Number(vig.amount), period: vig.period, effectiveFrom: vig.effectiveFrom.toISOString(), note: vig.note }
      : null;
    const credit = creditByStaff.get(s.id) ?? 0;
    const { net, carry } = netPay(salary ? salary.amount : 0, credit);
    if (salary) {
      sinCreditoRestado += salary.amount;
      creditos += credit;
      conCreditoRestado += net;
    } else {
      sinSueldo++;
    }
    return { id: s.id, fullName: s.fullName, username: s.username, role: s.role, salary, credit: r2(credit), net, carry };
  });

  const totals = {
    sinCreditoRestado: r2(sinCreditoRestado),
    creditos: r2(creditos),
    conCreditoRestado: r2(conCreditoRestado),
    sinSueldo,
  };

  return NextResponse.json<ApiResponse>({ success: true, data: { rows, totals } });
}
