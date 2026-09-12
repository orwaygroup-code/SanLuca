import { NextRequest, NextResponse } from "next/server";
import type { PrepArea, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth-server";
import { canModifyComanda, prepAreaToTarget } from "@/lib/comandaRules";
import { TENANT, COMANDA_INCLUDE } from "@/lib/comanda";
import { notify } from "@/lib/notify";
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
      id: true, waiterId: true, openedById: true, tableId: true, status: true, folio: true, guestsActual: true, channel: true,
      waiter: { select: { fullName: true } },
      customName: true,
      table:  { select: { number: true, section: { select: { name: true } } } },
    },
  });
  if (!comanda) return NextResponse.json<ApiResponse>({ success: false, error: "Comanda no encontrada" }, { status: 404 });
  // Para llevar (sin mesa, manual o del bot) no tiene mesero dueño real (su mesero es el de
  // sistema "Llevar"): cualquier rol de caja (OPERATION/CAPTAIN/MANAGER) puede operarla.
  const isTakeout = comanda.tableId === null;
  const isCajaRole = s.role === "OPERATION" || s.role === "CAPTAIN" || s.role === "MANAGER";
  const isOwner = comanda.waiterId === s.staffId || comanda.openedById === s.staffId;
  if (!canModifyComanda(s.role, isOwner) && !(isTakeout && isCajaRole)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No puedes modificar esta comanda" }, { status: 403 });
  }

  if (comanda.status !== "OPEN" && comanda.status !== "IN_SERVICE")
    return NextResponse.json<ApiResponse>({ success: false, error: `Comanda ${comanda.status}: no se puede enviar a cocina` }, { status: 409 });

  const [pending, pendingNotes] = await Promise.all([
    prisma.comandaItem.findMany({
      where: { comandaId: id, tenantId: TENANT, status: "PENDING" },
      select: { id: true, prepAreaSnapshot: true, dishNameSnapshot: true, quantity: true, course: true, kitchenNotes: true, modifiers: true, addedAt: true, dish: { select: { category: { select: { name: true, carta: { select: { name: true } } } } } } },
    }),
    // Notas libres PENDING (append-only): viajan con esta tanda, intercaladas entre
    // los productos del área por tiempo (course) y orden de captura (createdAt).
    prisma.comandaNote.findMany({
      where: { comandaId: id, tenantId: TENANT, status: "PENDING" },
      select: { id: true, area: true, text: true, course: true, createdAt: true },
    }),
  ]);
  if (pending.length === 0 && pendingNotes.length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "No hay items ni notas pendientes por enviar" }, { status: 400 });
  }

  // Áreas = unión de las de los productos y las de las notas (una nota puede ir a un
  // área sin productos en esta tanda: igual se imprime su ticket).
  const areas = Array.from(new Set<PrepArea>([...pending.map((i) => i.prepAreaSnapshot), ...pendingNotes.map((n) => n.area)]));
  const tableLabel = comanda.table ? `Mesa ${comanda.table.number} - ${comanda.table.section.name}` : (comanda.customName || "Cuenta sin mesa");
  const nowIso = new Date().toISOString();

  await prisma.$transaction([
    prisma.comandaItem.updateMany({
      where: { comandaId: id, tenantId: TENANT, status: "PENDING" },
      data: { status: "SENT", sentAt: new Date() },
    }),
    prisma.comandaNote.updateMany({
      where: { comandaId: id, tenantId: TENANT, status: "PENDING" },
      data: { status: "SENT", sentAt: new Date() },
    }),
    ...areas.map((area) => {
      // Productos y notas del área, ordenados por (tiempo, orden de captura) para
      // que la nota quede ENTRE los productos tal como se capturaron.
      const rows: { course: number; at: number; entry: Record<string, unknown> }[] = [
        ...pending.filter((i) => i.prepAreaSnapshot === area).map((i) => ({
          course: i.course, at: i.addedAt.getTime(),
          entry: { kind: "item", qty: Number(i.quantity), name: i.dishNameSnapshot, course: i.course, notes: i.kitchenNotes ?? null, mods: i.modifiers ?? null, origin: i.dish?.category ? (i.dish.category.carta ? `${i.dish.category.carta.name} · ${i.dish.category.name}` : i.dish.category.name) : null },
        })),
        ...pendingNotes.filter((n) => n.area === area).map((n) => ({
          course: n.course, at: n.createdAt.getTime(),
          entry: { kind: "note", text: n.text, course: n.course },
        })),
      ];
      rows.sort((a, b) => (a.course - b.course) || (a.at - b.at));
      // Snapshot listo-para-imprimir → el PrintBridge lo convierte a ESC/POS.
      const payload = {
        kind:   "kitchen",
        folio:  comanda.folio,
        table:  tableLabel,
        waiter: comanda.waiter.fullName,
        guests: comanda.guestsActual,
        area,
        time:   nowIso,
        items:  rows.map((r) => r.entry),
      };
      return prisma.comandaPrint.create({
        data: {
          tenantId:     TENANT,
          comandaId:    id,
          type:         "KITCHEN_BAR",
          target:       prepAreaToTarget(area),
          executedById: s.staffId,
          status:       "PENDING",
          payload:      payload as Prisma.InputJsonValue,
        },
      });
    }),
    prisma.comanda.update({ where: { id }, data: { status: "IN_SERVICE" } }),
  ]);

  // Auditoría en tiempo real: campana + push a managers por cada envío a cocina.
  // El detalle (productos, comentarios, hora, mesero) queda en el payload del
  // ComandaPrint KITCHEN_BAR y lo muestra el panel /admin/comandas.
  const notasTxt = pendingNotes.length > 0 ? ` + ${pendingNotes.length} ${pendingNotes.length === 1 ? "nota" : "notas"}` : "";
  void notify({
    roles: ["MANAGER"],
    type: "audit",
    title: "Comanda enviada a cocina",
    body: `${comanda.folio} · ${comanda.waiter.fullName} · ${pending.length} ${pending.length === 1 ? "producto" : "productos"}${notasTxt}`,
    url: "/admin/comandas",
  });

  const updated = await prisma.comanda.findFirst({ where: { id, tenantId: TENANT }, include: COMANDA_INCLUDE });
  return NextResponse.json<ApiResponse>({ success: true, data: updated });
}
