/*
 * PrintBridge San Luca — corre en la PC de caja (Windows).
 * Jala tickets PENDING del sistema (VPS) y los imprime en las 3 impresoras
 * térmicas ESC/POS de la red local (cocina / barra / caja) por TCP puerto 9100.
 *
 * Requiere Node.js 18+ (usa fetch nativo). Sin dependencias externas.
 * Arrancar:  node index.js   (o npm start)
 */

const net  = require("net");
const fs   = require("fs");
const path = require("path");

// ─── Config ───────────────────────────────────────────────────────────
const cfgPath = path.join(__dirname, "config.json");
if (!fs.existsSync(cfgPath)) {
  console.error("Falta config.json. Copia config.example.json a config.json y llena las IPs.");
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const { apiBaseUrl, bridgeKey, printers } = cfg;
const pollIntervalMs = cfg.pollIntervalMs || 3000;

// ─── ESC/POS ──────────────────────────────────────────────────────────
const ESC = "\x1b", GS = "\x1d";
const INIT = ESC + "@";
const BOLD_ON = ESC + "E" + "\x01", BOLD_OFF = ESC + "E" + "\x00";
const BIG_ON = GS + "!" + "\x11", BIG_OFF = GS + "!" + "\x00"; // doble alto+ancho
const CUT = "\n\n\n" + GS + "V" + "\x00";                       // corte total

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sin librería de codepage: quitamos acentos → ASCII limpio en cualquier impresora.
function ascii(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function rule(w) { return "-".repeat(w); }
function center(s, w) {
  s = ascii(s);
  if (s.length >= w) return s.slice(0, w);
  return " ".repeat(Math.floor((w - s.length) / 2)) + s;
}
function row(left, right, w) {
  left = ascii(left); right = ascii(right);
  const gap = w - left.length - right.length;
  return gap < 1 ? (left + " " + right).slice(0, w) : left + " ".repeat(gap) + right;
}
function money(n) { return "$" + Number(n).toFixed(2); }
function fmtTime(iso) { try { return new Date(iso).toLocaleString("es-MX"); } catch { return iso; } }

function renderKitchen(p, w) {
  let o = INIT;
  o += BOLD_ON + BIG_ON + center(p.area === "BARRA" ? "BARRA" : "COCINA", Math.floor(w / 2)) + BIG_OFF + BOLD_OFF + "\n";
  o += BOLD_ON + center(p.table, w) + BOLD_OFF + "\n";
  o += center(p.folio + " - " + ascii(p.waiter), w) + "\n";
  o += center(fmtTime(p.time), w) + "\n";
  o += rule(w) + "\n";
  for (const it of p.items) {
    o += BOLD_ON + it.qty + " x " + ascii(it.name) + BOLD_OFF + "\n";
    if (it.mods)  o += "   + " + ascii(it.mods) + "\n";
    if (it.notes) o += "   * " + ascii(it.notes) + "\n";
  }
  o += rule(w) + CUT;
  return o;
}

function renderCustomer(p, w) {
  let o = INIT;
  o += BOLD_ON + BIG_ON + center("SAN LUCA", Math.floor(w / 2)) + BIG_OFF + BOLD_OFF + "\n";
  o += center("Ristorante", w) + "\n";
  if (p.reprint) o += center("** REIMPRESION **", w) + "\n";
  o += center(p.table, w) + "\n";
  o += center(p.folio + (p.ticketNumber ? " - Ticket " + p.ticketNumber : ""), w) + "\n";
  o += center(fmtTime(p.time), w) + "\n";
  o += rule(w) + "\n";
  for (const it of p.items) {
    o += it.qty + " x " + ascii(it.name) + "\n";
    o += row("   " + money(it.unit) + " c/u", money(it.total), w) + "\n";
  }
  o += rule(w) + "\n";
  if (p.subtotal != null) o += row("Subtotal", money(p.subtotal), w) + "\n";
  if (p.tax != null && Number(p.tax) > 0) o += row("IVA", money(p.tax), w) + "\n";
  o += BOLD_ON + BIG_ON + row("TOTAL", money(p.total), Math.floor(w / 2)) + BIG_OFF + BOLD_OFF + "\n";
  o += rule(w) + "\n";
  o += center("Gracias por su visita", w) + CUT;
  return o;
}

// ─── Envío TCP a impresora (raw ESC/POS, puerto 9100) ─────────────────
function sendToPrinter(target, data) {
  return new Promise((resolve, reject) => {
    const pr = printers[target];
    if (!pr || !pr.ip) return reject(new Error("Sin impresora configurada para " + target));
    const socket = new net.Socket();
    let done = false;
    const finish = (err) => { if (done) return; done = true; try { socket.destroy(); } catch {} err ? reject(err) : resolve(); };
    socket.setTimeout(8000);
    socket.on("timeout", () => finish(new Error("timeout de conexion")));
    socket.on("error", (e) => finish(e));
    socket.connect(pr.port || 9100, pr.ip, () => {
      socket.write(Buffer.from(data, "latin1"), () => setTimeout(() => finish(null), 300));
    });
  });
}

async function ack(id, ok, error) {
  try {
    await fetch(apiBaseUrl + "/api/print-jobs/" + id + "/ack", {
      method: "POST",
      headers: { "content-type": "application/json", "x-print-key": bridgeKey },
      body: JSON.stringify({ ok, error: error || null }),
    });
  } catch (e) { console.error("ack fallo job", id, "-", e.message); }
}

async function poll() {
  let res;
  try {
    res = await fetch(apiBaseUrl + "/api/print-jobs/pending", { headers: { "x-print-key": bridgeKey } });
  } catch (e) { console.error("no conecta al sistema:", e.message); return; }
  if (!res.ok) { console.error("pending HTTP", res.status); return; }
  const { jobs } = await res.json();

  for (const job of jobs || []) {
    const p = job.payload;
    const pr = printers[job.target];
    const w = (pr && pr.width) || 48;
    let data;
    try {
      data = p && p.kind === "kitchen" ? renderKitchen(p, w) : renderCustomer(p, w);
    } catch (e) { await ack(job.id, false, "render: " + e.message); continue; }

    let sent = false, lastErr = null;
    for (let attempt = 0; attempt < 2 && !sent; attempt++) {
      try { await sendToPrinter(job.target, data); sent = true; }
      catch (e) { lastErr = e; await sleep(600); }
    }
    await ack(job.id, sent, sent ? null : (lastErr && lastErr.message));
    console.log("[" + new Date().toLocaleTimeString() + "] job " + job.id + " -> " + job.target +
      " : " + (sent ? "IMPRESO" : "FALLO (" + (lastErr && lastErr.message) + ")"));
  }
}

console.log("PrintBridge San Luca");
console.log("  API:", apiBaseUrl, "| poll cada", pollIntervalMs, "ms");
console.log("  Impresoras:", Object.entries(printers).map(([k, v]) => k + "=" + v.ip + ":" + (v.port || 9100) + " (" + (v.width || 48) + "col)").join("  "));
console.log("  Esperando tickets... (Ctrl+C para salir)\n");

(async function loop() { for (;;) { await poll(); await sleep(pollIntervalMs); } })();
