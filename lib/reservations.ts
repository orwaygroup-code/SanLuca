import type { ReservationStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { autoAssignTable } from "./autoAssignTable";
import { resolveEditTables } from "./reservationTables";
import { combinedCapacity, evaluateCapacity } from "./tableCapacity";
import { getReservationWindow } from "./tableConflict";
import { sendReservationQR } from "./whatsapp";
import { reEvalUserRule } from "./tagRules";

/**
 * Servicio de reservas para el realm STAFF (PIN). Reusa los mismos helpers que
 * las rutas admin, pero corre sobre el cliente `prisma` ELEVADO (sin RLS) —
 * mismo patrón que comandas/reservations-today y caja/settings, porque un actor
 * de staff no tiene ServerSession/rol RLS. La lógica es equivalente a
 * app/api/admin/reservations/**; las rutas admin quedan intactas (se reconcilian
 * después). Cada función devuelve un SvcResult mapeable a HTTP.
 */

export interface SvcResult<T = unknown> { ok: boolean; status: number; data?: T; error?: string }
const ok = <T>(data: T, status = 200): SvcResult<T> => ({ ok: true, status, data });
const err = (error: string, status = 400): SvcResult<never> => ({ ok: false, status, error });

const LIST_SELECT = {
  id: true, guestName: true, guestPhone: true, date: true, guests: true,
  sectionPreference: true, occasion: true, notes: true, status: true,
  paymentStatus: true, requiresPayment: true, creditUsed: true, amountPaid: true,
  checkedInAt: true, seenAt: true, tablesProvisional: true, qrToken: true,
  table: { select: { number: true, section: { select: { name: true } } } },
  user: { select: { name: true, email: true, phone: true } },
} as const;

const CARD_SELECT = {
  id: true, status: true, guestName: true, date: true,
  guestPhone: true, guests: true, sectionPreference: true, qrToken: true,
  table: { select: { number: true, section: { select: { name: true } } } },
} as const;

// ── Listar ───────────────────────────────────────────────────────────────────
export interface ListParams { section?: string | null; date?: string | null; search?: string | null; archived?: boolean; all?: boolean }

export async function listReservations(p: ListParams): Promise<SvcResult> {
  const where: Record<string, unknown> = {};
  if (p.section && p.section !== "Todas") where.sectionPreference = p.section;

  if (p.all) {
    // sin filtro de estado ni fecha
  } else if (p.archived) {
    where.status = { in: ["CANCELLED", "NO_SHOW", "COMPLETED"] };
  } else if (p.date) {
    const start = new Date(`${p.date}T00:00:00.000-06:00`);
    const end = new Date(`${p.date}T23:59:59.999-06:00`);
    where.date = { gte: start, lte: end };
  } else {
    const nowMx = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const dateMx = `${nowMx.getFullYear()}-${String(nowMx.getMonth() + 1).padStart(2, "0")}-${String(nowMx.getDate()).padStart(2, "0")}`;
    where.date = { gte: new Date(`${dateMx}T00:00:00.000-06:00`) };
  }
  if (p.search) {
    where.OR = [
      { guestName: { contains: p.search, mode: "insensitive" } },
      { guestPhone: { contains: p.search } },
    ];
  }

  const data = await prisma.reservation.findMany({
    where,
    orderBy: { date: p.archived || p.all ? "desc" : "asc" },
    select: LIST_SELECT,
  });
  return ok(data);
}

// ── Crear ────────────────────────────────────────────────────────────────────
export interface CreateInput {
  guestName: string; guestPhone: string; date: string; time: string; guests: number;
  sectionPreference?: string; notes?: string; occasion?: string; isLargeGroup?: boolean;
  tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
}

export async function createReservation(input: CreateInput, createdById: string | null): Promise<SvcResult> {
  const { guestName, guestPhone, date, time, guests, sectionPreference, notes, occasion, isLargeGroup, tableId, linkedTableId, thirdTableId, fourthTableId } = input;
  if (!guestName || !guestPhone || !date || !time || !guests) return err("Faltan campos requeridos", 400);

  const reservationDate = new Date(`${date}T${time}:00.000-06:00`);
  if (isNaN(reservationDate.getTime())) return err("Fecha u hora inválida", 400);

  const phone = guestPhone.replace(/\D/g, "").slice(-10);

  let user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    const guestEmail = `${phone}@hostes.guest`;
    user = await prisma.user.upsert({
      where: { email: guestEmail },
      update: { name: guestName },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { name: guestName, email: guestEmail, phone, role: "CUSTOMER" } as any,
    });
  }

  let assignedTableId = tableId ?? null;
  let assignedSection = sectionPreference ?? null;
  if (!assignedTableId && !isLargeGroup) {
    const assigned = await autoAssignTable(reservationDate, guests, sectionPreference ?? null);
    if (assigned) { assignedTableId = assigned.tableId; assignedSection = assigned.sectionName; }
  }

  const reservation = await prisma.reservation.create({
    data: {
      userId: user.id,
      createdById,
      guestName,
      guestPhone: phone,
      guests,
      date: reservationDate,
      isLargeGroup: isLargeGroup ?? false,
      sectionPreference: assignedSection,
      notes: notes ?? null,
      occasion: occasion ?? null,
      status: "CONFIRMED",
      seenAt: new Date(), // creada por staff → ya "vista"
      paymentStatus: "UNPAID",
      ...(assignedTableId ? { tableId: assignedTableId } : {}),
      ...(linkedTableId ? { linkedTableId } : {}),
      ...(thirdTableId ? { thirdTableId } : {}),
      ...(fourthTableId ? { fourthTableId } : {}),
    },
    include: { table: { select: { number: true, section: { select: { name: true } } } } },
  });

  if (reservation.userId) {
    reEvalUserRule(reservation.userId, "Inactivo").catch((e) => console.error("[AUTO_TAG] reEval Inactivo (staff reservation):", e));
  }
  return ok(reservation, 201);
}

// ── Editar (no mueve mesa) ───────────────────────────────────────────────────
export interface EditInput {
  date: string; time: string; guests: number; guestName: string; guestPhone: string;
  sectionPreference?: string; tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string;
  notes?: string; occasion?: string;
}

export async function editReservation(id: string, input: EditInput): Promise<SvcResult> {
  const reservationDate = new Date(`${input.date}T${input.time}:00.000-06:00`);
  if (isNaN(reservationDate.getTime())) return err("Fecha u hora inválida", 400);
  const { from: winFrom, to: winTo } = getReservationWindow(reservationDate);

  const currentRes = await prisma.reservation.findUnique({
    where: { id },
    select: { tableId: true, linkedTableId: true, thirdTableId: true, fourthTableId: true },
  });
  if (!currentRes) return err("Reserva no encontrada", 404);

  const finalTables = resolveEditTables(
    { tableId: input.tableId, linkedTableId: input.linkedTableId, thirdTableId: input.thirdTableId, fourthTableId: input.fourthTableId },
    currentRes,
  );

  if (input.tableId) {
    const allIds = [finalTables.tableId, finalTables.linkedTableId, finalTables.thirdTableId, finalTables.fourthTableId].filter(Boolean) as string[];
    const conflict = await prisma.reservation.findFirst({
      where: {
        id: { not: id },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        date: { gt: winFrom, lt: winTo },
        OR: allIds.flatMap((t) => [{ tableId: t }, { linkedTableId: t }, { thirdTableId: t }, { fourthTableId: t }]),
      },
    });
    if (conflict) return err("La mesa seleccionada ya está ocupada en ese horario.", 409);
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      date: reservationDate,
      guests: input.guests,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      sectionPreference: input.sectionPreference ?? null,
      tableId: finalTables.tableId,
      linkedTableId: finalTables.linkedTableId,
      thirdTableId: finalTables.thirdTableId,
      fourthTableId: finalTables.fourthTableId,
      notes: input.notes ?? null,
      occasion: input.occasion ?? null,
    },
    select: CARD_SELECT,
  });
  return ok(updated);
}

// ── Mover mesa ───────────────────────────────────────────────────────────────
export interface MoveInput { tableId?: string; linkedTableId?: string; thirdTableId?: string; fourthTableId?: string; sectionPreference?: string; forceAssign?: boolean }

export async function moveReservationTable(id: string, input: MoveInput): Promise<SvcResult> {
  const { tableId, linkedTableId, thirdTableId, fourthTableId, sectionPreference, forceAssign } = input;

  if (!tableId) {
    const updated = await prisma.reservation.update({
      where: { id },
      data: { tableId: null, linkedTableId: null, thirdTableId: null, fourthTableId: null, tablesProvisional: false, ...(sectionPreference ? { sectionPreference } : {}) },
      select: CARD_SELECT,
    });
    return ok(updated);
  }

  const current = await prisma.reservation.findUnique({ where: { id }, select: { id: true, date: true, status: true, guests: true } });
  if (!current) return err("Reserva no encontrada", 404);

  const { from: winFrom, to: winTo } = getReservationWindow(current.date);
  const allNewIds = [tableId, linkedTableId, thirdTableId, fourthTableId].filter(Boolean) as string[];

  const conflict = await prisma.reservation.findFirst({
    where: {
      id: { not: id },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      date: { gt: winFrom, lt: winTo },
      OR: allNewIds.flatMap((t) => [{ tableId: t }, { linkedTableId: t }, { thirdTableId: t }, { fourthTableId: t }]),
    },
  });
  if (conflict) return err("La mesa seleccionada ya está ocupada en ese horario.", 409);

  const chosenTables = await prisma.table.findMany({ where: { id: { in: allNewIds } }, select: { capacity: true } });
  const totalCapacity = combinedCapacity(chosenTables.map((t) => t.capacity));
  const decision = evaluateCapacity(totalCapacity, current.guests, forceAssign === true);
  if (!decision.ok) {
    return err(`La mesa seleccionada es para ${totalCapacity} personas y vas a sentar ${current.guests}. Confirma para continuar.`, 409);
  }
  if (decision.requiresOverride) {
    console.warn("[AUDIT] capacity-override move-table (staff)", { reservationId: id, tableIds: allNewIds, totalCapacity, guests: current.guests });
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: { tableId, linkedTableId: linkedTableId ?? null, thirdTableId: thirdTableId ?? null, fourthTableId: fourthTableId ?? null, tablesProvisional: false, ...(sectionPreference ? { sectionPreference } : {}) },
    select: CARD_SELECT,
  });
  return ok(updated);
}

// ── Cambiar estado (incluye Cancelar) ────────────────────────────────────────
const VALID_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "DELAYED", "CANCELLED", "COMPLETED", "NO_SHOW"];

export async function changeReservationStatus(id: string, status: string): Promise<SvcResult> {
  if (!VALID_STATUSES.includes(status)) return err("Estado inválido", 400);

  const extra: Record<string, unknown> = {};
  if (status === "CONFIRMED") extra.confirmedAt = new Date();
  if (status === "CANCELLED") extra.cancelledAt = new Date();
  if (status === "COMPLETED") extra.checkedInAt = new Date();
  if (status === "IN_PROGRESS") extra.checkedInAt = new Date();

  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status: status as ReservationStatus, ...extra },
    select: { id: true, status: true, userId: true, guestName: true, date: true, guestPhone: true, guests: true, sectionPreference: true, qrToken: true },
  });

  if (status === "COMPLETED" && reservation.userId) {
    reEvalUserRule(reservation.userId, "VIP").catch((e) => console.error("[AUTO_TAG] reEval VIP (staff status):", e));
  }
  if (status === "CANCELLED") {
    const { createCreditFromCancelledReservation } = await import("./credits");
    await createCreditFromCancelledReservation(id).catch((e) => console.error("[Credits] error generating credit:", e));
  }
  if (status === "CONFIRMED") {
    sendReservationQR({
      phone: reservation.guestPhone, guestName: reservation.guestName,
      date: new Date(reservation.date), guests: reservation.guests,
      sectionPreference: reservation.sectionPreference, qrToken: reservation.qrToken,
    }).catch((e) => console.error("[WhatsApp QR]", e));
  }
  return ok(reservation);
}

// ── Eliminar (solo terminal) ─────────────────────────────────────────────────
export async function deleteReservation(id: string): Promise<SvcResult> {
  const reservation = await prisma.reservation.findUnique({ where: { id }, select: { status: true } });
  if (!reservation) return err("Reserva no encontrada", 404);
  if (!["CANCELLED", "NO_SHOW", "COMPLETED"].includes(reservation.status)) {
    return err("Solo se pueden eliminar reservas canceladas, no presentadas o completadas", 400);
  }
  await prisma.reservation.delete({ where: { id } });
  return ok({ id });
}

// ── Marcar vista ─────────────────────────────────────────────────────────────
export async function markReservationSeen(id: string): Promise<SvcResult> {
  const exists = await prisma.reservation.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return err("Reserva no encontrada", 404);
  await prisma.reservation.update({ where: { id }, data: { seenAt: new Date() } });
  return ok({ id });
}
