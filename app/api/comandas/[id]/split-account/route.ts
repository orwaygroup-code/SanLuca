import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCashier } from "@/lib/dualAuth";
import { verifySupervisorPin } from "@/lib/staff";
import { TENANT, COMANDA_INCLUDE, recalcComandaTotals, isEditableStatus, LOCKED_ACCOUNT_MSG } from "@/lib/comanda";
import { notify } from "@/lib/notify";
import { round2, lineTotal as calcLineTotal } from "@/lib/comandaTotals";
import { formatFolio, nextSplitLabel, canSplitAccount, REPRINT_AUTHORIZER_ROLES } from "@/lib/comandaRules";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

/**
 * POST /api/comandas/:id/split-account { units: [{itemId, quantity}], authPin }
 *
 * Divide una cuenta creando una cuenta HIJA con parte de sus productos. La hija
 * es una cuenta normal desde el primer momento: se le agrega, se imprime, se
 * cobra y se puede volver a dividir — de ahí que los nombres se aniden
 * ("14" → "14-1" → "14-1-1").
 *
 * No confundir con los `splits` de /print, que reparten UN ticket entre
 * comensales sin crear nada. Aquella es una forma de imprimir; esta parte la
 * mesa de verdad, y por eso pide PIN de Capitán o Manager.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireCashier(request);
  if (!a) return NextResponse.json<ApiResponse>({ success: false, error: "Solo Caja (Operación/Capitán/Manager)" }, { status: 403 });
  if (a.staffId == null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Tu usuario no está vinculado a un empleado (Staff)" }, { status: 409 });
  }

  const parentId = parseId(params.id);
  if (!parentId) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const rawUnits: unknown = body?.units;
  const units: { itemId: number; quantity: number }[] = Array.isArray(rawUnits)
    ? rawUnits
        .map((u: { itemId?: unknown; quantity?: unknown }) => ({
          itemId: Number(u?.itemId),
          quantity: round2(Number(u?.quantity)),
        }))
        .filter((u) => Number.isInteger(u.itemId) && u.itemId > 0 && u.quantity > 0)
    : [];
  if (units.length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Elige al menos un producto para la cuenta nueva" }, { status: 400 });
  }

  // La división la autoriza un Capitán o Manager, siempre y con PIN: mueve
  // dinero entre cuentas y cambia lo que cada comensal termina pagando.
  const authPin = typeof body?.authPin === "string" ? body.authPin.trim() : "";
  const authorizedById = await verifySupervisorPin(authPin, { tenantId: TENANT, roles: [...REPRINT_AUTHORIZER_ROLES] });
  if (!authorizedById) {
    return NextResponse.json<ApiResponse>({ success: false, error: "PIN de supervisor inválido (Capitán/Manager)" }, { status: 403 });
  }

  const parent = await prisma.comanda.findFirst({
    where: { id: parentId, tenantId: TENANT },
    select: {
      id: true, status: true, tableId: true, customName: true, splitLabel: true,
      waiterId: true, shift: true, guestsActual: true, channel: true,
      table: { select: { number: true } },
      items: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true, status: true, dishId: true, dishNameSnapshot: true, unitPriceSnapshot: true,
          prepAreaSnapshot: true, quantity: true, modifiers: true, modifiersExtraCost: true,
          kitchenNotes: true, discountAmount: true, course: true, addedById: true,
        },
      },
    },
  });
  if (!parent) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  if (!isEditableStatus(parent.status)) {
    return NextResponse.json<ApiResponse>({ success: false, error: LOCKED_ACCOUNT_MSG }, { status: 409 });
  }

  // Validar cada unidad pedida contra lo que de verdad hay en la cuenta.
  const byId = new Map(parent.items.map((i) => [i.id, i]));
  for (const u of units) {
    const item = byId.get(u.itemId);
    if (!item) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Un producto elegido no está en esta cuenta" }, { status: 400 });
    }
    const have = Number(item.quantity);
    // Igual que en el traspaso: el renglón va completo (aunque sea fraccional) o
    // se parte en una cantidad entera. No se fracciona una fracción.
    if (u.quantity > have || (!Number.isInteger(u.quantity) && u.quantity !== have)) {
      return NextResponse.json<ApiResponse>({ success: false, error: `Cantidad inválida en ${item.dishNameSnapshot} (1–${have})` }, { status: 400 });
    }
  }

  const totalUnits = parent.items.reduce((s, i) => s + Number(i.quantity), 0);
  const selectedUnits = units.reduce((s, u) => s + u.quantity, 0);
  const allowed = canSplitAccount({ totalUnits, selectedUnits });
  if (!allowed.ok) return NextResponse.json<ApiResponse>({ success: false, error: allowed.error }, { status: 400 });

  // Nombre de la hija. La base es la etiqueta de la cuenta actual: el número de
  // mesa la primera vez, y la propia etiqueta de división cuando se divide una
  // división — así el anidamiento sale solo.
  const baseLabel = parent.splitLabel
    ?? (parent.table ? String(parent.table.number) : (parent.customName?.trim() || `#${parent.id}`));
  const siblings = await prisma.comanda.findMany({
    where: { tenantId: TENANT, splitLabel: { startsWith: `${baseLabel}-` } },
    select: { splitLabel: true },
  });
  const splitLabel = nextSplitLabel(baseLabel, siblings.map((s) => s.splitLabel ?? ""));

  const year = new Date().getFullYear();
  let seq = (await prisma.comanda.count({ where: { tenantId: TENANT, folio: { startsWith: `COM-${year}-` } } })) + 1;

  let childId: number | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const created = await prisma.comanda.create({
        data: {
          tenantId: TENANT,
          folio: formatFolio(year, seq),
          // Misma mesa y mismo mesero: es la misma gente, sentada donde estaba.
          tableId: parent.tableId,
          customName: parent.tableId ? null : `${baseLabel}-nueva`,
          waiterId: parent.waiterId,
          openedById: a.staffId,
          shift: parent.shift,
          channel: parent.channel,
          // Los comensales se reparten a ojo; se ajusta desde la cuenta si hace falta.
          guestsActual: 1,
          status: "IN_SERVICE",
          parentComandaId: parent.id,
          splitLabel,
        },
        select: { id: true },
      });
      childId = created.id;
      break;
    } catch (e) {
      if (isUniqueViolation(e)) { seq++; continue; }
      console.error("[API] POST /api/comandas/:id/split-account error:", e);
      return NextResponse.json<ApiResponse>({ success: false, error: "No se pudo crear la cuenta dividida" }, { status: 500 });
    }
  }
  if (childId == null) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No se pudo asignar folio a la cuenta dividida" }, { status: 409 });
  }

  // Mover las unidades. Renglón completo → cambia de cuenta; parcial → se parte
  // en dos, con el descuento repartido en proporción para no regalar ni cobrar
  // de más al dividir.
  await prisma.$transaction(async (tx) => {
    for (const u of units) {
      const item = byId.get(u.itemId)!;
      const have = Number(item.quantity);
      if (u.quantity === have) {
        await tx.comandaItem.update({ where: { id: item.id }, data: { comandaId: childId! } });
        continue;
      }
      const unitPrice = Number(item.unitPriceSnapshot);
      const modExtra = Number(item.modifiersExtraCost);
      const movedDiscount = round2((Number(item.discountAmount) * u.quantity) / have);
      const left = round2(have - u.quantity);
      await tx.comandaItem.update({
        where: { id: item.id },
        data: {
          quantity: left,
          lineTotal: calcLineTotal(unitPrice, left, modExtra),
          discountAmount: round2(Number(item.discountAmount) - movedDiscount),
        },
      });
      await tx.comandaItem.create({
        data: {
          tenantId: TENANT,
          comandaId: childId!,
          dishId: item.dishId,
          dishNameSnapshot: item.dishNameSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          prepAreaSnapshot: item.prepAreaSnapshot,
          quantity: u.quantity,
          lineTotal: calcLineTotal(unitPrice, u.quantity, modExtra),
          discountAmount: movedDiscount,
          modifiers: item.modifiers ?? undefined,
          modifiersExtraCost: item.modifiersExtraCost,
          kitchenNotes: item.kitchenNotes,
          status: item.status,
          course: item.course,
          // Se conserva quién lo capturó: dividir la cuenta no reasigna el producto.
          addedById: item.addedById,
        },
      });
    }
  });

  await Promise.all([recalcComandaTotals(parentId), recalcComandaTotals(childId)]);

  const [updatedParent, child] = await Promise.all([
    prisma.comanda.findFirst({ where: { id: parentId, tenantId: TENANT }, include: COMANDA_INCLUDE }),
    prisma.comanda.findFirst({ where: { id: childId, tenantId: TENANT }, include: COMANDA_INCLUDE }),
  ]);

  void notify({
    roles: ["MANAGER"],
    type: "audit",
    title: "Cuenta dividida",
    body: `${updatedParent?.folio ?? `#${parentId}`} → ${splitLabel} (${selectedUnits} producto(s))`,
    url: "/admin/comandas",
  });

  return NextResponse.json<ApiResponse>({ success: true, data: { parent: updatedParent, child } }, { status: 201 });
}
