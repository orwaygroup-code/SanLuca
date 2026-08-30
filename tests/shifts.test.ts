/**
 * Turnos de servicio: resolución pura, sin DB.
 *   npx tsx --test tests/shifts.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SCHEDULE,
  resolveShift,
  validateSchedule,
  getTimeSlots,
  isDayOpen,
  parseHm,
  formatHm,
  type ScheduleConfig,
} from "../lib/shifts";

/** Instante en hora de México. */
const mx = (iso: string) => new Date(`${iso}-06:00`);

// ── Resolución del turno ────────────────────────────────────────────
test("el brunch corre de las 08:00 a las 13:00, no hasta la noche", () => {
  assert.equal(resolveShift(mx("2026-08-27T09:00:00")).key, "brunch");
  assert.equal(resolveShift(mx("2026-08-27T12:59:00")).key, "brunch");
  // A las 13:00 en punto ya cambió: era el defecto reportado — el brunch se
  // quedaba corriendo toda la tarde.
  assert.equal(resolveShift(mx("2026-08-27T13:00:00")).key, "cena");
  assert.equal(resolveShift(mx("2026-08-27T21:00:00")).key, "cena");
});

test("la madrugada pertenece al turno de la noche anterior", () => {
  const s = resolveShift(mx("2026-08-28T02:30:00"));
  assert.equal(s.key, "cena");
  // Arrancó el día 27, no el 28: una venta de las 2am no abre turno nuevo.
  assert.equal(s.start.toISOString(), mx("2026-08-27T13:00:00").toISOString());
});

test("el último turno enlaza con el primero del día siguiente", () => {
  const s = resolveShift(mx("2026-08-27T20:00:00"));
  assert.equal(s.end.toISOString(), mx("2026-08-28T08:00:00").toISOString());
});

test("los turnos cubren el día completo, sin huecos ni traslapes", () => {
  // Cada media hora del día debe caer en exactamente un turno, y la ventana
  // resuelta debe contener ese instante.
  for (let m = 0; m < 1440; m += 30) {
    const at = mx(`2026-08-27T${formatHm(m)}:00`);
    const s = resolveShift(at);
    assert.ok(s.key, `sin turno a las ${formatHm(m)}`);
    assert.ok(s.start <= at && at < s.end, `${formatHm(m)} fuera de su ventana (${s.key})`);
  }
});

test("turnos configurables: tres turnos con nombres propios", () => {
  const cfg: ScheduleConfig = {
    days: DEFAULT_SCHEDULE.days,
    shifts: [
      { key: "manana", name: "Mañana", start: "07:00" },
      { key: "tarde", name: "Tarde", start: "14:00" },
      { key: "noche", name: "Noche", start: "20:00" },
    ],
  };
  assert.equal(resolveShift(mx("2026-08-27T08:00:00"), cfg).name, "Mañana");
  assert.equal(resolveShift(mx("2026-08-27T15:00:00"), cfg).name, "Tarde");
  assert.equal(resolveShift(mx("2026-08-27T23:00:00"), cfg).name, "Noche");
  // Antes del primer turno → el último, de ayer.
  assert.equal(resolveShift(mx("2026-08-27T03:00:00"), cfg).name, "Noche");
});

test("renombrar un turno no cambia su clave: el histórico no se rompe", () => {
  const cfg: ScheduleConfig = {
    days: DEFAULT_SCHEDULE.days,
    shifts: [
      { key: "brunch", name: "Desayuno-almuerzo", start: "08:00" },
      { key: "cena", name: "Restaurante", start: "13:00" },
    ],
  };
  const s = resolveShift(mx("2026-08-27T10:00:00"), cfg);
  assert.equal(s.key, "brunch");
  assert.equal(s.name, "Desayuno-almuerzo");
});

// ── Validación ──────────────────────────────────────────────────────
test("validación: rechaza turnos sin nombre, horas inválidas y duplicados", () => {
  assert.equal(validateSchedule(DEFAULT_SCHEDULE).length, 0);

  const sinNombre = { days: DEFAULT_SCHEDULE.days, shifts: [{ key: "a", name: "", start: "08:00" }] };
  assert.ok(validateSchedule(sinNombre).some((e) => e.includes("nombre")));

  const horaMala = { days: DEFAULT_SCHEDULE.days, shifts: [{ key: "a", name: "A", start: "25:99" }] };
  assert.ok(validateSchedule(horaMala).some((e) => e.includes("inválida")));

  const repetida = {
    days: DEFAULT_SCHEDULE.days,
    shifts: [{ key: "a", name: "A", start: "08:00" }, { key: "b", name: "B", start: "08:00" }],
  };
  assert.ok(validateSchedule(repetida).some((e) => e.includes("misma hora")));

  const sinTurnos = { days: DEFAULT_SCHEDULE.days, shifts: [] };
  assert.ok(validateSchedule(sinTurnos).some((e) => e.includes("al menos un turno")));
});

test("validación: el cierre debe ser posterior a la apertura", () => {
  const cfg: ScheduleConfig = {
    days: DEFAULT_SCHEDULE.days.map((d) => (d.dow === 3 ? { ...d, open: "20:00", close: "09:00" } : d)),
    shifts: DEFAULT_SCHEDULE.shifts,
  };
  assert.ok(validateSchedule(cfg).some((e) => e.includes("posterior")));
});

// ── Horario de atención ─────────────────────────────────────────────
test("lunes cerrado; el resto abre", () => {
  assert.equal(isDayOpen(1), false);
  for (const d of [0, 2, 3, 4, 5, 6]) assert.equal(isDayOpen(d), true, `día ${d}`);
});

test("los slots respetan el horario de cada día", () => {
  assert.deepEqual(getTimeSlots(1), []);            // lunes cerrado
  const dom = getTimeSlots(0);                       // 08:00–21:00
  assert.equal(dom[0], "08:00");
  assert.equal(dom[dom.length - 1], "20:30");
  const sab = getTimeSlots(6);                       // 08:00–24:00
  assert.equal(sab[sab.length - 1], "23:30");
});

test("parseHm y formatHm son inversos", () => {
  assert.equal(parseHm("08:00"), 480);
  assert.equal(parseHm("24:00"), 1440);
  assert.equal(parseHm("7:5"), null);
  assert.equal(formatHm(480), "08:00");
  assert.equal(formatHm(1439), "23:59");
});

// ── Tolerancia de cierre del turno de restaurante ───────────────────
// El servicio de comida se alarga hasta las 3 o 4 de la mañana. La tolerancia
// para cerrar ese corte es el INICIO del brunch: hasta entonces sigue siendo
// su turno y no debe reclamarse el cierre.

test("una venta a las 3am sigue perteneciendo al turno de comida de la noche", () => {
  const s = resolveShift(mx("2026-08-28T03:30:00"));
  assert.equal(s.key, "cena");
  assert.equal(s.start.toISOString(), mx("2026-08-27T13:00:00").toISOString());
  // La tolerancia termina justo cuando abre el brunch.
  assert.equal(s.end.toISOString(), mx("2026-08-28T08:00:00").toISOString());
});

test("a las 4am el turno en curso es el mismo con el que se abrió el corte", () => {
  // El aviso de cierre compara el inicio del turno actual contra el del corte:
  // mientras coincidan, no se reclama nada.
  const alAbrir = resolveShift(mx("2026-08-27T20:00:00"));
  const alas4 = resolveShift(mx("2026-08-28T04:00:00"));
  assert.equal(alas4.start.getTime(), alAbrir.start.getTime());
});

test("pasadas las 08:00 el turno ya cambió y el corte de la noche va tarde", () => {
  const alAbrir = resolveShift(mx("2026-08-27T20:00:00"));
  const alas9 = resolveShift(mx("2026-08-28T09:00:00"));
  assert.equal(alas9.key, "brunch");
  assert.ok(alas9.start.getTime() > alAbrir.start.getTime());
});
