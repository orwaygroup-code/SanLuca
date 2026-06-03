/**
 * Tests unitarios del helper de conflicto de mesas. Sin DB — mock manual
 * del PrismaClient (mismo patrón que tests/tagRules.test.ts).
 *
 * Ejecutar:
 *   npx tsx --test tests/tableConflict.test.ts
 *
 * Reglas validadas (ver lib/tableConflict.ts) — modelo POR TURNO:
 *   - COMPLETED / CANCELLED / NO_SHOW NO bloquean.
 *   - Bloquea si la reserva existente cae en el MISMO turno (brunch/cena)
 *     que la nueva. El turnover ±4h fue eliminado (Fase A).
 *   - Match contra tableId / linkedTableId / thirdTableId / fourthTableId.
 *   - excludeReservationId evita auto-conflicto en edición.
 *
 * Fechas con offset -06:00 (hora México) para que el turno sea inequívoco.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { findTableConflict, findOccupiedTableIds } from "../lib/tableConflict";

interface MockReservation {
  id:             string;
  date:           Date;
  status:         "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DELAYED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "PENDING_PAYMENT";
  guestName:      string;
  tableId:        string | null;
  linkedTableId:  string | null;
  thirdTableId:   string | null;
  fourthTableId:  string | null;
}

function makeMock(rows: MockReservation[]) {
  const matches = (r: MockReservation, where: Record<string, unknown>): boolean => {
    if (where.status && typeof where.status === "object") {
      const s = where.status as { notIn?: string[] };
      if (s.notIn && s.notIn.includes(r.status)) return false;
    }
    if (where.date && typeof where.date === "object") {
      const d = where.date as { gt?: Date; gte?: Date; lt?: Date; lte?: Date };
      if (d.gt  && !(r.date.getTime() >  d.gt.getTime()))  return false;
      if (d.gte && !(r.date.getTime() >= d.gte.getTime())) return false;
      if (d.lt  && !(r.date.getTime() <  d.lt.getTime()))  return false;
      if (d.lte && !(r.date.getTime() <= d.lte.getTime())) return false;
    }
    if (where.NOT && typeof where.NOT === "object") {
      const n = where.NOT as { id?: string };
      if (n.id && r.id === n.id) return false;
    }
    if (where.OR && Array.isArray(where.OR)) {
      const ok = (where.OR as Array<Record<string, string>>).some((branch) => {
        const [k, v] = Object.entries(branch)[0];
        return (r as unknown as Record<string, string | null>)[k] === v;
      });
      if (!ok) return false;
    }
    return true;
  };

  return {
    reservation: {
      findFirst: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: { date: "asc" | "desc" } }) => {
        const m = rows.filter((r) => matches(r, where));
        const ord = orderBy?.date === "desc" ? -1 : 1;
        m.sort((a, b) => ord * (a.date.getTime() - b.date.getTime()));
        return m[0] ?? null;
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => matches(r, where)),
    },
  } as unknown as Parameters<typeof findTableConflict>[0];
}

const t = (iso: string) => new Date(iso);
const row = (over: Partial<MockReservation>): MockReservation => ({
  id: "r1", date: t("2026-05-26T19:00:00-06:00"), status: "CONFIRMED", guestName: "x",
  tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null, ...over,
});

// ─── Estados que no bloquean ────────────────────────────────────────
for (const status of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
  test(`${status} no bloquea aunque sea misma hora/turno`, async () => {
    const db = makeMock([row({ status })]);
    assert.equal(
      await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-26T19:00:00-06:00") }),
      null,
    );
  });
}

// ─── Modelo por TURNO (sin ±4h) ─────────────────────────────────────
test("misma cena BLOQUEA aunque estén a 4h (turnover ±4h eliminado)", async () => {
  // Antes: 14:30 + 18:30 = exacto 4h → permitía. Ahora: mismo turno cena → bloquea.
  const db = makeMock([row({ date: t("2026-05-26T14:30:00-06:00") })]);
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-26T18:30:00-06:00"),
  });
  assert.ok(conflict, "misma mesa en el mismo turno de cena debe bloquear");
  assert.equal(conflict?.id, "r1");
});

test("brunch vs cena = distinto turno → PERMITE", async () => {
  const db = makeMock([row({ date: t("2026-05-26T10:00:00-06:00") })]); // brunch
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-26T20:00:00-06:00"), // cena
  });
  assert.equal(conflict, null);
});

test("misma hora exacta bloquea", async () => {
  const db = makeMock([row({ date: t("2026-05-26T19:00:00-06:00") })]);
  assert.ok(await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-26T19:00:00-06:00") }));
});

test("otro día, mismo horario → distinto turno → permite", async () => {
  const db = makeMock([row({ date: t("2026-05-27T19:00:00-06:00") })]);
  assert.equal(
    await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-26T19:00:00-06:00") }),
    null,
  );
});

// ─── Match contra posiciones de mesa ────────────────────────────────
test("matchea contra linkedTableId", async () => {
  const db = makeMock([row({ tableId: "tX", linkedTableId: "tA" })]);
  assert.ok(await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-26T19:00:00-06:00") }));
});

test("no matchea si la mesa es distinta", async () => {
  const db = makeMock([row({ tableId: "tA" })]);
  assert.equal(await findTableConflict(db, { tableIds: ["tB"], reservationDate: t("2026-05-26T19:00:00-06:00") }), null);
});

// ─── excludeReservationId (edición) ─────────────────────────────────
test("excludeReservationId evita auto-conflicto", async () => {
  const db = makeMock([row({ id: "r1" })]);
  assert.equal(
    await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-26T19:00:00-06:00"), excludeReservationId: "r1" }),
    null,
  );
});

// ─── tableIds vacío ─────────────────────────────────────────────────
test("tableIds vacío devuelve null (corto-circuito)", async () => {
  assert.equal(await findTableConflict(makeMock([]), { tableIds: [], reservationDate: t("2026-05-26T19:00:00-06:00") }), null);
});

// ─── findOccupiedTableIds (bulk para autoAssign) ────────────────────
test("findOccupiedTableIds agrupa el turno; excluye COMPLETED y otros turnos", async () => {
  const db = makeMock([
    row({ id: "r1", date: t("2026-05-26T19:00:00-06:00"), tableId: "tA", linkedTableId: "tB" }),
    row({ id: "r2", date: t("2026-05-26T20:00:00-06:00"), status: "PENDING", tableId: "tC", thirdTableId: "tD" }),
    row({ id: "r3", date: t("2026-05-26T19:00:00-06:00"), status: "COMPLETED", tableId: "tE" }),
    row({ id: "r4", date: t("2026-05-26T10:00:00-06:00"), tableId: "tF" }), // brunch, otro turno
  ]);
  const occupied = await findOccupiedTableIds(db, t("2026-05-26T21:00:00-06:00")); // cena
  assert.deepEqual([...occupied].sort(), ["tA", "tB", "tC", "tD"]);
});
