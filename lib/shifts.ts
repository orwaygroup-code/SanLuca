/**
 * Horario del restaurante y turnos de servicio — configurables desde Ajustes.
 *
 * Antes estaba todo escrito en duro: brunch 08:00–14:00, cena hasta el cierre,
 * lunes cerrado y las horas de cierre por día. Cambiar cualquier cosa exigía
 * tocar código y desplegar, y el brunch se quedaba corriendo hasta la noche
 * porque su fin nunca se movió.
 *
 * MODELO DE TURNOS. Cada turno es un NOMBRE y una HORA DE INICIO; termina
 * donde empieza el siguiente, y el último enlaza con el primero del día
 * siguiente. Así las 24 horas quedan cubiertas por construcción: no hay forma
 * de configurar un hueco ni un traslape. Definir inicio Y fin lo permitiría, y
 * un hueco significaría ventas sin turno asignado.
 *
 * La `key` es estable y separada del nombre visible: las comandas ya guardadas
 * tienen shift "brunch" o "cena", y renombrar un turno en Ajustes no debe
 * romper el histórico ni los reportes.
 */

const MX_TZ = "America/Mexico_City";

export interface ScheduleDay {
  /** 0 = domingo … 6 = sábado */
  dow: number;
  closed: boolean;
  /** "HH:MM" en hora de México. */
  open: string;
  /** "HH:MM"; "24:00" = medianoche del día siguiente. */
  close: string;
}

export interface ShiftDef {
  /** Estable, no cambia al renombrar: es lo que se guarda en Comanda.shift. */
  key: string;
  name: string;
  /** "HH:MM" en hora de México. */
  start: string;
}

export interface ScheduleConfig {
  days: ScheduleDay[];
  shifts: ShiftDef[];
}

/** Configuración vigente del negocio, usada cuando Ajustes aún no tiene una. */
export const DEFAULT_SCHEDULE: ScheduleConfig = {
  days: [
    { dow: 0, closed: false, open: "08:00", close: "21:00" }, // domingo
    { dow: 1, closed: true, open: "08:00", close: "23:00" },  // lunes cerrado
    { dow: 2, closed: false, open: "08:00", close: "23:00" },
    { dow: 3, closed: false, open: "08:00", close: "23:00" },
    { dow: 4, closed: false, open: "08:00", close: "23:00" },
    { dow: 5, closed: false, open: "08:00", close: "24:00" }, // viernes hasta medianoche
    { dow: 6, closed: false, open: "08:00", close: "24:00" }, // sábado
  ],
  shifts: [
    { key: "brunch", name: "Brunch", start: "08:00" },
    { key: "cena", name: "Comida", start: "13:00" },
  ],
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:MM" → minutos desde medianoche. Devuelve null si no es válido. */
export function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function formatHm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/**
 * Valida una configuración antes de guardarla. Devuelve los problemas en
 * lenguaje llano, para mostrarlos en Ajustes.
 */
export function validateSchedule(cfg: ScheduleConfig): string[] {
  const errs: string[] = [];

  if (!Array.isArray(cfg.shifts) || cfg.shifts.length === 0) {
    errs.push("Define al menos un turno.");
  } else {
    const keys = new Set<string>();
    const starts = new Set<number>();
    for (const s of cfg.shifts) {
      if (!s.name?.trim()) errs.push("Todos los turnos necesitan nombre.");
      const t = parseHm(s.start ?? "");
      if (t === null) errs.push(`Hora de inicio inválida en «${s.name || s.key}» (usa HH:MM).`);
      else if (starts.has(t)) errs.push(`Dos turnos empiezan a la misma hora (${s.start}).`);
      else starts.add(t);
      if (s.key && keys.has(s.key)) errs.push(`Clave de turno repetida: ${s.key}.`);
      if (s.key) keys.add(s.key);
    }
  }

  for (const d of cfg.days ?? []) {
    if (d.closed) continue;
    const o = parseHm(d.open ?? ""), c = parseHm(d.close ?? "");
    if (o === null || c === null) { errs.push(`Horario inválido en el día ${d.dow} (usa HH:MM).`); continue; }
    if (c <= o) errs.push(`El cierre debe ser posterior a la apertura en el día ${d.dow}.`);
  }

  return errs;
}

/** Normaliza y ordena por hora de inicio; sin turnos, cae al default. */
function normalize(cfg?: Partial<ScheduleConfig> | null): ScheduleConfig {
  const shifts = (cfg?.shifts?.length ? cfg.shifts : DEFAULT_SCHEDULE.shifts)
    .map((s) => ({ ...s, key: s.key || slugKey(s.name) }))
    .filter((s) => parseHm(s.start) !== null)
    .sort((a, b) => parseHm(a.start)! - parseHm(b.start)!);
  const days = DEFAULT_SCHEDULE.days.map((d) => cfg?.days?.find((x) => x.dow === d.dow) ?? d);
  return { days, shifts: shifts.length ? shifts : DEFAULT_SCHEDULE.shifts };
}

export function slugKey(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "turno";
}

export function dayConfig(cfg: ScheduleConfig, dow: number): ScheduleDay {
  return cfg.days.find((d) => d.dow === dow) ?? DEFAULT_SCHEDULE.days[dow];
}

/** ¿Abre ese día de la semana? (0 = domingo) */
export function isDayOpen(dow: number, cfg: ScheduleConfig = DEFAULT_SCHEDULE): boolean {
  return !dayConfig(cfg, dow).closed;
}

/**
 * Turno al que pertenece un instante, y su ventana.
 *
 * Puro y sin base de datos, para poder probarlo. El último turno del día
 * enlaza con el primero del siguiente, de modo que una venta de madrugada cae
 * en el turno de la noche anterior y no en un limbo.
 */
export function resolveShift(date: Date, config?: Partial<ScheduleConfig> | null): { name: string; key: string; start: Date; end: Date } {
  const cfg = normalize(config);
  const mxDate = date.toLocaleDateString("en-CA", { timeZone: MX_TZ });
  const hhmm = date.toLocaleString("en-US", { timeZone: MX_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const nowMin = parseHm(hhmm.replace(/^24:/, "00:")) ?? 0;

  const starts = cfg.shifts.map((s) => ({ ...s, min: parseHm(s.start)! }));

  // Índice del turno en curso: el último cuyo inicio ya pasó. Si aún no
  // empieza ninguno (madrugada), corre el ÚLTIMO del día anterior.
  let idx = -1;
  for (let i = 0; i < starts.length; i++) if (nowMin >= starts[i].min) idx = i;

  const dayShift = (isoDate: string, minutes: number) =>
    new Date(`${isoDate}T${formatHm(minutes)}:00.000-06:00`);

  const shiftDay = (offset: number) => {
    const d = new Date(`${mxDate}T12:00:00.000-06:00`);
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString("en-CA", { timeZone: MX_TZ });
  };

  if (idx === -1) {
    // Madrugada: pertenece al último turno, que arrancó ayer.
    const last = starts[starts.length - 1];
    return {
      name: last.name, key: last.key,
      start: dayShift(shiftDay(-1), last.min),
      end: dayShift(mxDate, starts[0].min),
    };
  }

  const cur = starts[idx];
  const next = starts[idx + 1];
  return {
    name: cur.name, key: cur.key,
    start: dayShift(mxDate, cur.min),
    // Sin siguiente turno hoy, cierra al empezar el primero de mañana.
    end: next ? dayShift(mxDate, next.min) : dayShift(shiftDay(1), starts[0].min),
  };
}

/** Slots de reserva de un día, en pasos de 30 min dentro del horario. */
export function getTimeSlots(dow: number, cfg: ScheduleConfig = DEFAULT_SCHEDULE): string[] {
  const d = dayConfig(cfg, dow);
  if (d.closed) return [];
  const open = parseHm(d.open), close = parseHm(d.close);
  if (open === null || close === null || close <= open) return [];
  const slots: string[] = [];
  for (let m = open; m < close; m += 30) slots.push(formatHm(m));
  return slots;
}
