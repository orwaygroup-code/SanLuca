/*
 * Genera los íconos PWA (PNG) a partir de public/icon.svg usando sharp.
 * Correr:  node scripts/gen-pwa-icons.js
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svg = fs.readFileSync(path.join(__dirname, "..", "public", "icon.svg"));
const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

(async () => {
  for (const t of targets) {
    await sharp(svg, { density: 400 })
      .resize(t.size, t.size)
      .png()
      .toFile(path.join(outDir, t.file));
    console.log("OK", t.file);
  }
  console.log("Iconos PWA generados en public/icons/");
})();
