import { prisma } from "../../lib/prisma";
import type { PrepArea } from "@prisma/client";

/**
 * Backfill de Dish.prepArea (Fase B.1). Idempotente: NO sobrescribe platillos
 * que ya tengan prepArea. Clasifica por NOMBRE DE CATEGORÍA (mapeo aprobado
 * simplificado a 2 áreas):
 *   - BARRA  = bebidas (cafetería, sin alcohol, destilados, vinos, coctelería…)
 *   - COCINA = todo lo demás (pizza, pastas, ensaladas, antipasti, postres…)
 * Las categorías de Brunch ("(Brunch)") se clasifican por el mismo criterio.
 *
 * Correr: npm run db:seed:prep-area
 */

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s*\(brunch\)\s*/i, "").trim();

// Términos que marcan una categoría como BARRA (bebidas). Las categorías de
// comida del menú no contienen ninguno de estos términos.
const BARRA_TERMS = [
  "cafeteria", "cafe", "sin alcohol", "carajillo", "cerveza", "cocteleria", "coctel",
  "mocteleria", "moctel", "tequila", "ron", "vodka", "mezcal", "whiskey", "whisky",
  "conac", "cognac", "ginebra", "brandy", "aperitivo", "jarra", "digestivo", "crema",
  "vino", "espumoso", "champagne", "champan", "bebida", "destilado", "licor", "copa",
].map(norm);

function classify(categoryName: string): PrepArea {
  const n = norm(categoryName);
  return BARRA_TERMS.some((t) => n.includes(t)) ? "BARRA" : "COCINA";
}

async function main() {
  const dishes = await prisma.dish.findMany({
    select: { id: true, prepArea: true, category: { select: { name: true } } },
  });

  // Resumen por categoría → área (para reporte).
  const summary = new Map<string, { area: PrepArea; toUpdate: number; alreadySet: number }>();
  const updates: { id: string; area: PrepArea }[] = [];

  for (const d of dishes) {
    const cat = d.category?.name ?? "(sin categoría)";
    const area = classify(cat);
    const row = summary.get(cat) ?? { area, toUpdate: 0, alreadySet: 0 };
    if (d.prepArea) row.alreadySet++;
    else { row.toUpdate++; updates.push({ id: d.id, area }); }
    summary.set(cat, row);
  }

  console.log("\n── Backfill prepArea — resumen por categoría ──");
  console.table(
    Array.from(summary.entries())
      .sort()
      .map(([cat, r]) => ({ categoria: cat, prepArea: r.area, aClasificar: r.toUpdate, yaClasificados: r.alreadySet })),
  );

  if (updates.length === 0) {
    console.log("↩ Nada que actualizar (todos los platillos ya tienen prepArea, o no hay platillos).");
    return;
  }

  // Aplica en lotes por área (idempotente: solo los que estaban en NULL).
  for (const area of ["BARRA", "COCINA"] as const) {
    const ids = updates.filter((u) => u.area === area).map((u) => u.id);
    if (ids.length === 0) continue;
    const res = await prisma.dish.updateMany({
      where: { id: { in: ids }, prepArea: null },
      data: { prepArea: area },
    });
    console.log(`✅ ${area}: ${res.count} platillos actualizados`);
  }
}

main()
  .catch((e) => { console.error("Error en backfill de prepArea:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
