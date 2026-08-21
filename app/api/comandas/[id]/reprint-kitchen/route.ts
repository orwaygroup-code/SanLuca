import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { prepAreaToTarget } from "@/lib/comandaRules";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/reprint-kitchen { itemIds:number[] } — reimprime a cocina/barra
 * productos YA enviados. Acción de MANAGER (el botón solo le aparece a él). Agrupa por área
 * y crea un ComandaPrint KITCHEN_REPRINT por destino, con bandera de reimpresión (banner).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });
  if (s.role !== "MANAGER") return NextResponse.json<ApiResponse>({ success: false, error: "Solo un manager puede reimprimir a cocina" }, { status: 403 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const itemIds: number[] = Array.isArray(body?.itemIds) ? body.itemIds.filter((n: unknown) => Number.isInteger(n)) : [];
  if (itemIds.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "Elige al menos un producto" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: {
      id: true, folio: true, guestsActual: true, customName: true,
      waiter: { select: { fullName: true } },
      table: { select: { number: true, section: { select: { name: true } } } },
    },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });

  // Solo productos de ESTA comanda, ya enviados (no PENDING) y no cancelados.
  const items = await prisma.comandaItem.findMany({
    where: { id: { in: itemIds }, comandaId: id, tenantId: TENANT, status: { notIn: ["PENDING", "CANCELLED"] } },
    select: { prepAreaSnapshot: true, dishNameSnapshot: true, quantity: true, course: true, kitchenNotes: true, modifiers: true, dish: { select: { category: { select: { name: true, carta: { select: { name: true } } } } } } },
  });
  if (items.length === 0) return NextResponse.json<ApiResponse>({ success: false, error: "Ninguno de los productos elegidos está enviado a cocina" }, { status: 400 });

  const areas = Array.from(new Set(items.map((i) => i.prepAreaSnapshot))); // BARRA / COCINA
  const tableLabel = comanda.table ? `Mesa ${comanda.table.number} - ${comanda.table.section.name}` : (comanda.customName || "Cuenta sin mesa");
  const nowIso = new Date().toISOString();

  await prisma.$transaction(
    areas.map((area) => {
      const areaItems = items
        .filter((i) => i.prepAreaSnapshot === area)
        .sort((a, b) => a.course - b.course) // conserva el orden por tiempo
        .map((i) => ({ qty: Number(i.quantity), name: i.dishNameSnapshot, course: i.course, notes: i.kitchenNotes ?? null, mods: i.modifiers ?? null, origin: i.dish?.category ? (i.dish.category.carta ? `${i.dish.category.carta.name} · ${i.dish.category.name}` : i.dish.category.name) : null }));
      const payload = {
        kind:    "kitchen",
        reprint: true, // el PrintBridge imprime banner "REIMPRESION"
        folio:   comanda.folio,
        table:   tableLabel,
        waiter:  comanda.waiter.fullName,
        guests:  comanda.guestsActual,
        area,
        time:    nowIso,
        items:   areaItems,
      };
      return prisma.comandaPrint.create({
        data: { tenantId: TENANT, comandaId: id, type: "KITCHEN_REPRINT", target: prepAreaToTarget(area), executedById: s.staffId, status: "PENDING", payload },
      });
    }),
  );

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
