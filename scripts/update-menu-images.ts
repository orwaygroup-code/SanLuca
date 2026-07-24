/**
 * Asigna imágenes a los platillos del menú (Dish.imageUrl) por nombre.
 * Las imágenes viven en public/images/menu/platillos/ (commiteadas).
 * Idempotente. Ejecutar en VPS: cd /var/www/sanluca && npx tsx scripts/update-menu-images.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IMAGES: { name: string; file: string }[] = [
  // ── Antipasti ──
  { name: "Carpaccio di Manzo Wagyu", file: "carpaccio-di-manzo-wagyu.jpg" },
  { name: "Carpaccio di Salmone", file: "carpaccio-di-salmone.jpg" },
  { name: "Carpaccio di Polpo", file: "carpaccio-di-polpo.jpg" },
  { name: "Vitello Tonnato", file: "vitello-tonnato.jpg" },
  { name: "Calamari Fritti", file: "calamari-fritti.jpg" },
  { name: "Cozze alla Marinara", file: "cozze-alla-marinara.jpg" },
  { name: "Bruschette ai Carciofi e Formaggio", file: "bruschette-carciofi-formaggio.jpg" },
  { name: "Provola al Forno", file: "provola-al-forno.jpg" },
  { name: "Polpo all Aglio e Olio", file: "polpo-aglio-e-olio.jpg" },
  // ── Paste ──
  { name: "Linguine Fra Diavola", file: "linguine-fra-diavola.jpg" },
  { name: "Alfredo nella Ruota di Grana Padano", file: "alfredo-ruota.jpg" },
  { name: "Aglio, Olio e Peperoncino nella Ruota Grana Padano", file: "aglio-olio-ruota.jpg" },
  { name: "Spaghetti al Pesto Genovese", file: "spaghetti-pesto-genovese.jpg" },
  { name: "Frutti di Mare (Pasta)", file: "frutti-di-mare-pasta.jpg" },
  { name: "Fettuccine Mare e Monti", file: "fettuccine-mare-e-monti.jpg" },
  { name: "Penne Arrabbiata", file: "penne-arrabbiata.jpg" },
  { name: "Capellini al Tartufo", file: "capellini-al-tartufo.jpg" },
  { name: "Lasagna di Wagyu", file: "lasagna-di-wagyu.jpg" },
  // ── Pizza ──
  { name: "Francescana", file: "pizza-francescana.jpg" },
  { name: "Frutti di Mare (Pizza)", file: "pizza-frutti-di-mare.jpg" },
  { name: "Gamberi", file: "pizza-gamberi.jpg" },
  { name: "Salsiccia e Pancetta", file: "pizza-salsiccia-pancetta.jpg" },
  { name: "Medici", file: "pizza-medici.jpg" },
  // ── Risotto ──
  { name: "Risotto ai Tartufo", file: "risotto-ai-tartufo.jpg" },
  { name: "Risotto ai Gamberi e Limone", file: "risotto-gamberi-limone.jpg" },
  // ── Insalate ──
  { name: "Caprese", file: "caprese.jpg" },
  { name: "Fichi e Prosciutto (Ensalada)", file: "fichi-prosciutto-ensalada.jpg" },
  { name: "Fragola, Capra e Grana", file: "fragola-capra-grana.jpg" },
  { name: "Cestino di Parmigiano", file: "cestino-di-parmigiano.jpg" },
  // ── Terra ──
  { name: "Brasato al Vino Rosso", file: "brasato-al-vino-rosso.jpg" },
  { name: "Petto di Pollo alla Boscaiola", file: "petto-di-pollo-boscaiola.jpg" },
  // ── Pesce ──
  { name: "Salmone Ora King alla Rosina", file: "salmone-rosina.jpg" },
  { name: "Totoaba alla Livornese", file: "totoaba-livornese.jpg" },
  { name: "Spigola al Limone", file: "spigola-al-limone.jpg" },
  // ── Postres ──
  { name: "Panna Cotta", file: "panna-cotta.jpg" },
  { name: "Tiramisù", file: "tiramisu.jpg" },
  { name: "Pera al Barolo con Gelato", file: "pera-al-barolo.jpg" },
  // ── Especialidades del Chef ──
  { name: "Sashimi de Atún Aleta Azul", file: "sashimi-atun.jpg" },
  { name: "Aguachile Negro Tatemado", file: "aguachile-negro.png" },
  { name: "Hamburguesa de Wagyu", file: "hamburguesa-wagyu.jpg" },
  { name: "Taco de Jaiba", file: "taco-de-jaiba.jpg" },
  { name: "Cream Chowder", file: "cream-chowder.jpg" },
];

async function main() {
  console.log(`\n── Asignando ${IMAGES.length} imágenes a platillos ──`);
  let ok = 0;
  const missing: string[] = [];
  for (const it of IMAGES) {
    const r = await prisma.dish.updateMany({
      where: { name: it.name },
      data: { imageUrl: `/images/menu/platillos/${it.file}` },
    });
    if (r.count > 0) { console.log(`  ✓ ${it.name}`); ok++; }
    else { console.warn(`  ⚠ NO EXISTE EN BD: "${it.name}"`); missing.push(it.name); }
  }
  console.log(`\n✅ Asignadas: ${ok} / ${IMAGES.length}`);
  if (missing.length) console.log(`⚠ Sin match en BD (revisar nombre):\n   - ${missing.join("\n   - ")}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
