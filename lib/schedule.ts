import { prisma } from "./prisma";
import { TENANT } from "./comanda";
import {
  DEFAULT_SCHEDULE,
  resolveShift,
  isDayOpen as isDayOpenPure,
  getTimeSlots as getTimeSlotsPure,
  type ScheduleConfig,
} from "./shifts";

/**
 * Acceso a la configuración de horario y turnos.
 *
 * Vive aparte de lib/shifts.ts a propósito: aquel es puro y sin base de datos,
 * lo que permite probar la resolución de turnos en milisegundos. Aquí está lo
 * que toca Prisma.
 */

export async function getSchedule(): Promise<ScheduleConfig> {
  const s = await prisma.restaurantSettings.findUnique({
    where: { tenantId: TENANT },
    select: { schedule: true },
  });
  const raw = s?.schedule as Partial<ScheduleConfig> | null | undefined;
  if (!raw || !Array.isArray(raw.shifts) || raw.shifts.length === 0) return DEFAULT_SCHEDULE;
  return {
    days: Array.isArray(raw.days) && raw.days.length ? raw.days : DEFAULT_SCHEDULE.days,
    shifts: raw.shifts,
  };
}

/**
 * Turno en curso para un instante dado, según la configuración vigente.
 *
 * Antes era síncrona y con el horario escrito en duro. Los tres puntos que la
 * usan —abrir comanda, abrir turno de caja y pedidos del bot— ya son
 * asíncronos, así que el cambio no se propaga más allá.
 */
export async function getShiftWindow(date: Date): Promise<{ name: string; key: string; start: Date; end: Date }> {
  return resolveShift(date, await getSchedule());
}

export async function isDayOpen(dow: number): Promise<boolean> {
  return isDayOpenPure(dow, await getSchedule());
}

export async function getTimeSlots(dow: number): Promise<string[]> {
  return getTimeSlotsPure(dow, await getSchedule());
}
