import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { canModifyComanda, prepAreaToTarget } from "@/lib/comandaRules";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import type { ApiResponse } from "@/types";

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * POST /api/comandas/:id/send-to-kitchen — envía los items PENDING a cocina/barra.
 * Agrupa por prepArea, registra un ComandaPrint (KITCHEN_BAR) por destino, marca
 * los items SENT y pasa la comanda a IN_SERVICE. Atómico (transacción).
 * (B.1 solo registra el ComandaPrint; el ruteo físico a impresora es B.3.)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const s = await getStaffSession(request);
  if (!s) return NextResponse.json<ApiResponse>({ success: false, error: "No autorizado" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json<ApiResponse>({ success: false, error: "ID inválido" }, { status: 400 });

  const comanda = await prisma.comanda.findFirst({
    where: { id, tenantId: TENANT },
    select: {
      id: true, waiterId: true, status: true, folio: true, guestsActual: true, channel: true,
      waiter: { select: { fullName: true } },
      customName: true,
      table:  { select: { number: true, section: { select: { name: true } } } },
    },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  // Los pedidos del bot (para llevar) no tienen mesero dueño real: cualquier rol de
  // caja (OPERATION/CAPTAIN/MANAGER) puede mandarlos a cocina, no solo el "dueño".
  const isBotTakeout = (comanda.channel ?? "").startsWith("BOT_");
  const isCajaRole = s.role === "OPERATION" || s.role === "CAPTAIN" || s.role === "MANAGER";
  if (!canModifyComanda(s.role, comanda.waiterId === s.staffId) && !(isBotTakeout && isCajaRole)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No puedes modificar esta comanda" }, { status: 403 });
  }

  const pending = await prisma.comandaItem.findMany({
    where: { comandaId: id, tenantId: TENANT, status: "PENDING" },
    select: { id: true, prepAreaSnapshot: true, dishNameSnapshot: true, quantity: true, course: true, kitchenNotes: true, modifiers: true },
  });
  if (pending.length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No hay items pendientes por enviar" }, { status: 400 });
  }

  const areas = Array.from(new Set(pending.map((i) => i.prepAreaSnapshot))); // BARRA / COCINA
  const tableLabel = comanda.table ? `Mesa ${comanda.table.number} - ${comanda.table.section.name}` : (comanda.customName || "Cuenta sin mesa");
  const nowIso = new Date().toISOString();

  await prisma.$transaction([
    prisma.comandaItem.updateMany({
      where: { comandaId: id, tenantId: TENANT, status: "PENDING" },
      data: { status: "SENT", sentAt: new Date() },
    }),
    ...areas.map((area) => {
      const areaItems = pending
        .filter((i) => i.prepAreaSnapshot === area)
        .sort((a, b) => a.course - b.course) // agrupa por tiempo para los separadores del ticket
        .map((i) => ({ qty: Number(i.quantity), name: i.dishNameSnapshot, course: i.course, notes: i.kitchenNotes ?? null, mods: i.modifiers ?? null }));
      // Snapshot listo-para-imprimir → el PrintBridge lo convierte a ESC/POS.
      const payload = {
        kind:   "kitchen",
        folio:  comanda.folio,
        table:  tableLabel,
        waiter: comanda.waiter.fullName,
        guests: comanda.guestsActual,
        area,
        time:   nowIso,
        items:  areaItems,
      };
      return prisma.comandaPrint.create({
        data: {
          tenantId:     TENANT,
          comandaId:    id,
          type:         "KITCHEN_BAR",
          target:       prepAreaToTarget(area),
          executedById: s.staffId,
          status:       "PENDING",
          payload,
        },
      });
    }),
    prisma.comanda.update({ where: { id }, data: { status: "IN_SERVICE" } }),
  ]);

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
