import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Reglas deterministas de auto-tagging — fase 2 del sistema de tags.
 * Ver wiki [[Auto-tagging]] §Reglas estructurales.
 *
 * Cada regla expone:
 *   - `tagName`: nombre del Tag en el catálogo (debe existir + isActive).
 *   - `predicate(db, userId)`: evalúa la regla para un usuario individual.
 *     Usado por `reEvalUserRule` en triggers tiempo real.
 *   - `findMatchingUserIds(db)`: query agregada que devuelve TODOS los
 *     usuarios que matchean. Usado por el cron en el rules-pass invertido
 *     (1 query por regla en vez de N usuarios × M reglas — ver Plan agent).
 */

// Hora México fija (UTC-6, sin DST desde 2022). Mismo helper que en
// lib/closeStaleReservations y otros módulos.
const MX_OFFSET_MS = 6 * 3600 * 1000;
function mxParts(d: Date) {
  const s = new Date(d.getTime() - MX_OFFSET_MS);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth(), day: s.getUTCDate() };
}

// ─── Tipos ──────────────────────────────────────────────────────────

type DB = PrismaClient | typeof prisma;

export interface TagRule {
  tagName: string;
  predicate: (db: DB, userId: string) => Promise<boolean>;
  findMatchingUserIds: (db: DB) => Promise<Set<string>>;
}

// ─── Regla: VIP ─────────────────────────────────────────────────────
// totalCompletedReservations(userId) >= 5

const VIP_THRESHOLD = 5;

async function vipMatches(db: DB, userId: string): Promise<boolean> {
  const count = await db.reservation.count({
    where: { userId, status: "COMPLETED" },
  });
  return count >= VIP_THRESHOLD;
}

async function vipFindAll(db: DB): Promise<Set<string>> {
  // groupBy + HAVING — 1 query, sin N+1.
  const rows = await db.reservation.groupBy({
    by: ["userId"],
    where:  { status: "COMPLETED" },
    _count: { _all: true },
    having: { userId: { _count: { gte: VIP_THRESHOLD } } },
  });
  return new Set(rows.map((r) => r.userId));
}

// ─── Regla: Inactivo ────────────────────────────────────────────────
// lastReservationDate(userId) < now - 90d  AND  totalReservations > 0
// (Sin filtro por acceptedTermsAt — los users WhatsApp <phone>@whatsapp.guest
// no aceptan términos pero igual deben recibir el tag. Ver spec §Reglas.)

const INACTIVE_DAYS = 90;

function inactiveCutoff(now = new Date()): Date {
  return new Date(now.getTime() - INACTIVE_DAYS * 86400000);
}

async function inactiveMatches(db: DB, userId: string): Promise<boolean> {
  const cutoff = inactiveCutoff();
  const last = await db.reservation.findFirst({
    where:   { userId },
    orderBy: { date: "desc" },
    select:  { date: true },
  });
  if (!last) return false; // sin reservas → no es "inactivo", es "nuevo"
  return last.date < cutoff;
}

async function inactiveFindAll(db: DB): Promise<Set<string>> {
  const cutoff = inactiveCutoff();
  // Usuarios CON al menos una reserva, cuya MAX(date) < cutoff.
  const rows = await db.reservation.groupBy({
    by:     ["userId"],
    _max:   { date: true },
  });
  return new Set(
    rows
      .filter((r) => r._max.date !== null && r._max.date < cutoff)
      .map((r) => r.userId),
  );
}

// ─── Regla: Cumpleañero ─────────────────────────────────────────────
// birthDate IS NOT NULL  AND  MONTH(birthDate) === currentMonthMX()
// El tag cubre el MES completo (no día). Cron diario garantiza entry/exit
// limpio en el cambio de mes.

function currentMonthMX(): number {
  return mxParts(new Date()).m; // 0–11
}

async function birthdayMatches(db: DB, userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { birthDate: true },
  });
  if (!user?.birthDate) return false;
  return user.birthDate.getUTCMonth() === currentMonthMX();
}

async function birthdayFindAll(db: DB): Promise<Set<string>> {
  // Postgres puede filtrar por mes con raw SQL pero usar Prisma para
  // mantener portabilidad. Volumen de users con birthDate es bajo (~cientos).
  const users = await db.user.findMany({
    where:  { birthDate: { not: null } },
    select: { id: true, birthDate: true },
  });
  const month = currentMonthMX();
  return new Set(
    users
      .filter((u) => u.birthDate && u.birthDate.getUTCMonth() === month)
      .map((u) => u.id),
  );
}

// ─── Regla: Grupo grande ────────────────────────────────────────────
// EXISTS Reservation WHERE userId AND guests > 8
//   AND date > now - 6 months
//   AND status NOT IN (CANCELLED, NO_SHOW)

const LARGE_GROUP_MIN = 8;
const LARGE_GROUP_MONTHS = 6;

function largeGroupCutoff(now = new Date()): Date {
  // Aproximación a 6 meses = 180 días. Suficiente para "relevancia operativa".
  return new Date(now.getTime() - LARGE_GROUP_MONTHS * 30 * 86400000);
}

async function largeGroupMatches(db: DB, userId: string): Promise<boolean> {
  const cutoff = largeGroupCutoff();
  const r = await db.reservation.findFirst({
    where: {
      userId,
      guests: { gt: LARGE_GROUP_MIN },
      date:   { gt: cutoff },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { id: true },
  });
  return r !== null;
}

async function largeGroupFindAll(db: DB): Promise<Set<string>> {
  const cutoff = largeGroupCutoff();
  const rows = await db.reservation.findMany({
    where: {
      guests: { gt: LARGE_GROUP_MIN },
      date:   { gt: cutoff },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    distinct: ["userId"],
    select:   { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

// ─── Registro de reglas ─────────────────────────────────────────────

export const RULES: TagRule[] = [
  { tagName: "VIP",          predicate: vipMatches,        findMatchingUserIds: vipFindAll        },
  { tagName: "Inactivo",     predicate: inactiveMatches,   findMatchingUserIds: inactiveFindAll   },
  { tagName: "Cumpleañero",  predicate: birthdayMatches,   findMatchingUserIds: birthdayFindAll   },
  { tagName: "Grupo grande", predicate: largeGroupMatches, findMatchingUserIds: largeGroupFindAll },
];

export function getRule(tagName: string): TagRule | undefined {
  return RULES.find((r) => r.tagName === tagName);
}

// ─── reEvalUserRule — trigger en tiempo real ────────────────────────

/**
 * Re-evalúa una sola regla sobre un solo usuario. Usado por los triggers
 * fire-and-forget (checkin COMPLETED → VIP, reservation create → Inactivo,
 * user create birthMonth → Cumpleañero). NO usar en bucles — el cron tiene
 * `runAutoTagJob()` que es órdenes de magnitud más eficiente.
 *
 * Idempotente. Respeta MANUAL siempre.
 *
 * Race condition documentada: si el cron está corriendo simultáneamente
 * (improbable a las 02:00 MX), `upsert` y `deleteMany {source: AUTO_RULE}`
 * son safe — la regla del Plan agent.
 */
export async function reEvalUserRule(
  userId: string,
  tagName: string,
): Promise<void> {
  const rule = getRule(tagName);
  if (!rule) {
    console.error(`[AUTO_TAG] reEvalUserRule: unknown rule "${tagName}"`);
    return;
  }

  const tag = await prisma.tag.findUnique({
    where:  { name: tagName },
    select: { id: true, isActive: true },
  });
  if (!tag || !tag.isActive) {
    // Tag desactivado o no existe en catálogo — skip silencioso.
    return;
  }

  const matches = await rule.predicate(prisma, userId);
  const existing = await prisma.userTag.findUnique({
    where:  { userId_tagId: { userId, tagId: tag.id } },
    select: { id: true, source: true },
  });

  if (matches && !existing) {
    // Limitación conocida: si el admin hizo hard-delete de un MANUAL para
    // excluir explícitamente al user, ese MANUAL se re-aplica como AUTO_RULE
    // aquí (sin tabla de tombstones no podemos distinguir). Para excluir
    // permanentemente, aplicar el tag y dejarlo en source=MANUAL.
    await prisma.userTag.create({
      data: {
        userId, tagId: tag.id,
        source: "AUTO_RULE",
        appliedById: "system:cron-rules",
      },
    }).catch((err: unknown) => {
      // P2002 = race entre dos triggers concurrentes → idempotente OK.
      const e = err as { code?: string };
      if (e?.code !== "P2002") throw err;
    });
    console.log(`[AUTO_TAG] reEval ${tagName}: applied to user=${userId}`);
  } else if (!matches && existing?.source === "AUTO_RULE") {
    await prisma.userTag.deleteMany({
      where: { userId, tagId: tag.id, source: "AUTO_RULE" },
    });
    console.log(`[AUTO_TAG] reEval ${tagName}: removed from user=${userId}`);
  }
  // matches && existing.MANUAL → no-op (admin fijó manualmente)
  // matches && existing.AUTO_RULE → no-op (idempotente)
  // !matches && existing.MANUAL → no-op (admin lo aplicó a mano, respetar)
  // !matches && !existing → no-op
}
