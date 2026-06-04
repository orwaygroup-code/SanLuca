import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor, isSupervisor } from "@/lib/dualAuth";
import { buildSplits } from "@/lib/comandaRules";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/print — imprime ticket(s) de cliente (target CAJA).
 * Regla 1-print: la primera la hace el WAITER (de su comanda); una vez impreso
 * un CUSTOMER_FINAL, solo CAPTAIN/MANAGER puede reimprimir con authorizationReason.
 * Body: { splits?: [{ itemIds: number[] }], authorizationReason? }
 * Si hay `splits`, se genera UN ComandaPrint por grupo (cada uno con su splitConfig).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
  if (actor.staffId == null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario admin no está vinculado a un empleado (Staff)" }, { status: 409 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: {
      id: true, waiterId: true,
      items: { where: { status: { not: "CANCELLED" } }, select: { id: true, lineTotal: true } },
      prints: { select: { type: true } },
    },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const authorizationReason: string | null = typeof body?.authorizationReason === "string" ? body.authorizationReason : null;
  const alreadyPrinted = comanda.prints.some((p) => p.type === "CUSTOMER_FINAL");

  // Decisión dual-realm de impresión (regla 1-print + reimpresión supervisada).
  const supervisor = isSupervisor(actor);
  const isOwnerWaiter = actor.realm === "staff" && actor.role === "WAITER" && comanda.waiterId === actor.staffId;
  let printType: "CUSTOMER_FINAL" | "CUSTOMER_REPRINT";
  if (!alreadyPrinted) {
    const canFirst = isOwnerWaiter || actor.role === "OPERATION" || supervisor;
    if (!canFirst) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Solo puedes imprimir tickets de tus comandas" }, { status: 403 });
    }
    printType = "CUSTOMER_FINAL";
  } else {
    if (!supervisor) {
      return NextResponse.json<ApiResponse>({ success: false, error: "La reimpresión la autoriza un Capitán/Manager/Admin" }, { status: 403 });
    }
    if (!authorizationReason || !authorizationReason.trim()) {
      return NextResponse.json<ApiResponse>({ success: false, error: "authorizationReason es obligatorio para reimprimir" }, { status: 400 });
    }
    printType = "CUSTOMER_REPRINT";
  }

  // Validar splits (si vienen) contra los items vivos de la comanda.
  const liveIds = new Set(comanda.items.map((i) => i.id));
  const totalById = new Map(comanda.items.map((i) => [i.id, Number(i.lineTotal)]));
  let splitTickets: { ticketNumber: number; itemIds: number[]; total: number }[] | null = null;

  if (Array.isArray(body?.splits) && body.splits.length > 0) {
    for (const g of body.splits) {
      if (!Array.isArray(g?.itemIds) || g.itemIds.some((x: unknown) => !liveIds.has(Number(x)))) {
        return NextResponse.json<ApiResponse>({ success: false, error: "splits contiene itemIds inválidos" }, { status: 400 });
      }
    }
    splitTickets = buildSplits(body.splits, totalById);
  }

  const isReprint = printType === "CUSTOMER_REPRINT";
  const common = {
    tenantId: TENANT,
    comandaId: id,
    type: printType,
    target: "CAJA" as const,
    executedById: actor.staffId,
    authorizedById: isReprint ? actor.staffId : null,
    authorizationReason: isReprint ? authorizationReason : null,
  };

  if (splitTickets) {
    // Un ComandaPrint por cada grupo de la división.
    await prisma.$transaction(
      splitTickets.map((t) =>
        prisma.comandaPrint.create({ data: { ...common, splitConfig: t, ticketsPrinted: 1 } }),
      ),
    );
  } else {
    await prisma.comandaPrint.create({ data: { ...common, splitConfig: undefined, ticketsPrinted: 1 } });
  }

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
