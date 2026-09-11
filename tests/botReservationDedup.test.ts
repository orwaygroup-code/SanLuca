import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameBotReservation } from "../lib/reservations";

// Regla pura de deduplicación del bot de WhatsApp. Ver app/api/bot/reservation/route.ts.
const base = new Date("2026-09-15T20:00:00.000-06:00");
const phone = "4491234567";

test("mismo teléfono + misma fecha + activa → true", () => {
  assert.equal(
    isSameBotReservation({ guestPhone: phone, date: base, status: "CONFIRMED" }, { guestPhone: phone, date: base }),
    true,
  );
  assert.equal(
    isSameBotReservation({ guestPhone: phone, date: base, status: "PENDING" }, { guestPhone: phone, date: base }),
    true,
  );
  // La fecha puede venir como string ISO (JSON) y debe compararse por instante.
  assert.equal(
    isSameBotReservation({ guestPhone: phone, date: base.toISOString(), status: "CONFIRMED" }, { guestPhone: phone, date: base }),
    true,
  );
});

test("CANCELLED o NO_SHOW → false", () => {
  assert.equal(
    isSameBotReservation({ guestPhone: phone, date: base, status: "CANCELLED" }, { guestPhone: phone, date: base }),
    false,
  );
  assert.equal(
    isSameBotReservation({ guestPhone: phone, date: base, status: "NO_SHOW" }, { guestPhone: phone, date: base }),
    false,
  );
});

test("distinta fecha → false", () => {
  const otra = new Date("2026-09-15T21:00:00.000-06:00");
  assert.equal(
    isSameBotReservation({ guestPhone: phone, date: base, status: "CONFIRMED" }, { guestPhone: phone, date: otra }),
    false,
  );
});

test("distinto teléfono → false", () => {
  assert.equal(
    isSameBotReservation({ guestPhone: phone, date: base, status: "CONFIRMED" }, { guestPhone: "4497654321", date: base }),
    false,
  );
});
