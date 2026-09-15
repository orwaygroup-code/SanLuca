import { type ScheduleConfig, dayConfig, parseHm } from "@/lib/shifts";

/**
 * Validación PURA de fecha/hora de una reserva contra el horario del negocio.
 * Sin base de datos: recibe el ScheduleConfig ya cargado (los llamadores hacen
 * `await getSchedule()`). dow y hora se calculan en hora de México, igual que
 * resolveShift, para que el VPS en UTC no desfase el día.
 */

const MX_TZ = "America/Mexico_City";
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type DateTimeCheck = { ok: true } | { ok: false; status: 400 | 409; error: string };

export function checkReservationDateTime(
  when: Date,
  cfg: ScheduleConfig,
  opts: { allowClosedDay?: boolean } = {},
  now: number = Date.now(),
): DateTimeCheck {
  // Fecha pasada, con 1 h de tolerancia (walk-ins registrados tarde).
  if (when.getTime() < now - 60 * 60 * 1000) {
    return { ok: false, status: 400, error: "La fecha y hora ya pasaron" };
  }

  const wd = new Intl.DateTimeFormat("en-US", { timeZone: MX_TZ, weekday: "short" }).format(when);
  const dow = WEEKDAY[wd] ?? 0;
  const hhmm = when.toLocaleString("en-US", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const min = parseHm(hhmm.replace(/^24:/, "00:")) ?? 0;

  const day = dayConfig(cfg, dow);
  if (day.closed && !opts.allowClosedDay) {
    return { ok: false, status: 409, error: "El restaurante no abre ese día" };
  }
  if (!day.closed) {
    const open = parseHm(day.open) ?? 0;
    const close = parseHm(day.close) ?? 1440; // parseHm("24:00") = 1440
    if (min < open || min >= close) {
      return { ok: false, status: 409, error: `Fuera del horario de servicio (${day.open}–${day.close})` };
    }
  }
  return { ok: true };
}
