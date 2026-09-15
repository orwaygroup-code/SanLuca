/**
 * Tests de checkReservationDateTime (validación PURA de fecha/hora de reserva).
 *   npx tsx --test tests/reservationRules.test.ts
 *
 * DEFAULT_SCHEDULE: lunes cerrado, domingo abre 08:00–21:00, sábado 08:00–24:00.
 * `now` fijo = mié 16 sep 2026 12:00 (MX). Fechas con sufijo -06:00 para fijar el
 * día/hora en México (UTC-6, sin horario de verano).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkReservationDateTime } from "../lib/reservationRules";
import { DEFAULT_SCHEDULE } from "../lib/shifts";

const NOW = new Date("2026-09-16T12:00:00.000-06:00").getTime(); // miércoles
const at = (iso: string) => new Date(iso);

test("(a) fecha de ayer → 400 «ya pasaron»", () => {
  assert.deepEqual(
    checkReservationDateTime(at("2026-09-15T14:00:00.000-06:00"), DEFAULT_SCHEDULE, {}, NOW),
    { ok: false, status: 400, error: "La fecha y hora ya pasaron" },
  );
});

test("(b) lunes próximo 14:00 → 409 «no abre»", () => {
  assert.deepEqual(
    checkReservationDateTime(at("2026-09-21T14:00:00.000-06:00"), DEFAULT_SCHEDULE, {}, NOW),
    { ok: false, status: 409, error: "El restaurante no abre ese día" },
  );
});

test("(c) lunes con allowClosedDay → ok", () => {
  assert.deepEqual(
    checkReservationDateTime(at("2026-09-21T14:00:00.000-06:00"), DEFAULT_SCHEDULE, { allowClosedDay: true }, NOW),
    { ok: true },
  );
});

test("(d) domingo 22:00 → 409 «Fuera del horario»", () => {
  assert.deepEqual(
    checkReservationDateTime(at("2026-09-20T22:00:00.000-06:00"), DEFAULT_SCHEDULE, {}, NOW),
    { ok: false, status: 409, error: "Fuera del horario de servicio (08:00–21:00)" },
  );
});

test("(e) sábado 20:00 → ok", () => {
  assert.deepEqual(
    checkReservationDateTime(at("2026-09-19T20:00:00.000-06:00"), DEFAULT_SCHEDULE, {}, NOW),
    { ok: true },
  );
});

test("(f) hace 30 min → ok (tolerancia 1 h)", () => {
  assert.deepEqual(
    checkReservationDateTime(new Date(NOW - 30 * 60 * 1000), DEFAULT_SCHEDULE, {}, NOW),
    { ok: true },
  );
});
