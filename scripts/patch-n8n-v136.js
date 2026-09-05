/**
 * Patch n8n JSON: v13.5 → v13.6
 * Reemplaza HTTP_Log_Sheets (Google Sheets) por HTTP_Log_BD (BD Prisma)
 * y corrige Preparar_Log: lee de Procesar_Respuesta (la fuente real de
 * hasReserva/reservaData) en vez de $input, y devuelve booleanos estrictos.
 *
 * Uso: node scripts/patch-n8n-v136.js <ruta-input.json> [ruta-output.json]
 */

const fs = require("fs");
const path = require("path");

const input  = process.argv[2] || "San Luca AI WhatsApp v13.5 FINAL (1).json";
const output = process.argv[3] || "San Luca AI WhatsApp v13.6 BD.json";

const data = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));

// ── CAMBIO A: reemplazar HTTP_Log_Sheets por HTTP_Log_BD ─────────────────
let found = false;
for (const node of data.nodes) {
  if (node.name === "HTTP_Log_Sheets") {
    node.name            = "HTTP_Log_BD";
    node.continueOnFail  = true;
    node.parameters      = {
      method: "POST",
      url: "http://127.0.0.1:3000/api/bot/messages",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Content-Type", value: "application/json" },
          { name: "x-bot-key",    value: "sanluca-bot-2026"  },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        "={{ JSON.stringify({ phone: $json.phone, inbound: $('SET_Mensaje_Final').first().json.message, outbound: $json.clientMessage, messageType: 'text', sentAt: new Date().toISOString() }) }}",
      options: { timeout: 5000 },
    };
    found = true;
    console.log("✓ Nodo HTTP_Log_BD actualizado");
    break;
  }
}
if (!found) console.warn("⚠  No se encontró HTTP_Log_Sheets — ya parchado?");

// ── CAMBIO B: Preparar_Log lee de Procesar_Respuesta (fix hasReserva) ────
// BUG que corrige: la versión anterior leía con `$input.first().json`, pero la entrada
// directa de Preparar_Log puede ser la respuesta de HTTP_Log_BD (POST /api/bot/messages),
// que NO trae estos campos → `hasReserva` salía undefined y el IF_Hay_Reserva tronaba
// ("'' is a string but was expecting a boolean") → nunca se creaban reservas.
// Fix: leer explícito de `$('Procesar_Respuesta')` (que sí arma hasReserva = reservaData!==null)
// y castear a booleano estricto (hasReserva/hasPedido) para el IF con validación de tipos.
const newCode = `const src = $('Procesar_Respuesta').first().json;

const phone            = src.phone;
const phone_number_id  = src.phone_number_id;
const clientMessage    = src.clientMessage;
const hasReserva       = src.hasReserva === true;
const reservaData      = src.reservaData ?? null;
const consultaReservas = src.consultaReservas ?? null;
const transferData     = src.transferData ?? null;
const hasPedido        = src.hasPedido === true;
const pedidoData       = src.pedidoData ?? null;
const pedidoMessage    = src.pedidoMessage ?? '';

// Modo hostess/admin (para filtros de consulta) se resuelve aquí desde el estado global.
const _sd = $getWorkflowStaticData('global');
const isHostess = !!(_sd.hostessMode && _sd.hostessMode[phone]);
const isAdmin = !!(_sd.adminMode && _sd.adminMode[phone]);

return [{ json: { phone, phone_number_id, clientMessage, hasReserva, reservaData, consultaReservas, transferData, isHostess, isAdmin, hasPedido, pedidoData, pedidoMessage } }];`;

for (const node of data.nodes) {
  if (node.name === "Preparar_Log") {
    node.parameters.jsCode = newCode;
    console.log("✓ Nodo Preparar_Log simplificado");
    break;
  }
}

// ── CAMBIO C: renombrar connection HTTP_Log_Sheets → HTTP_Log_BD ─────────
const conns = data.connections;
if (conns["HTTP_Log_Sheets"]) {
  conns["HTTP_Log_BD"] = conns["HTTP_Log_Sheets"];
  delete conns["HTTP_Log_Sheets"];
  console.log("✓ Connection fuente renombrada a HTTP_Log_BD");
}
for (const src of Object.keys(conns)) {
  for (const port of Object.keys(conns[src])) {
    for (const linkList of conns[src][port]) {
      for (const link of linkList) {
        if (link.node === "HTTP_Log_Sheets") {
          link.node = "HTTP_Log_BD";
          console.log(`✓ Referencia interna corregida (desde ${src})`);
        }
      }
    }
  }
}

// ── Metadata ─────────────────────────────────────────────────────────────
data.name = "San Luca AI WhatsApp v13.6 BD";

fs.writeFileSync(path.resolve(output), JSON.stringify(data, null, 2), "utf8");
console.log(`\n✅ JSON guardado en: ${output}`);
