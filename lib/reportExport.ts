/**
 * Exportación de los Reportes de venta a los tres formatos que se usan en el
 * restaurante: ticket de caja, hoja de cálculo y PDF.
 *
 * Dos reglas que gobiernan todo este archivo:
 *
 *  1. Se exporta EXACTAMENTE la sub-vista seleccionada, no el reporte
 *     completo. Volcar todo —con cantidades por producto y desglose de
 *     cartas— es material de control de almacén para compaginar inventario
 *     con venta, no lo que se consulta desde esta pantalla.
 *  2. Los tres formatos parten del MISMO objeto ya cargado, de modo que lo
 *     exportado coincide con lo que se está viendo. Si cada formato armara su
 *     propia consulta, un cambio de rango a medias produciría un archivo que
 *     no corresponde con la pantalla.
 */

export interface ReportKpis {
  sales: number; taxCollected: number; tips: number;
  comandas: number; guests: number; avgTicket: number;
}
export interface ReportShift {
  shift: string; label: string; window: string;
  sales: number; comandas: number; guests: number; avgTicket: number; occupancy: number;
  topDish: { name: string; qty: number } | null;
}
export interface ReportDish { name: string; qty: number; revenue: number; comandas: number }
export interface ReportWaiter {
  waiter: string; sales: number; comandas: number; guests: number; avgTicket: number;
  dishes: ReportDish[];
}
export interface ReportData {
  kpis: ReportKpis;
  byShift: ReportShift[];
  bySection: { section: string; sales: number; comandas: number }[];
  byWaiter: ReportWaiter[];
  topDishes: ReportDish[];
  byCarta: { carta: string; qty: number; revenue: number; comandas: number; dishes: ReportDish[] }[];
}

/** Las mismas sub-vistas de la pantalla de reportes. */
export type ReportSub = "todo" | "producto" | "menus" | "secciones" | "meseros";

export const SUB_LABEL: Record<ReportSub, string> = {
  todo: "Resumen",
  producto: "Por producto",
  menus: "Por sección del menú",
  secciones: "Por zona",
  meseros: "Por mesero",
};

const mx = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

/** Fecha y hora de emisión, en horario de México. */
function stamp(): string {
  return new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "short" });
}

/** ¿Tiene filas la sub-vista elegida? */
export function subHasRows(d: ReportData, sub: ReportSub): boolean {
  if (sub === "todo") return d.byShift.length > 0 || d.kpis.comandas > 0;
  if (sub === "producto") return d.topDishes.length > 0;
  if (sub === "menus") return d.byCarta.length > 0;
  if (sub === "meseros") return d.byWaiter.length > 0;
  return d.bySection.length > 0;
}

// ─────────────────────────────────────────── ticket de caja ──
// Impresora térmica: 42 columnas, sin tablas anchas.
const W = 42;

/**
 * El mismo ancho, expuesto para quien encola la impresión: el trabajo lleva el
 * dato para que el puente pueda centrar el bloque si la impresora de caja es
 * más ancha (48 columnas es lo habitual). Con el ancho escrito en dos lados,
 * basta cambiar uno para que el reporte salga descuadrado.
 */
export const TICKET_COLS = W;
const line = (ch = "-") => ch.repeat(W);
const center = (s: string) => " ".repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;
/** Etiqueta a la izquierda, valor pegado a la derecha, en 42 columnas. */
const kv = (k: string, v: string) => {
  const room = W - v.length;
  const key = k.length > room - 1 ? k.slice(0, Math.max(0, room - 2)) + "." : k;
  return key + " ".repeat(Math.max(1, room - key.length)) + v;
};

export function reportToTicketText(d: ReportData, rangeLabel: string, sub: ReportSub): string {
  const out: string[] = [];
  out.push(center("SAN LUCA RISTORANTE"));
  out.push(center("REPORTE DE VENTAS"));
  out.push(center(SUB_LABEL[sub].toUpperCase()));
  out.push(center(rangeLabel));
  out.push(center(stamp()));
  out.push(line("="));

  if (sub === "todo") {
    out.push(kv("Ventas", mx(d.kpis.sales)));
    out.push(kv("Cuentas", String(d.kpis.comandas)));
    out.push(kv("Comensales", String(d.kpis.guests)));
    out.push(kv("Ticket promedio", mx(d.kpis.avgTicket)));
    out.push(kv("Propinas", mx(d.kpis.tips)));
    out.push(kv("IVA cobrado", mx(d.kpis.taxCollected)));
    if (d.byShift.length) {
      out.push(line());
      out.push("POR TURNO");
      for (const s of d.byShift) {
        out.push(kv(s.label, mx(s.sales)));
        out.push(`  ${s.comandas} cuentas · ${s.guests} comensales`);
      }
    }
  } else if (sub === "producto") {
    // Sólo los primeros: un ticket con 200 productos no lo lee nadie y gasta rollo.
    for (const p of d.topDishes.slice(0, 25)) out.push(kv(`${p.qty}x ${p.name}`, mx(p.revenue)));
    if (d.topDishes.length > 25) out.push(`  ...y ${d.topDishes.length - 25} productos mas`);
  } else if (sub === "menus") {
    for (const c of d.byCarta) {
      out.push(kv(c.carta, mx(c.revenue)));
      out.push(`  ${c.qty} vendidos · ${c.comandas} comandas`);
    }
  } else if (sub === "meseros") {
    for (const w of d.byWaiter) {
      out.push(kv(w.waiter, mx(w.sales)));
      out.push(`  ${w.comandas} cuentas · ${w.guests} comensales`);
      out.push(`  ticket prom. ${mx(w.avgTicket)}`);
      // Sólo lo más vendido por cada uno: el detalle completo cabe en la hoja
      // de cálculo, no en un ticket de 42 columnas.
      for (const p of w.dishes.slice(0, 5)) out.push(kv(`   ${p.qty}x ${p.name}`, mx(p.revenue)));
      if (w.dishes.length > 5) out.push(`     ...y ${w.dishes.length - 5} productos mas`);
    }
  } else {
    for (const s of d.bySection) {
      out.push(kv(s.section, mx(s.sales)));
      out.push(`  ${s.comandas} cuentas`);
    }
  }

  out.push(line("="));
  out.push(center("Documento informativo"));
  out.push(center("No es comprobante fiscal"));
  return out.join("\n");
}

// ──────────────────────────────────────── hoja de cálculo ──
const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (...cells: (string | number)[]) => cells.map(esc).join(",");

export function reportToCsv(d: ReportData, rangeLabel: string, sub: ReportSub): string {
  const out: string[] = [];
  // Excel en configuración regional española usa ";" como separador de lista y
  // metería todo en una columna. Esta primera línea le indica cuál usar.
  out.push("sep=,");
  out.push(row("San Luca Ristorante — Reporte de ventas"));
  out.push(row("Vista", SUB_LABEL[sub]));
  out.push(row("Rango", rangeLabel));
  out.push(row("Generado", stamp()));
  out.push("");

  if (sub === "todo") {
    out.push(row("Concepto", "Valor"));
    out.push(row("Ventas", d.kpis.sales));
    out.push(row("Cuentas", d.kpis.comandas));
    out.push(row("Comensales", d.kpis.guests));
    out.push(row("Ticket promedio", d.kpis.avgTicket));
    out.push(row("Propinas", d.kpis.tips));
    out.push(row("IVA cobrado", d.kpis.taxCollected));
    if (d.byShift.length) {
      out.push("");
      out.push(row("POR TURNO"));
      out.push(row("Turno", "Horario", "Ventas", "Cuentas", "Comensales", "Ticket promedio", "Ocupacion", "Mas vendido"));
      for (const s of d.byShift) {
        out.push(row(s.label, s.window, s.sales, s.comandas, s.guests, s.avgTicket, s.occupancy, s.topDish ? `${s.topDish.qty}x ${s.topDish.name}` : ""));
      }
    }
  } else if (sub === "producto") {
    out.push(row("Producto", "Cantidad", "Comandas", "Importe"));
    for (const p of d.topDishes) out.push(row(p.name, p.qty, p.comandas, p.revenue));
  } else if (sub === "menus") {
    out.push(row("Seccion", "Producto", "Cantidad", "Comandas", "Importe"));
    for (const c of d.byCarta) {
      out.push(row(c.carta, "(total de la seccion)", c.qty, c.comandas, c.revenue));
      for (const p of c.dishes) out.push(row(c.carta, p.name, p.qty, p.comandas, p.revenue));
    }
  } else if (sub === "meseros") {
    out.push(row("Mesero", "Producto", "Cantidad", "Comandas", "Importe", "Comensales", "Ticket promedio"));
    for (const w of d.byWaiter) {
      out.push(row(w.waiter, "(total del mesero)", "", w.comandas, w.sales, w.guests, w.avgTicket));
      for (const p of w.dishes) out.push(row(w.waiter, p.name, p.qty, p.comandas, p.revenue, "", ""));
    }
  } else {
    out.push(row("Zona", "Cuentas", "Ventas"));
    for (const s of d.bySection) out.push(row(s.section, s.comandas, s.sales));
  }

  return out.join("\r\n");
}

// ──────────────────────────────────────────────────── PDF ──
const h = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function table(headers: string[], rows: (string | number)[][], numFrom = 1): string {
  const th = headers.map((x, i) => `<th${i >= numFrom ? ' class="n"' : ""}>${h(x)}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${r.map((c, i) => `<td${i >= numFrom ? ' class="n"' : ""}>${h(String(c))}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

function bodyFor(d: ReportData, sub: ReportSub): string {
  if (sub === "todo") {
    const k = d.kpis;
    const kpis = `<div class="kpis">
      <div class="kpi"><span>Ventas</span><b>${mx(k.sales)}</b></div>
      <div class="kpi"><span>Cuentas</span><b>${k.comandas}</b></div>
      <div class="kpi"><span>Comensales</span><b>${k.guests}</b></div>
      <div class="kpi"><span>Ticket promedio</span><b>${mx(k.avgTicket)}</b></div>
      <div class="kpi"><span>Propinas</span><b>${mx(k.tips)}</b></div>
      <div class="kpi"><span>IVA cobrado</span><b>${mx(k.taxCollected)}</b></div>
    </div>`;
    const shifts = d.byShift.length
      ? `<h2>Por turno</h2>${table(
          ["Turno", "Horario", "Ventas", "Cuentas", "Comensales", "Ticket prom.", "Ocupación"],
          d.byShift.map((s) => [s.label, s.window, mx(s.sales), s.comandas, s.guests, mx(s.avgTicket), `${s.occupancy}%`]),
          2)}`
      : "";
    return kpis + shifts;
  }
  if (sub === "producto") {
    return table(["Producto", "Cantidad", "Comandas", "Importe"],
      d.topDishes.map((p) => [p.name, p.qty, p.comandas, mx(p.revenue)]));
  }
  if (sub === "menus") {
    return d.byCarta
      .map((c) => `<h2>${h(c.carta)} · ${mx(c.revenue)}</h2>${table(
        ["Producto", "Cantidad", "Comandas", "Importe"],
        c.dishes.map((p) => [p.name, p.qty, p.comandas, mx(p.revenue)]))}`)
      .join("");
  }
  if (sub === "meseros") {
    return d.byWaiter
      .map((w) => `<h2>${h(w.waiter)} · ${mx(w.sales)}</h2>
        <div class="sub">${w.comandas} cuentas · ${w.guests} comensales · ticket prom. ${mx(w.avgTicket)}</div>
        ${table(["Producto", "Cantidad", "Comandas", "Importe"],
          w.dishes.map((p) => [p.name, p.qty, p.comandas, mx(p.revenue)]))}`)
      .join("");
  }
  return table(["Zona", "Cuentas", "Ventas"],
    d.bySection.map((s) => [s.section, s.comandas, mx(s.sales)]));
}

/**
 * Documento imprimible. El PDF se obtiene con "Guardar como PDF" del diálogo
 * de impresión del navegador: evita sumar una librería de ~200 KB al bundle
 * para algo que el sistema operativo ya resuelve, y sale con las fuentes y el
 * tamaño de papel que elija quien imprime.
 */
export function reportToPrintableHtml(d: ReportData, rangeLabel: string, sub: ReportSub): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Reporte de ventas · ${h(SUB_LABEL[sub])} — ${h(rangeLabel)}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #16201f; margin: 0; font-size: 11px; }
  h1 { font-size: 17px; margin: 0 0 2px; }
  h2 { font-size: 12px; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  .sub { color: #666; font-size: 10px; margin-bottom: 14px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 7px 9px; }
  .kpi b { display: block; font-size: 15px; margin-top: 2px; }
  .kpi span { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; color: #666; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 6px; border-bottom: 1px solid #e5e5e5; text-align: left; }
  th { background: #f4f4f4; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
  td.n, th.n { text-align: right; }
  tbody tr { break-inside: avoid; }
  footer { margin-top: 16px; color: #888; font-size: 9px; }
</style></head><body>
<h1>San Luca Ristorante — ${h(SUB_LABEL[sub])}</h1>
<div class="sub">${h(rangeLabel)} · generado ${h(stamp())}</div>
${bodyFor(d, sub)}
<footer>Documento informativo. No es un comprobante fiscal.</footer>
</body></html>`;
}

/** Nombre de archivo sin acentos ni espacios: incluye la vista y la fecha. */
export function reportFileName(rangeLabel: string, ext: string, sub: ReportSub): string {
  const slug = (s: string) =>
    s
      // Sin quitar las marcas, "Últimos" se descompone en "U" + tilde y la tilde
      // acaba convertida en separador: "u-ltimos". \p{M} las elimina.
      .normalize("NFD").replace(/\p{M}/gu, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const day = new Date().toISOString().slice(0, 10);
  return `sanluca-${slug(SUB_LABEL[sub]) || "reporte"}-${slug(rangeLabel) || "rango"}-${day}.${ext}`;
}

// ═══════════════════════════════════ exportación de tablas ══
/**
 * Exportación genérica para pantallas que muestran una tabla —Historial de
 * venta, Cierres de turno— sin duplicar los tres generadores por cada una.
 * Reciben las columnas y filas que ya tienen en pantalla, de modo que vale la
 * misma regla: se exporta lo que se está viendo, con sus filtros aplicados.
 */
export interface ExportColumn { key: string; label: string; num?: boolean }
export interface TableExport {
  title: string;
  rangeLabel: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  /** Totales o KPIs que encabezan lo exportado. */
  summary?: { label: string; value: string }[];
}

export function tableToTicketText(t: TableExport): string {
  const out: string[] = [];
  out.push(center("SAN LUCA RISTORANTE"));
  out.push(center(t.title.toUpperCase()));
  out.push(center(t.rangeLabel));
  out.push(center(stamp()));
  out.push(line("="));

  for (const s of t.summary ?? []) out.push(kv(s.label, s.value));
  if (t.summary?.length) out.push(line());

  // El ticket mide 42 columnas: una tabla de ocho no cabe. Cada fila se
  // imprime como bloque —primera columna de título, el resto en pares— que es
  // legible en papel angosto.
  const [first, ...rest] = t.columns;
  const LIMIT = 40;
  for (const r of t.rows.slice(0, LIMIT)) {
    out.push(String(r[first.key] ?? ""));
    for (const c of rest) {
      const v = r[c.key];
      if (v === "" || v === undefined || v === null) continue;
      out.push(kv(`  ${c.label}`, String(v)));
    }
    out.push("");
  }
  if (t.rows.length > LIMIT) out.push(`...y ${t.rows.length - LIMIT} registros mas`);

  out.push(line("="));
  out.push(center("Documento informativo"));
  out.push(center("No es comprobante fiscal"));
  return out.join("\n");
}

export function tableToCsv(t: TableExport): string {
  const out: string[] = [];
  out.push("sep=,");
  out.push(row(`San Luca Ristorante — ${t.title}`));
  out.push(row("Rango", t.rangeLabel));
  out.push(row("Generado", stamp()));
  out.push("");
  for (const s of t.summary ?? []) out.push(row(s.label, s.value));
  if (t.summary?.length) out.push("");
  out.push(row(...t.columns.map((c) => c.label)));
  for (const r of t.rows) out.push(row(...t.columns.map((c) => r[c.key] ?? "")));
  return out.join("\r\n");
}

export function tableToPrintableHtml(t: TableExport): string {
  const sum = (t.summary ?? [])
    .map((s) => `<div class="kpi"><span>${h(s.label)}</span><b>${h(s.value)}</b></div>`)
    .join("");
  const th = t.columns.map((c) => `<th${c.num ? ' class="n"' : ""}>${h(c.label)}</th>`).join("");
  const tr = t.rows
    .map((r) => `<tr>${t.columns.map((c) => `<td${c.num ? ' class="n"' : ""}>${h(String(r[c.key] ?? ""))}</td>`).join("")}</tr>`)
    .join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${h(t.title)} — ${h(t.rangeLabel)}</title>
<style>
  @page { margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #16201f; margin: 0; font-size: 10px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 10px; margin-bottom: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 12px; }
  .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 6px 8px; }
  .kpi b { display: block; font-size: 13px; margin-top: 2px; }
  .kpi span { font-size: 8px; text-transform: uppercase; letter-spacing: .06em; color: #666; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 3px 5px; border-bottom: 1px solid #e5e5e5; text-align: left; }
  th { background: #f4f4f4; font-size: 8px; text-transform: uppercase; letter-spacing: .05em; }
  td.n, th.n { text-align: right; }
  tbody tr { break-inside: avoid; }
  footer { margin-top: 14px; color: #888; font-size: 9px; }
</style></head><body>
<h1>San Luca Ristorante — ${h(t.title)}</h1>
<div class="sub">${h(t.rangeLabel)} · generado ${h(stamp())}</div>
${sum ? `<div class="kpis">${sum}</div>` : ""}
<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
<footer>Documento informativo. No es un comprobante fiscal.</footer>
</body></html>`;
}

/** Nombre de archivo para las exportaciones de tabla. */
export function tableFileName(title: string, rangeLabel: string, ext: string): string {
  const slug = (s: string) =>
    s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const day = new Date().toISOString().slice(0, 10);
  return `sanluca-${slug(title) || "reporte"}-${slug(rangeLabel) || "rango"}-${day}.${ext}`;
}
