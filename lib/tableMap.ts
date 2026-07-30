import { prisma } from "./prisma";
import { TENANT, ACTIVE_STATUSES } from "./comanda";
import { closeStaleReservations } from "./closeStaleReservations";

/**
 * Mapa de mesas EN VIVO para el realm STAFF (PIN). Combina 3 fuentes sobre el
 * cliente `prisma` elevado (sin RLS): reservas de hoy, comandas ACTIVAS y bloqueos
 * manuales. A diferencia de /api/admin/map (centrado en reservas), aquí una mesa
 * con comanda activa sale ocupada — walk-in si la comanda no viene de reserva, o
 * "en curso" si sí — para que el mapa reaccione a que el mesero abre/cierra cuentas.
 *
 * Precedencia por mesa: área bloqueada (grupo grande) > comanda activa > bloqueo
 * manual > reservada > libre.
 */

export type MapTableStatus = "available" | "reserved" | "in_progress" | "walk_in" | "blocked" | "area_blocked";

export interface MapTable {
  id: string; number: number; capacity: number;
  status: MapTableStatus;
  reservation: { id: string; status: string; guestName: string; guests: number; time: string } | null;
  comanda: { id: number; folio: string; status: string; total: number } | null;
  block: { note: string | null; createdAt: Date } | null;
}
export interface MapSection {
  id: string; name: string;
  largeGroup: { id: string; status: string; guestName: string; guests: number; time: string } | null;
  tables: MapTable[];
}

const mxTime = (d: Date) => new Date(d).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });

export async function getStaffTableMap(): Promise<MapSection[]> {
  await closeStaleReservations().catch(() => { /* no romper el mapa si falla */ });

  const now = new Date();
  const mxDate = now.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const dayStart = new Date(`${mxDate}T00:00:00.000-06:00`);
  const dayEnd = new Date(`${mxDate}T23:59:59.999-06:00`);

  const [largeGroups, activeReservations, comandas, blocks, sections] = await Promise.all([
    prisma.reservation.findMany({
      where: { isLargeGroup: true, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "DELAYED"] }, date: { gte: dayStart, lte: dayEnd }, sectionPreference: { not: null } },
      select: { id: true, status: true, guestName: true, guests: true, date: true, sectionPreference: true },
    }),
    prisma.reservation.findMany({
      where: {
        isLargeGroup: false, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "DELAYED"] }, date: { gte: dayStart, lte: dayEnd },
        OR: [{ tableId: { not: null } }, { linkedTableId: { not: null } }, { thirdTableId: { not: null } }, { fourthTableId: { not: null } }],
      },
      select: { id: true, status: true, guestName: true, guests: true, date: true, tableId: true, linkedTableId: true, thirdTableId: true, fourthTableId: true },
    }),
    prisma.comanda.findMany({
      where: { tenantId: TENANT, status: { in: [...ACTIVE_STATUSES] }, tableId: { not: null } },
      select: { id: true, folio: true, status: true, total: true, tableId: true, reservationId: true },
    }),
    prisma.tableBlock.findMany({ select: { tableId: true, note: true, createdAt: true } }),
    prisma.section.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { tables: { where: { isActive: true }, orderBy: { number: "asc" } } } }),
  ]);

  const largeBySection = new Map<string, MapSection["largeGroup"]>();
  for (const r of largeGroups) {
    if (r.sectionPreference) largeBySection.set(r.sectionPreference, { id: r.id, status: r.status, guestName: r.guestName, guests: r.guests, time: mxTime(r.date) });
  }

  const resByTable = new Map<string, MapTable["reservation"]>();
  for (const r of activeReservations) {
    const info = { id: r.id, status: r.status, guestName: r.guestName, guests: r.guests, time: mxTime(r.date) };
    for (const tid of [r.tableId, r.linkedTableId, r.thirdTableId, r.fourthTableId]) if (tid) resByTable.set(tid, info);
  }

  const comandaByTable = new Map<string, { id: number; folio: string; status: string; total: number; reservationId: string | null }>();
  for (const c of comandas) if (c.tableId) comandaByTable.set(c.tableId, { id: c.id, folio: c.folio, status: c.status, total: Number(c.total), reservationId: c.reservationId });

  const blockByTable = new Map(blocks.map((b) => [b.tableId, b]));

  return sections.map((sec) => {
    const largeGroup = largeBySection.get(sec.name) ?? null;
    const tables: MapTable[] = sec.tables.map((t) => {
      const res = resByTable.get(t.id) ?? null;
      const cmd = comandaByTable.get(t.id) ?? null;
      const block = blockByTable.get(t.id) ?? null;

      let status: MapTableStatus;
      if (largeGroup) status = "area_blocked";
      else if (cmd) status = cmd.reservationId ? "in_progress" : "walk_in"; // comanda activa = ocupada
      else if (block) status = "blocked";
      else if (res) status = "reserved";
      else status = "available";

      return {
        id: t.id, number: t.number, capacity: t.capacity, status,
        reservation: largeGroup ?? res,
        comanda: cmd ? { id: cmd.id, folio: cmd.folio, status: cmd.status, total: cmd.total } : null,
        block: block ? { note: block.note, createdAt: block.createdAt } : null,
      };
    });
    return { id: sec.id, name: sec.name, largeGroup, tables };
  });
}

// ── Bloquear / desbloquear (mesa o sección) ──────────────────────────────────
export type BlockAction = "block" | "unblock" | "block-section" | "unblock-section";
export interface BlockResult { ok: boolean; status: number; error?: string }

export async function setTableBlock(action: BlockAction, opts: { tableId?: string; sectionId?: string; note?: string }): Promise<BlockResult> {
  const VALID: BlockAction[] = ["block", "unblock", "block-section", "unblock-section"];
  if (!VALID.includes(action)) return { ok: false, status: 400, error: "Acción inválida" };

  if (action === "block-section" || action === "unblock-section") {
    if (!opts.sectionId) return { ok: false, status: 400, error: "Falta sectionId" };
    const section = await prisma.section.findUnique({ where: { id: opts.sectionId }, include: { tables: { where: { isActive: true }, select: { id: true } } } });
    if (!section) return { ok: false, status: 404, error: "Sección no encontrada" };
    const tableIds = section.tables.map((t) => t.id);
    if (action === "block-section") {
      await Promise.all(tableIds.map((tid) => prisma.tableBlock.upsert({ where: { tableId: tid }, update: { note: opts.note ?? "Bloqueo de área", createdAt: new Date() }, create: { tableId: tid, note: opts.note ?? "Bloqueo de área" } })));
    } else {
      await prisma.tableBlock.deleteMany({ where: { tableId: { in: tableIds } } });
    }
    return { ok: true, status: 200 };
  }

  if (!opts.tableId) return { ok: false, status: 400, error: "Falta tableId" };
  if (action === "block") {
    await prisma.tableBlock.upsert({ where: { tableId: opts.tableId }, update: { note: opts.note ?? null, createdAt: new Date() }, create: { tableId: opts.tableId, note: opts.note ?? null } });
  } else {
    await prisma.tableBlock.deleteMany({ where: { tableId: opts.tableId } });
  }
  return { ok: true, status: 200 };
}
