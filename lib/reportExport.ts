/**
 * Exportación de los Reportes de venta a los tres formatos que se ofrecen:
 * ticket de caja, hoja de cálculo y PDF (vía la impresión del navegador).
 *
 * Los tres se generan a partir del MISMO objeto que la pantalla ya tiene
 * cargado, de modo que lo exportado coincide con lo que el administrador está
 * viendo. Si cada formato armara su propia consulta, un cambio de rango a
 * medias produciría un archivo que no corresponde con la pantalla.
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
export interface ReportData {
  kpis: ReportKpis;
  byShift: ReportShift[];
  bySection: { section: string; sales: number; comandas: number }[];
  topDishes: ReportDish[];
  byCarta: { carta: string; qty: number; revenue: number; comandas: number; dishes: ReportDish[] }[];
}

const mx = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

/** Fecha y hora de emisión, en horario de México. */
function stamp(): string {
  return new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "short" });
}

// ─────────────────────────────────────────── ticket de caja ──
// Impresora térmica: 42 columnas, sin acentos raros ni tablas anchas.
const W = 42;
const line = (ch = "-") => ch.repeat(W);
const center = (s: string) => {
  const pad = Math.max(0, Math.floor((W - s.length) / 2));
  return " ".repeat(pad) + s;
};
/** Etiqueta a la izquierda, valor pegado a la derecha, en 42 columnas. */
const kv = (k: string, v: string) => {
  const room = W - v.length;
  const key = k.length > room - 1 ? k.slice(0, Math.max(0, room - 2)) + "." : k;
  return key + " ".repeat(Math.max(1, room - key.length)) + v;
};

export function reportToTicketText(d: ReportData, rangeLabel: string): string {
  const out: string[] = [];
  out.push(center("SAN LUCA RISTORANTE"));
  out.push(center("REPORTE DE VENTAS"));
  out.push(center(rangeLabel));
  out.push(center(stamp()));
  out.push(line("="));

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

  if (d.bySection.length) {
    out.push(line());
    out.push("POR ZONA");
    for (const s of d.bySection) out.push(kv(s.section, mx(s.sales)));
  }

  if (d.topDishes.length) {
    out.push(line());
    out.push("MAS VENDIDOS");
    // Sólo los primeros: un ticket con 200 productos no lo lee nadie y gasta rollo.
    for (const p of d.topDishes.slice(0, 15)) out.push(kv(`${p.qty}x ${p.name}`, mx(p.revenue)));
    if (d.topDishes.length > 15) out.push(`  ...y ${d.topDishes.length - 15} productos mas`);
  }

  if (d.byCarta.length) {
    out.push(line());
    out.push("POR SECCION DEL MENU");
    for (const c of d.byCarta) out.push(kv(c.carta, mx(c.revenue)));
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

export function reportToCsv(d: ReportData, rangeLabel: string): string {
  const out: string[] = [];
  // Excel en configuración regional española usa ";" como separador de lista y
  // metería todo en una columna. Esta primera línea le indica cuál usar.
  out.push("sep=,");
  out.push(row("San Luca Ristorante — Reporte de ventas"));
  out.push(row("Rango", rangeLabel));
  out.push(row("Generado", stamp()));
  out.push("");

  out.push(row("RESUMEN"));
  out.push(row("Concepto", "Valor"));
  out.push(row("Ventas", d.kpis.sales));
  out.push(row("Cuentas", d.kpis.comandas));
  out.push(row("Comensales", d.kpis.guests));
  out.push(row("Ticket promedio", d.kpis.avgTicket));
  out.push(row("Propinas", d.kpis.tips));
  out.push(row("IVA cobrado", d.kpis.taxCollected));
  out.push("");

  if (d.byShift.length) {
    out.push(row("POR TURNO"));
    out.push(row("Turno", "Horario", "Ventas", "Cuentas", "Comensales", "Ticket promedio", "Ocupacion", "Mas vendido"));
    for (const s of d.byShift) {
      out.push(row(s.label, s.window, s.sales, s.comandas, s.guests, s.avgTicket, s.occupancy, s.topDish ? `${s.topDish.qty}x ${s.topDish.name}` : ""));
    }
    out.push("");
  }

  if (d.bySection.length) {
    out.push(row("POR ZONA"));
    out.push(row("Zona", "Ventas", "Cuentas"));
    for (const s of d.bySection) out.push(row(s.section, s.sales, s.comandas));
    out.push("");
  }

  if (d.topDishes.length) {
    out.push(row("POR PRODUCTO"));
    out.push(row("Producto", "Cantidad", "Importe", "Cuentas"));
    for (const p of d.topDishes) out.push(row(p.name, p.qty, p.revenue, p.comandas));
    out.push("");
  }

  if (d.byCarta.length) {
    out.push(row("POR SECCION DEL MENU"));
    out.push(row("Seccion", "Producto", "Cantidad", "Importe", "Cuentas"));
    for (const c of d.byCarta) {
      out.push(row(c.carta, "(total de la seccion)", c.qty, c.revenue, c.comandas));
      for (const p of c.dishes) out.push(row(c.carta, p.name, p.qty, p.revenue, p.comandas));
    }
  }

  return out.join("\r\n");
}

// ──────────────────────────────────────────────────── PDF ──
const h = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function table(headers: string[], rows: (string | number)[][], numFrom = 1): string {
  const th = headers.map((x, i) => `<th${i >= numFrom ? ' class="n"' : ""}>${h(x)}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${r.map((c, i) => `<td${i >= numFrom ? ' class="n"' : ""}>${h(String(c))}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

/**
 * Documento imprimible. El PDF se obtiene con "Guardar como PDF" del diálogo
 * de impresión del navegador: evita sumar una librería de ~200 KB al bundle
 * para algo que el sistema operativo ya resuelve, y sale con las fuentes y el
 * tamaño de papel que elija quien imprime.
 */
export function reportToPrintableHtml(d: ReportData, rangeLabel: string): string {
  const k = d.kpis;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Reporte de ventas — ${h(rangeLabel)}</title>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #16201f; margin: 0; font-size: 11px; }
  h1 { font-size: 17px; margin: 0 0 2px; }
  h2 { font-size: 12px; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  .sub { color: #666; font-size: 10px; margin-bottom: 14px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 6px; }
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
<h1>San Luca Ristorante — Reporte de ventas</h1>
<div class="sub">${h(rangeLabel)} · generado ${h(stamp())}</div>

<div class="kpis">
  <div class="kpi"><span>Ventas</span><b>${mx(k.sales)}</b></div>
  <div class="kpi"><span>Cuentas</span><b>${k.comandas}</b></div>
  <div class="kpi"><span>Comensales</span><b>${k.guests}</b></div>
  <div class="kpi"><span>Ticket promedio</span><b>${mx(k.avgTicket)}</b></div>
  <div class="kpi"><span>Propinas</span><b>${mx(k.tips)}</b></div>
  <div class="kpi"><span>IVA cobrado</span><b>${mx(k.taxCollected)}</b></div>
</div>

${d.byShift.length ? `<h2>Por turno</h2>${table(
    ["Turno", "Horario", "Ventas", "Cuentas", "Comensales", "Ticket prom.", "Ocupación"],
    d.byShift.map((s) => [s.label, s.window, mx(s.sales), s.comandas, s.guests, mx(s.avgTicket), `${s.occupancy}%`]),
    2)}` : ""}

${d.bySection.length ? `<h2>Por zona</h2>${table(
    ["Zona", "Ventas", "Cuentas"],
    d.bySection.map((s) => [s.section, mx(s.sales), s.comandas]))}` : ""}

${d.topDishes.length ? `<h2>Por producto</h2>${table(
    ["Producto", "Cantidad", "Importe", "Cuentas"],
    d.topDishes.map((p) => [p.name, p.qty, mx(p.revenue), p.comandas]))}` : ""}

${d.byCarta.length ? `<h2>Por sección del menú</h2>${table(
    ["Sección", "Cantidad", "Importe", "Cuentas"],
    d.byCarta.map((c) => [c.carta, c.qty, mx(c.revenue), c.comandas]))}` : ""}

<footer>Documento informativo. No es un comprobante fiscal.</footer>
</body></html>`;
}

/** Nombre de archivo sin acentos ni espacios, con la fecha de emisión. */
export function reportFileName(rangeLabel: string, ext: string): string {
  const slug = rangeLabel
    // Sin quitar las marcas, "Últimos" se descompone en "U" + tilde y la tilde
    // acaba convertida en separador: "u-ltimos". \p{M} las elimina.
    .normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reporte";
  const day = new Date().toISOString().slice(0, 10);
  return `sanluca-ventas-${slug}-${day}.${ext}`;
}
