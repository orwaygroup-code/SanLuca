// ============================================================
//  Prueba / uso manual del CAJÓN de dinero.
//  Manda el pulso ESC/POS a la impresora CAJA (definida en config.json).
//  Uso:  node abrir-cajon.js        (pin 2, lo más común)
//        node abrir-cajon.js 5      (si con el pin 2 no abre, prueba el 5)
// ============================================================
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { execFile } = require("child_process");

const pin = process.argv[2] === "5" ? 5 : 2;
const KICK = Buffer.from([0x1B, 0x70, pin === 5 ? 1 : 0, 0x19, 0xFA]); // ESC p m 25 250

let cfg;
try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8")); }
catch (e) { console.error("No pude leer config.json:", e.message); process.exit(1); }

const caja = cfg.printers && cfg.printers.CAJA;
const pr = Array.isArray(caja) ? caja[0] : caja;
if (!pr) { console.error("No hay impresora 'CAJA' en config.json"); process.exit(1); }

function done(err) {
  if (err) { console.error("FALLO al abrir el cajón:", err.message); process.exit(1); }
  console.log("Pulso enviado a CAJA (pin " + pin + ").");
  console.log("Si el cajón NO abrió, prueba el otro pin:  node abrir-cajon.js " + (pin === 2 ? 5 : 2));
  process.exit(0);
}

if (pr.type === "share") {
  const tmp = path.join(os.tmpdir(), "slkick-" + Date.now() + ".prn");
  fs.writeFileSync(tmp, KICK);
  execFile("cmd.exe", ["/c", "copy", "/b", tmp, "\\\\localhost\\" + pr.share], { windowsHide: true }, (err, _o, se) => {
    fs.unlink(tmp, () => {});
    done(err ? new Error((se || err.message).trim()) : null);
  });
} else {
  const s = new net.Socket();
  s.setTimeout(8000);
  s.on("timeout", () => done(new Error("timeout a " + pr.ip)));
  s.on("error", done);
  s.on("close", () => done(null));
  s.connect(pr.port || 9100, pr.ip, () => s.end(KICK));
}
