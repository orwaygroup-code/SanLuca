/**
 * Tests unitarios del helper de conflicto de mesas. Sin DB — mock manual
 * del PrismaClient (mismo patrón que tests/tagRules.test.ts).
 *
 * Ejecutar:
 *   npx tsx --test tests/tableConflict.test.ts
 *
 * Reglas validadas (ver lib/tableConflict.ts) — ventana ±3.5h:
 *   - COMPLETED / CANCELLED / NO_SHOW NO bloquean.
 *   - Separación < 3.5h bloquea; == 3.5h o > 3.5h permite (gt/lt exclusivos).
 *   - Match contra tableId / linkedTableId / thirdTableId / fourthTableId.
 *   - excludeReservationId evita auto-conflicto en edición.
 *
 * La ventana es tz-agnóstica (diferencia en ms), por eso usamos timestamps UTC.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findTableConflict,
  findOccupiedTableIds,
  getReservationWindow,
  RESERVATION_WINDOW_HOURS,
} from "../lib/tableConflict";

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
  id: "r1", date: t("2026-05-25T19:00:00Z"), status: "CONFIRMED", guestName: "x",
  tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null, ...over,
});

// ─── Sanity ─────────────────────────────────────────────────────────
test("RESERVATION_WINDOW_HOURS === 3.5", () => {
  assert.equal(RESERVATION_WINDOW_HOURS, 3.5);
});

test("getReservationWindow devuelve date ± 3.5h", () => {
  const { from, to } = getReservationWindow(t("2026-05-25T19:00:00Z"));
  assert.equal(from.toISOString(), "2026-05-25T15:30:00.000Z");
  assert.equal(to.toISOString(),   "2026-05-25T22:30:00.000Z");
});

// ─── Estados que no bloquean ────────────────────────────────────────
for (const status of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
  test(`${status} no bloquea aunque sea misma hora`, async () => {
    const db = makeMock([row({ status })]);
    assert.equal(await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T19:00:00Z") }), null);
  });
}

// ─── Separaciones (criterios de aceptación) ─────────────────────────
test("2 reservas misma mesa separadas 4h → PERMITE (4h > 3.5h)", async () => {
  const db = makeMock([row({ date: t("2026-05-25T19:00:00Z") })]);
  const conflict = await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T23:00:00Z") });
  assert.equal(conflict, null);
});

test("2 reservas misma mesa separadas 3h → RECHAZA (3h < 3.5h)", async () => {
  const db = makeMock([row({ date: t("2026-05-25T19:00:00Z") })]);
  const conflict = await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T22:00:00Z") });
  assert.ok(conflict, "separación de 3h debe bloquear");
  assert.equal(conflict?.id, "r1");
});

test("2 reservas misma mesa separadas EXACTO 3.5h → PERMITE (límite inclusivo)", async () => {
  const db = makeMock([row({ date: t("2026-05-25T19:00:00Z") })]);
  const conflict = await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T22:30:00Z") });
  assert.equal(conflict, null, "exacto 3.5h debe permitir");
});

test("ventana simétrica — 3.5h ANTES también permite", async () => {
  const db = makeMock([row({ date: t("2026-05-25T22:30:00Z") })]);
  const conflict = await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T19:00:00Z") });
  assert.equal(conflict, null);
});

test("misma hora exacta (diff 0) bloquea", async () => {
  const db = makeMock([row({ date: t("2026-05-25T19:00:00Z") })]);
  assert.ok(await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T19:00:00Z") }));
});

// ─── Match contra posiciones de mesa ────────────────────────────────
test("matchea contra linkedTableId dentro de la ventana", async () => {
  const db = makeMock([row({ tableId: "tX", linkedTableId: "tA", date: t("2026-05-25T20:00:00Z") })]);
  assert.ok(await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T19:00:00Z") }));
});

test("no matchea si la mesa es distinta", async () => {
  const db = makeMock([row({ tableId: "tA" })]);
  assert.equal(await findTableConflict(db, { tableIds: ["tB"], reservationDate: t("2026-05-25T19:00:00Z") }), null);
});

// ─── excludeReservationId (edición) ─────────────────────────────────
test("excludeReservationId evita auto-conflicto", async () => {
  const db = makeMock([row({ id: "r1" })]);
  assert.equal(
    await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T19:00:00Z"), excludeReservationId: "r1" }),
    null,
  );
});

// ─── tableIds vacío ─────────────────────────────────────────────────
test("tableIds vacío devuelve null (corto-circuito)", async () => {
  assert.equal(await findTableConflict(makeMock([]), { tableIds: [], reservationDate: t("2026-05-25T19:00:00Z") }), null);
});

// ─── findOccupiedTableIds (bulk para autoAssign) ────────────────────
test("findOccupiedTableIds agrupa la ventana; excluye COMPLETED y fuera de ±3.5h", async () => {
  const db = makeMock([
    row({ id: "r1", date: t("2026-05-25T19:00:00Z"), tableId: "tA", linkedTableId: "tB" }),
    row({ id: "r2", date: t("2026-05-25T21:00:00Z"), status: "PENDING", tableId: "tC", thirdTableId: "tD" }),
    row({ id: "r3", date: t("2026-05-25T19:00:00Z"), status: "COMPLETED", tableId: "tE" }),
    row({ id: "r4", date: t("2026-05-25T23:00:00Z"), tableId: "tF" }), // 4h después → fuera de ventana
  ]);
  const occupied = await findOccupiedTableIds(db, t("2026-05-25T19:00:00Z"));
  assert.deepEqual([...occupied].sort(), ["tA", "tB", "tC", "tD"]);
});
