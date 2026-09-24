import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { canModifyComanda } from "@/lib/comandaRules";
import { lineTotal as calcLineTotal } from "@/lib/comandaTotals";
import { TENANT, COMANDA_INCLUDE, recalcComandaTotals } from "@/lib/comanda";
import { parseDishOptions, resolveSelection, type OptionPick } from "@/lib/dishOptions";
import type { Prisma } from "@prisma/client";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/items — agrega un item. WAITER de SU comanda, o CAPTAIN/MANAGER.
 * Hace SNAPSHOT de nombre, precio y prepArea (si el menú cambia, la comanda conserva el suyo).
 * Body: { dishId, quantity?, modifiers?, modifiersExtraCost?, kitchenNotes? }
 * quantity admite DECIMALES (medias/fracciones de producto, p.ej. 0.5, 1.5).
 * Precio lineal: lineTotal = (precio + extra) × cantidad.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: { id: true, waiterId: true, openedById: true, tableId: true, status: true },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });

  // Para llevar (sin mesa): la maneja caja; su "mesero" es el de sistema "Llevar", así que
  // cualquier rol de caja (Perla/Capitán/Manager) puede modificarla. El resto: dueño (mesero
  // o quien la abrió) o supervisor.
  const isTakeout = comanda.tableId === null;
  const isCajaRole = s.role === "OPERATION" || s.role === "CAPTAIN" || s.role === "MANAGER";
  const isOwner = comanda.waiterId === s.staffId || comanda.openedById === s.staffId;
  if (!canModifyComanda(s.role, isOwner) && !(isTakeout && isCajaRole)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No puedes modificar esta comanda" }, { status: 403 });
  }
  if (comanda.status !== "OPEN" && comanda.status !== "IN_SERVICE") {
    return NextResponse.json<ApiResponse>({ success: false, error: `No se pueden agregar items a una comanda ${comanda.status}` }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const { dishId, quantity, modifiers, modifiersExtraCost, kitchenNotes, course, options } = body || {};
  if (typeof dishId !== "string") {
    return NextResponse.json<ApiResponse>({ success: false, error: "dishId es obligatorio" }, { status: 400 });
  }
  // "tiempo" del platillo (1º, 2º…): entero ≥1, default 1.
  const courseNum = Number.isInteger(course) && course >= 0 && course <= 10 ? course : 0; // 0 = Sin tiempo
  // Cantidad decimal: >0, redondeada a 2 decimales, acotada. Default 1 si es inválida.
  const rawQty = typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const qty = Math.min(999, Math.round(rawQty * 100) / 100);
  const extra = typeof modifiersExtraCost === "number" && modifiersExtraCost >= 0 ? modifiersExtraCost : 0;

  const dish = await prisma.dish.findFirst({ where: { id: dishId, active: true }, select: { name: true, price: true, prepArea: true, options: true } });
  if (!dish) return NextResponse.json<ApiResponse>({ success: false, error: "Platillo no encontrado" }, { status: 404 });
  if (!dish.prepArea) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "El platillo no tiene área de preparación (prepArea) clasificada" },
      { status: 422 },
    );
  }

  // Opciones por platillo (Fase Brunch B-2). Si el platillo declara grupos O el mesero
  // manda picks, la selección MANDA: modifiers, costo extra y snapshot salen del servidor
  // (el modifiersExtraCost del cliente se IGNORA). Si no hay grupos ni picks, se conserva
  // el comportamiento libre de siempre (modifiers texto + modifiersExtraCost del cliente),
  // para no romper /api/bot/pedido ni lo existente.
  const groups = parseDishOptions(dish.options);
  const picks = Array.isArray(options)
    ? (options as unknown[])
        .filter((p): p is { group: string; label: string } =>
          !!p && typeof p === "object" &&
          typeof (p as { group?: unknown }).group === "string" &&
          typeof (p as { label?: unknown }).label === "string")
        .map((p) => ({ group: p.group, label: p.label }))
    : [];

  let finalModifiers: string | null;
  let finalExtra: number;
  let snapshot: OptionPick[] | null = null;
  if (groups.length > 0 || picks.length > 0) {
    const res = resolveSelection(groups, picks);
    if (!res.ok) return NextResponse.json<ApiResponse>({ success: false, error: res.error }, { status: 400 });
    finalModifiers = res.modifiers || null;
    finalExtra = res.extraCost;
    snapshot = res.snapshot;
  } else {
    finalModifiers = typeof modifiers === "string" ? modifiers : null;
    finalExtra = extra;
  }

  const line = calcLineTotal(dish.price, qty, finalExtra);

  await prisma.comandaItem.create({
    data: {
      tenantId: TENANT,
      comandaId: id,
      dishId,
      dishNameSnapshot: dish.name,
      unitPriceSnapshot: dish.price,
      prepAreaSnapshot: dish.prepArea,
      quantity: qty,
      course: courseNum,
      modifiers: finalModifiers,
      modifiersExtraCost: finalExtra,
      optionsSnapshot: snapshot ? (snapshot as unknown as Prisma.InputJsonValue) : undefined,
      kitchenNotes: typeof kitchenNotes === "string" ? kitchenNotes : null,
      lineTotal: line,
      addedById: s.staffId,
    },
  });

  await recalcComandaTotals(id);
  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated }, { status: 201 });
}
