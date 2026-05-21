/**
 * Tests unitarios de los predicates de lib/tagRules.ts.
 * Sin DB: se inyecta un mock manual del PrismaClient con datos sintéticos.
 *
 * Ejecutar:
 *   npx tsx --test tests/tagRules.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { RULES, getRule } from "../lib/tagRules";

// ─── Mock de Prisma minimalista ─────────────────────────────────────
// Solo implementa los métodos que las reglas usan. `findFirst`, `count`,
// `findMany`, `findUnique`, `groupBy`. Devuelve datos en memoria.

type Fixture = {
  reservations: Array<{
    id:     string;
    userId: string;
    date:   Date;
    guests: number;
    status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  }>;
  users: Array<{ id: string; birthDate: Date | null }>;
};

function makeMock(fx: Fixture) {
  const matchWhere = <T extends Record<string, unknown>>(rows: T[], where: unknown): T[] => {
    const w = where as Record<string, unknown> | undefined;
    if (!w) return rows;
    return rows.filter((r) => {
      for (const [k, v] of Object.entries(w)) {
        const rv = (r as Record<string, unknown>)[k];
        if (v === null || v === undefined) continue;
        if (typeof v === "object") {
          const vv = v as Record<string, unknown>;
          if ("gt"    in vv && !((rv as number | Date) >  (vv.gt    as number | Date))) return false;
          if ("gte"   in vv && !((rv as number | Date) >= (vv.gte   as number | Date))) return false;
          if ("lt"    in vv && !((rv as number | Date) <  (vv.lt    as number | Date))) return false;
          if ("notIn" in vv && (vv.notIn as unknown[]).includes(rv))                    return false;
          if ("not"   in vv && vv.not === null && rv === null)                          return false;
        } else {
          if (rv !== v) return false;
        }
      }
      return true;
    });
  };

  const orderDescDate = <T extends { date: Date }>(rows: T[]): T[] =>
    [...rows].sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    reservation: {
      count: async ({ where }: { where: unknown }) => matchWhere(fx.reservations, where).length,

      findFirst: async ({ where, orderBy }: { where: unknown; orderBy?: { date?: "desc" | "asc" } }) => {
        let rows = matchWhere(fx.reservations, where);
        if (orderBy?.date === "desc") rows = orderDescDate(rows);
        return rows[0] ?? null;
      },

      findMany: async ({ where, distinct }: { where?: unknown; distinct?: string[] }) => {
        let rows = matchWhere(fx.reservations, where);
        if (distinct?.includes("userId")) {
          const seen = new Set<string>();
          rows = rows.filter((r) => (seen.has(r.userId) ? false : (seen.add(r.userId), true)));
        }
        return rows;
      },

      groupBy: async ({ where, having, _max }: {
        where?: unknown;
        having?: { userId?: { _count?: { gte?: number } } };
        _max?: unknown;
      }) => {
        const rows = matchWhere(fx.reservations, where);
        const buckets = new Map<string, typeof rows>();
        for (const r of rows) {
          if (!buckets.has(r.userId)) buckets.set(r.userId, []);
          buckets.get(r.userId)!.push(r);
        }
        let out = Array.from(buckets.entries()).map(([userId, items]) => ({
          userId,
          _count: { _all: items.length },
          _max:   _max ? { date: items.reduce((mx, x) => (x.date > mx ? x.date : mx), items[0].date) } : undefined,
        }));
        const gte = having?.userId?._count?.gte;
        if (typeof gte === "number") out = out.filter((b) => b._count._all >= gte);
        return out;
      },
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        fx.users.find((u) => u.id === where.id) ?? null,
      findMany: async ({ where }: { where?: { birthDate?: { not: null } } }) => {
        if (where?.birthDate?.not === null) return fx.users.filter((u) => u.birthDate !== null);
        return fx.users;
      },
    },
  } as unknown as Parameters<typeof RULES[number]["predicate"]>[0];
}

const days = (n: number) => n * 86400000;
const now  = new Date("2026-05-20T12:00:00Z");

// ─── VIP ────────────────────────────────────────────────────────────

test("VIP: matchea con 5 COMPLETED", async () => {
  const db = makeMock({
    reservations: Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`, userId: "u1", date: new Date(now.getTime() - days(10 + i)),
      guests: 2, status: "COMPLETED" as const,
    })),
    users: [],
  });
  assert.equal(await getRule("VIP")!.predicate(db, "u1"), true);
});

test("VIP: NO matchea con 4 COMPLETED", async () => {
  const db = makeMock({
    reservations: Array.from({ length: 4 }, (_, i) => ({
      id: `r${i}`, userId: "u1", date: new Date(), guests: 2, status: "COMPLETED" as const,
    })),
    users: [],
  });
  assert.equal(await getRule("VIP")!.predicate(db, "u1"), false);
});

test("VIP: ignora CANCELLED / NO_SHOW al contar", async () => {
  const db = makeMock({
    reservations: [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `r${i}`, userId: "u1", date: new Date(), guests: 2, status: "COMPLETED" as const,
      })),
      { id: "c1", userId: "u1", date: new Date(), guests: 2, status: "CANCELLED" },
      { id: "c2", userId: "u1", date: new Date(), guests: 2, status: "NO_SHOW"   },
    ],
    users: [],
  });
  assert.equal(await getRule("VIP")!.predicate(db, "u1"), false);
});

test("VIP findAll: incluye usuarios distintos con ≥5 COMPLETED", async () => {
  const db = makeMock({
    reservations: [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, userId: "uA", date: new Date(), guests: 2, status: "COMPLETED" as const })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, userId: "uB", date: new Date(), guests: 2, status: "COMPLETED" as const })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `c${i}`, userId: "uC", date: new Date(), guests: 2, status: "COMPLETED" as const })),
    ],
    users: [],
  });
  const matched = await getRule("VIP")!.findMatchingUserIds(db);
  assert.deepEqual([...matched].sort(), ["uA", "uB"]);
});

// ─── Inactivo ───────────────────────────────────────────────────────

test("Inactivo: matchea cuando última reserva fue hace >90 días", async () => {
  const db = makeMock({
    reservations: [
      { id: "r1", userId: "u1", date: new Date(now.getTime() - days(120)), guests: 2, status: "COMPLETED" },
    ],
    users: [],
  });
  assert.equal(await getRule("Inactivo")!.predicate(db, "u1"), true);
});

test("Inactivo: NO matchea con reserva reciente (<90 días)", async () => {
  const db = makeMock({
    reservations: [
      { id: "r1", userId: "u1", date: new Date(now.getTime() - days(120)), guests: 2, status: "COMPLETED" },
      { id: "r2", userId: "u1", date: new Date(now.getTime() - days(30)),  guests: 2, status: "CONFIRMED" },
    ],
    users: [],
  });
  assert.equal(await getRule("Inactivo")!.predicate(db, "u1"), false);
});

test("Inactivo: NO matchea para users sin reservas (nuevos, no inactivos)", async () => {
  const db = makeMock({ reservations: [], users: [] });
  assert.equal(await getRule("Inactivo")!.predicate(db, "u1"), false);
});

// ─── Cumpleañero ────────────────────────────────────────────────────

test("Cumpleañero: matchea si MONTH(birthDate) === mes actual MX", async () => {
  // Hoy en MX (UTC-6) — usamos el mes actual derivado por el helper.
  const today = new Date();
  const mxOffset = 6 * 3600 * 1000;
  const mxToday = new Date(today.getTime() - mxOffset);
  const month = mxToday.getUTCMonth();
  const birthDate = new Date(Date.UTC(1990, month, 15));

  const db = makeMock({
    reservations: [],
    users: [{ id: "u1", birthDate }],
  });
  assert.equal(await getRule("Cumpleañero")!.predicate(db, "u1"), true);
});

test("Cumpleañero: NO matchea si mes distinto", async () => {
  const today = new Date();
  const mxOffset = 6 * 3600 * 1000;
  const mxToday = new Date(today.getTime() - mxOffset);
  const month = mxToday.getUTCMonth();
  const otherMonth = (month + 6) % 12;
  const birthDate = new Date(Date.UTC(1990, otherMonth, 15));

  const db = makeMock({
    reservations: [],
    users: [{ id: "u1", birthDate }],
  });
  assert.equal(await getRule("Cumpleañero")!.predicate(db, "u1"), false);
});

test("Cumpleañero: NO matchea si birthDate es null", async () => {
  const db = makeMock({
    reservations: [],
    users: [{ id: "u1", birthDate: null }],
  });
  assert.equal(await getRule("Cumpleañero")!.predicate(db, "u1"), false);
});

// ─── Grupo grande ───────────────────────────────────────────────────

test("Grupo grande: matchea con reserva guests=9 últimos 6 meses", async () => {
  const db = makeMock({
    reservations: [
      { id: "r1", userId: "u1", date: new Date(now.getTime() - days(30)), guests: 9, status: "COMPLETED" },
    ],
    users: [],
  });
  assert.equal(await getRule("Grupo grande")!.predicate(db, "u1"), true);
});

test("Grupo grande: NO matchea con guests=8 (umbral es > 8)", async () => {
  const db = makeMock({
    reservations: [
      { id: "r1", userId: "u1", date: new Date(now.getTime() - days(30)), guests: 8, status: "COMPLETED" },
    ],
    users: [],
  });
  assert.equal(await getRule("Grupo grande")!.predicate(db, "u1"), false);
});

test("Grupo grande: NO matchea con reserva CANCELLED", async () => {
  const db = makeMock({
    reservations: [
      { id: "r1", userId: "u1", date: new Date(now.getTime() - days(30)), guests: 10, status: "CANCELLED" },
    ],
    users: [],
  });
  assert.equal(await getRule("Grupo grande")!.predicate(db, "u1"), false);
});

test("Grupo grande: NO matchea con reserva de hace >6 meses", async () => {
  const db = makeMock({
    reservations: [
      { id: "r1", userId: "u1", date: new Date(now.getTime() - days(200)), guests: 12, status: "COMPLETED" },
    ],
    users: [],
  });
  assert.equal(await getRule("Grupo grande")!.predicate(db, "u1"), false);
});

// ─── Registro de reglas ─────────────────────────────────────────────

test("RULES: las 4 reglas están registradas con los nombres exactos", () => {
  const names = RULES.map((r) => r.tagName).sort();
  assert.deepEqual(names, ["Cumpleañero", "Grupo grande", "Inactivo", "VIP"]);
});

test("getRule: devuelve la regla por nombre y undefined si no existe", () => {
  assert.ok(getRule("VIP"));
  assert.equal(getRule("Inexistente"), undefined);
});
