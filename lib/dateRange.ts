// Resuelve el rango de fechas para los reportes admin. Acepta:
//   - preset:  ?range=today|7d|30d
//   - custom:  ?from=YYYY-MM-DD[&to=YYYY-MM-DD]  (si falta `to`, es UNA sola fecha = from)
// Todo en zona horaria de México (offset fijo -06:00, igual que el resto de reportes).
// Devuelve { from, to } como Date para usar en where: { gte: from, lte: to }.

const MX_OFFSET = "-06:00";
const DAY = 86_400_000;

function mxToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}
const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export interface ResolvedRange { from: Date; to: Date; label: string; custom: boolean }

export function resolveDateRange(sp: URLSearchParams): ResolvedRange {
  const fromP = sp.get("from");
  const toP = sp.get("to") ?? fromP; // fecha única: `to` toma el valor de `from`
  if (isDate(fromP) && isDate(toP)) {
    // Ordena por si vienen invertidas.
    const [a, b] = fromP <= toP ? [fromP, toP] : [toP, fromP];
    return {
      from: new Date(`${a}T00:00:00.000${MX_OFFSET}`),
      to: new Date(`${b}T23:59:59.999${MX_OFFSET}`),
      label: a === b ? a : `${a} … ${b}`,
      custom: true,
    };
  }
  const range = sp.get("range") ?? "today";
  const days = range === "30d" ? 30 : range === "7d" ? 7 : 1;
  const todayStart = new Date(`${mxToday()}T00:00:00.000${MX_OFFSET}`);
  return { from: new Date(todayStart.getTime() - (days - 1) * DAY), to: new Date(), label: range, custom: false };
}
