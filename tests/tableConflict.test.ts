/**
 * Tests unitarios del helper de conflicto de mesas. Sin DB — mock manual
 * del PrismaClient (mismo patrón que tests/tagRules.test.ts).
 *
 * Ejecutar:
 *   npx tsx --test tests/tableConflict.test.ts
 *
 * Reglas validadas (ver lib/tableConflict.ts):
 *   - COMPLETED / CANCELLED / NO_SHOW NO bloquean.
 *   - Ventana ±4h estricta (gt/lt): diff < 4h bloquea, diff >= 4h permite.
 *   - Match contra tableId / linkedTableId / thirdTableId / fourthTableId.
 *   - excludeReservationId evita auto-conflicto en edición.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { findTableConflict, findOccupiedTableIds, CONFLICT_WINDOW_MS } from "../lib/tableConflict";

// ─── Fixture / mock ──────────────────────────────────────────────────

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
    // status notIn
    if (where.status && typeof where.status === "object") {
      const s = where.status as { notIn?: string[] };
      if (s.notIn && s.notIn.includes(r.status)) return false;
    }
    // date gt/lt
    if (where.date && typeof where.date === "object") {
      const d = where.date as { gt?: Date; lt?: Date };
      if (d.gt && !(r.date.getTime() > d.gt.getTime())) return false;
      if (d.lt && !(r.date.getTime() < d.lt.getTime())) return false;
    }
    // NOT.id
    if (where.NOT && typeof where.NOT === "object") {
      const n = where.NOT as { id?: string };
      if (n.id && r.id === n.id) return false;
    }
    // OR for tables: any branch true
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
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        return rows.filter((r) => matches(r, where));
      },
    },
  } as unknown as Parameters<typeof findTableConflict>[0];
}

const t = (iso: string) => new Date(iso);

// ─── COMPLETED / CANCELLED / NO_SHOW no bloquean ────────────────────

test("COMPLETED no bloquea aunque sea misma hora", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T19:00:00Z"), status: "COMPLETED",
      guestName: "Pedro", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-25T19:00:00Z"),
  });
  assert.equal(conflict, null);
});

test("CANCELLED no bloquea", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T19:00:00Z"), status: "CANCELLED",
      guestName: "x", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  assert.equal(await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T19:00:00Z") }), null);
});

test("NO_SHOW no bloquea", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T19:00:00Z"), status: "NO_SHOW",
      guestName: "x", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  assert.equal(await findTableConflict(db, { tableIds: ["tA"], reservationDate: t("2026-05-25T19:00:00Z") }), null);
});

// ─── Ventana ±4h estricta ───────────────────────────────────────────

test("diff exacto 4h PERMITE (turnover natural brunch→cena)", async () => {
  // Brunch 14:30 ya reservada. Cena 18:30 = exacto 4h después → debe permitir.
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T14:30:00Z"), status: "CONFIRMED",
      guestName: "Pedro", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-25T18:30:00Z"),
  });
  assert.equal(conflict, null, "exacto 4h debe permitir");
});

test("diff 3h 59min BLOQUEA", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T14:30:00Z"), status: "CONFIRMED",
      guestName: "Pedro", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-25T18:29:00Z"),  // 3h 59min después
  });
  assert.ok(conflict);
  assert.equal(conflict?.id, "r1");
});

test("diff 4h 1min PERMITE", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T14:30:00Z"), status: "CONFIRMED",
      guestName: "x", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-25T18:31:00Z"),
  });
  assert.equal(conflict, null);
});

test("ventana es simétrica — reserva 4h ANTES también permite", async () => {
  // Existente 18:30. Nueva 14:30 → diff 4h exacto, ANTES → permite.
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T18:30:00Z"), status: "CONFIRMED",
      guestName: "x", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-25T14:30:00Z"),
  });
  assert.equal(conflict, null);
});

test("diff 0 (misma hora exacta) bloquea", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T19:00:00Z"), status: "CONFIRMED",
      guestName: "x", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-25T19:00:00Z"),
  });
  assert.ok(conflict);
});

// ─── Match contra distintas posiciones de mesa ──────────────────────

test("matchea contra linkedTableId", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T19:00:00Z"), status: "CONFIRMED",
      guestName: "x", tableId: "tX", linkedTableId: "tA", thirdTableId: null, fourthTableId: null },
  ]);
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-25T19:00:00Z"),
  });
  assert.ok(conflict);
});

test("no matchea si la mesa es distinta", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T19:00:00Z"), status: "CONFIRMED",
      guestName: "x", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  const conflict = await findTableConflict(db, {
    tableIds: ["tB"],
    reservationDate: t("2026-05-25T19:00:00Z"),
  });
  assert.equal(conflict, null);
});

// ─── excludeReservationId (caso edición) ────────────────────────────

test("excludeReservationId evita auto-conflicto", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T19:00:00Z"), status: "CONFIRMED",
      guestName: "x", tableId: "tA", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  // Editando r1 al mismo slot → no debe chocar consigo misma.
  const conflict = await findTableConflict(db, {
    tableIds: ["tA"],
    reservationDate: t("2026-05-25T19:00:00Z"),
    excludeReservationId: "r1",
  });
  assert.equal(conflict, null);
});

// ─── tableIds vacío ─────────────────────────────────────────────────

test("tableIds vacío devuelve null (corto-circuito)", async () => {
  const db = makeMock([]);
  const conflict = await findTableConflict(db, {
    tableIds: [],
    reservationDate: t("2026-05-25T19:00:00Z"),
  });
  assert.equal(conflict, null);
});

// ─── findOccupiedTableIds (bulk para autoAssign) ────────────────────

test("findOccupiedTableIds agrupa todas las posiciones de mesa", async () => {
  const db = makeMock([
    { id: "r1", date: t("2026-05-25T19:00:00Z"), status: "CONFIRMED",
      guestName: "x", tableId: "tA", linkedTableId: "tB", thirdTableId: null, fourthTableId: null },
    { id: "r2", date: t("2026-05-25T19:30:00Z"), status: "PENDING",
      guestName: "y", tableId: "tC", linkedTableId: null, thirdTableId: "tD", fourthTableId: null },
    { id: "r3", date: t("2026-05-25T19:00:00Z"), status: "COMPLETED",
      guestName: "z", tableId: "tE", linkedTableId: null, thirdTableId: null, fourthTableId: null },
  ]);
  const occupied = await findOccupiedTableIds(db, t("2026-05-25T19:15:00Z"));
  // r3 está COMPLETED → no cuenta. r1 + r2 → tA, tB, tC, tD.
  assert.deepEqual([...occupied].sort(), ["tA", "tB", "tC", "tD"]);
});

// ─── Sanity check ───────────────────────────────────────────────────

test("CONFLICT_WINDOW_MS === 4 horas exactas", () => {
  assert.equal(CONFLICT_WINDOW_MS, 4 * 3600 * 1000);
});
