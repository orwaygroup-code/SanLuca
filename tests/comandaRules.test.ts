/**
 * Tests de las reglas de permisos y helpers de Comandas. Sin DB.
 *   npx tsx --test tests/comandaRules.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canModifyComanda,
  canCancelItem,
  decidePrint,
  formatFolio,
  buildSplits,
} from "../lib/comandaRules";

// ── canModifyComanda ────────────────────────────────────────────────
test("WAITER y OPERATION solo modifican SUS comandas; supervisores cualquiera", () => {
  assert.equal(canModifyComanda("WAITER", true), true);
  assert.equal(canModifyComanda("WAITER", false), false);  // comanda de otro mesero
  assert.equal(canModifyComanda("CAPTAIN", false), true);
  assert.equal(canModifyComanda("MANAGER", false), true);
  // OPERATION (Perla) SÍ captura sus propias cuentas "para llevar" / sin mesa,
  // pero no las de otros meseros.
  assert.equal(canModifyComanda("OPERATION", true), true);
  assert.equal(canModifyComanda("OPERATION", false), false);
});

// ── canCancelItem ───────────────────────────────────────────────────
test("WAITER cancela PENDING propio, pero NO un item SENT", () => {
  assert.equal(canCancelItem({ role: "WAITER", isOwner: true, itemStatus: "PENDING" }), true);
  assert.equal(canCancelItem({ role: "WAITER", isOwner: true, itemStatus: "SENT" }), false);
  assert.equal(canCancelItem({ role: "WAITER", isOwner: false, itemStatus: "PENDING" }), false);
});

test("CAPTAIN/MANAGER cancelan item SENT", () => {
  assert.equal(canCancelItem({ role: "CAPTAIN", isOwner: false, itemStatus: "SENT" }), true);
  assert.equal(canCancelItem({ role: "MANAGER", isOwner: false, itemStatus: "DELIVERED" }), true);
});

// ── decidePrint (regla 1-print) ─────────────────────────────────────
test("WAITER imprime 1 vez (CUSTOMER_FINAL); segundo intento bloqueado", () => {
  const first = decidePrint({ role: "WAITER", isOwner: true, alreadyPrinted: false });
  assert.equal(first.allowed, true);
  assert.equal(first.type, "CUSTOMER_FINAL");

  const second = decidePrint({ role: "WAITER", isOwner: true, alreadyPrinted: true });
  assert.equal(second.allowed, false); // ya impreso → necesita Capitán/Manager
});

test("CAPTAIN reimprime SOLO con authorizationReason", () => {
  const noReason = decidePrint({ role: "CAPTAIN", isOwner: false, alreadyPrinted: true });
  assert.equal(noReason.allowed, false);

  const ok = decidePrint({ role: "CAPTAIN", isOwner: false, alreadyPrinted: true, authorizationReason: "cliente pidió dividir" });
  assert.equal(ok.allowed, true);
  assert.equal(ok.type, "CUSTOMER_REPRINT");
});

test("WAITER no imprime ticket de comanda ajena", () => {
  assert.equal(decidePrint({ role: "WAITER", isOwner: false, alreadyPrinted: false }).allowed, false);
});

// ── formatFolio ─────────────────────────────────────────────────────
test("formatFolio COM-AAAA-NNNN con 4 dígitos", () => {
  assert.equal(formatFolio(2026, 1), "COM-2026-0001");
  assert.equal(formatFolio(2026, 234), "COM-2026-0234");
  assert.equal(formatFolio(2026, 10000), "COM-2026-10000");
});

// ── buildSplits (por unidad) ────────────────────────────────────────
test("división genera un ticket por grupo con total = Σ unitPrice×qty", () => {
  const itemsById = new Map([
    [1, { unitPriceSnapshot: 200, quantity: 2, lineTotal: 400 }],
    [2, { unitPriceSnapshot: 180, quantity: 1, lineTotal: 180 }],
    [3, { unitPriceSnapshot: 350, quantity: 1, lineTotal: 350 }],
  ]);
  const tickets = buildSplits(
    [
      { units: [{ itemId: 1, quantity: 1 }] },
      { units: [{ itemId: 1, quantity: 1 }, { itemId: 2, quantity: 1 }, { itemId: 3, quantity: 1 }] },
    ],
    itemsById,
  );
  assert.equal(tickets.length, 2);
  assert.deepEqual(tickets[0], { ticketNumber: 1, units: [{ itemId: 1, quantity: 1 }], total: 200 });
  assert.deepEqual(tickets[1], {
    ticketNumber: 2,
    units: [{ itemId: 1, quantity: 1 }, { itemId: 2, quantity: 1 }, { itemId: 3, quantity: 1 }],
    total: 730,
  });
});
