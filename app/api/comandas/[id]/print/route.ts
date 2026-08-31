import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor, isSupervisor } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { resolveReprintAuthorizer, REPRINT_AUTHORIZER_ROLES } from "@/lib/comandaRules";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import { FISCAL, FACTURA_URL } from "@/lib/fiscal";
import { numeroALetras } from "@/lib/numeroLetras";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

type TicketLine = { qty: number; name: string; unit: number; total: number };
// Junta renglones idénticos (mismo platillo y precio) en el TICKET DE CLIENTE: suma la
// cantidad y el importe. Las comandas de cocina NO usan esto — ahí cada platillo va
// suelto porque puede llevar indicaciones/separación distintas.
function mergeLines(lines: TicketLine[]): TicketLine[] {
  const map = new Map<string, TicketLine>();
  for (const l of lines) {
    const key = `${l.name}@@${l.unit}`;
    const ex = map.get(key);
    if (ex) {
      ex.qty = Math.round((ex.qty + l.qty) * 100) / 100;
      ex.total = Math.round((ex.total + l.total) * 100) / 100;
    } else {
      map.set(key, { ...l });
    }
  }
  return [...map.values()];
}

/**
 * POST /api/comandas/:id/print — imprime ticket(s) de cliente (target CAJA).
 * Regla 1-print: la primera la hace el WAITER (de su comanda); una vez impreso
 * un CUSTOMER_FINAL, solo CAPTAIN/MANAGER puede reimprimir con authorizationReason.
 * Body: { authorizationReason?, authPin? }
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
      id: true, waiterId: true, folio: true, guestsActual: true, openedAt: true,
      subtotal: true, taxAmount: true, total: true, discountTotal: true,
      customName: true,
      waiter: { select: { fullName: true } },
      table: { select: { number: true, section: { select: { name: true } } } },
      items: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, quantity: true, unitPriceSnapshot: true, lineTotal: true, status: true, dishNameSnapshot: true },
      },
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
  // Quién autoriza la reimpresión: el supervisor en sesión, o el que tecleó su
  // PIN. Se guarda aparte de executedById para que la auditoría distinga quién
  // imprimió de quién lo permitió.
  let reprintAuthorizedById: number | null = null;
  if (!alreadyPrinted) {
    const canFirst = isOwnerWaiter || actor.role === "OPERATION" || supervisor;
    if (!canFirst) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Solo puedes imprimir tickets de tus comandas" }, { status: 403 });
    }
    printType = "CUSTOMER_FINAL";
  } else {
    // Reimpresión. La autoriza un Capitán o Manager por una de dos vías: o es
    // quien tiene la sesión abierta, o teclea su PIN sin cambiar de usuario.
    //
    // La segunda existe porque quien está frente a la impresora es el cajero
    // (OPERATION). Exigirle que cierre sesión para que un supervisor entre a
    // autorizar un papel es la clase de fricción que termina en que nadie
    // reimprime y se resuelve a mano. Es el mismo override que ya usan
    // descuentos, reapertura, traspasos y cancelaciones.
    const authPin = typeof body?.authPin === "string" ? body.authPin.trim() : "";
    const auth = resolveReprintAuthorizer({
      // isSupervisor y isReprintAuthorizer cubren el mismo conjunto
      // (ADMIN, CAPTAIN, MANAGER), así que basta con pasar el rol tal cual.
      operatorRole: actor.role,
      operatorStaffId: actor.staffId,
      pinProvided: authPin.length > 0,
      pinAuthorizedId: authPin
        ? await verifySupervisorPin(authPin, { tenantId: TENANT, roles: [...REPRINT_AUTHORIZER_ROLES] })
        : null,
    });
    if (!auth.ok) return NextResponse.json<ApiResponse>({ success: false, error: auth.error }, { status: auth.status });
    reprintAuthorizedById = auth.authorizedById;
    if (!authorizationReason || !authorizationReason.trim()) {
      return NextResponse.json<ApiResponse>({ success: false, error: "authorizationReason es obligatorio para reimprimir" }, { status: 400 });
    }
    printType = "CUSTOMER_REPRINT";
  }

  // #9 (crítico): no imprimir la cuenta con productos aún "Por enviar" (PENDING). Nunca
  // llegaron a cocina y se estarían cobrando como si se hubieran entregado. Hay que enviarlos
  // a cocina o quitarlos antes de imprimir. (La reimpresión no aplica: ya se envió todo.)
  if (printType === "CUSTOMER_FINAL" && comanda.items.some((i) => i.status === "PENDING")) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Hay productos por enviar a cocina. Envíalos o quítalos antes de imprimir la cuenta." }, { status: 409 });
  }

  const isReprint = printType === "CUSTOMER_REPRINT";
  const common = {
    tenantId: TENANT,
    comandaId: id,
    type: printType,
    target: "CAJA" as const,
    executedById: actor.staffId,
    authorizedById: isReprint ? reprintAuthorizedById : null,
    authorizationReason: isReprint ? authorizationReason : null,
  };

  // Snapshot listo-para-imprimir del ticket de cliente → lo consume el PrintBridge.
  const tableLabel = comanda.table ? `Mesa ${comanda.table.number} - ${comanda.table.section.name}` : (comanda.customName || "Cuenta sin mesa");
  const nowIso = new Date().toISOString();
  const lines = mergeLines(comanda.items.map((i) => ({
    qty: Number(i.quantity), name: i.dishNameSnapshot, unit: Number(i.unitPriceSnapshot), total: Number(i.lineTotal),
  })));
  await prisma.comandaPrint.create({
    data: {
      ...common,
      ticketsPrinted: 1,
      status: "PENDING",
      payload: {
        kind: "customer", fiscal: FISCAL, folio: comanda.folio, table: tableLabel,
        waiter: comanda.waiter?.fullName ?? "", guests: comanda.guestsActual, orden: comanda.id,
        opened: comanda.openedAt.toISOString(), time: nowIso,
        reprint: isReprint, ticketNumber: null, items: lines,
        subtotal: Number(comanda.subtotal), tax: Number(comanda.taxAmount), total: Number(comanda.total),
        // #11: descuento a la cuenta visible en el ticket. `gross` = suma bruta de líneas
        // (antes de descuento) para anclar el renglón "Descuento" y calcular el %.
        discount: Number(comanda.discountTotal), gross: +lines.reduce((s, l) => s + l.total, 0).toFixed(2),
        importeLetra: numeroALetras(Number(comanda.total)),
        factura: { url: FACTURA_URL, folio: comanda.folio },
      },
    },
  });

  // El cajón NO se abre al imprimir la cuenta: solo al COBRAR efectivo (ver pay/route.ts),
  // en corte, en movimientos de dinero y con el botón manual de caja.
  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
