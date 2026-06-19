import { prisma } from "../../lib/prisma";

/**
 * Correcciones de la carta digital (brunch) — 2026-06-17.
 *
 * Idempotente. Búsqueda case-insensitive con `contains` para tolerar
 * pequeñas variaciones de nombre (espacios, mayúsculas). Reporta cada
 * cambio aplicado o saltado.
 *
 * Cambios:
 *   1. Actualizar precios de 13 bebidas
 *   2. Soft-delete "Bellini" (available=false; conserva historial)
 *   3. Actualizar descripción de "Malteada" (vainilla/chocolate/fresa, sin fruta de temporada)
 *   4. Soft-delete "Chilaquiles negros" y crear 3 variantes con precio propio
 *
 * Correr:
 *   npm run db:seed:brunch-fix-2026-06-17
 * O directo:
 *   npx tsx prisma/seeds/brunch-corrections-2026-06-17.ts
 */

interface PriceUpdate {
  match: string;          // substring case-insensitive
  newPrice: number;
  note?: string;
}

const PRICE_UPDATES: PriceUpdate[] = [
  { match: "americano",                                 newPrice: 49  },
  { match: "expreso doble",                             newPrice: 85,  note: "antes 'Expreso doble'" },
  { match: "expreso",                                   newPrice: 55,  note: "el solo (NO el doble — el match más específico va antes)" },
  { match: "latte sabor",                               newPrice: 70  },
  { match: "latte",                                     newPrice: 65,  note: "el clásico (NO el de sabor)" },
  { match: "capuccino baileys",                         newPrice: 135 },
  { match: "capuccino moccha",                          newPrice: 77,  note: "moccha y vainilla" },
  { match: "capuccino",                                 newPrice: 69,  note: "el solo" },
  { match: "carajillo licor 43",                        newPrice: 145 },
  { match: "expresso martini",                          newPrice: 175, note: "cuidado: doble 's' en italiano" },
  { match: "mimosa",                                    newPrice: 169 },
  { match: "aperol spritz",                             newPrice: 160 },
  { match: "bloody mary",                               newPrice: 110 },
];

const MALTEADA_NEW_DESCRIPTION =
  "Sabores disponibles: vainilla, chocolate y fresa.";

async function main() {
  console.log("\n── Correcciones carta brunch — 2026-06-17 ──\n");

  // ── 1. PRICE UPDATES ────────────────────────────────────────────────
  console.log("1. Actualizando precios de bebidas…");
  const seenIds = new Set<string>();
  for (const u of PRICE_UPDATES) {
    const dishes = await prisma.dish.findMany({
      where: { name: { contains: u.match, mode: "insensitive" } },
      select: { id: true, name: true, price: true, category: { select: { name: true } } },
    });
    if (dishes.length === 0) {
      console.log(`   ⚠  No encontrado: "${u.match}"`);
      continue;
    }
    // Filtramos los ya tocados en pasos anteriores para evitar pisar precios
    // (e.g. "expreso" matchearía también "expreso doble" si no lo excluimos).
    const targets = dishes.filter((d) => !seenIds.has(d.id));
    if (targets.length === 0) {
      // Permitido — el match más específico ya lo tomó.
      continue;
    }
    if (targets.length > 1) {
      console.log(`   ℹ  "${u.match}" matchea ${targets.length} platillos:`);
      for (const d of targets) console.log(`        - ${d.name} (cat: ${d.category.name})`);
    }
    for (const d of targets) {
      seenIds.add(d.id);
      const oldPrice = Number(d.price);
      if (oldPrice === u.newPrice) {
        console.log(`   ↩  ${d.name}: ya estaba en $${u.newPrice}`);
        continue;
      }
      await prisma.dish.update({
        where: { id: d.id },
        data:  { price: u.newPrice },
      });
      console.log(
        `   ✅ ${d.name}: $${oldPrice} → $${u.newPrice}${u.note ? `  (${u.note})` : ""}`,
      );
    }
  }

  // ── 2. SOFT-DELETE BELLINI ──────────────────────────────────────────
  console.log("\n2. Eliminando 'Bellini' (soft-delete: available=false)…");
  const bellinis = await prisma.dish.findMany({
    where: { name: { contains: "bellini", mode: "insensitive" } },
    select: { id: true, name: true, available: true, category: { select: { name: true } } },
  });
  if (bellinis.length === 0) {
    console.log("   ⚠  No se encontró ningún 'Bellini'.");
  } else {
    for (const b of bellinis) {
      if (!b.available) {
        console.log(`   ↩  ${b.name}: ya estaba inactivo`);
        continue;
      }
      await prisma.dish.update({
        where: { id: b.id },
        data:  { available: false },
      });
      console.log(`   ✅ ${b.name} (cat: ${b.category.name}) marcado como NO disponible`);
    }
  }

  // ── 3. MALTEADA ─────────────────────────────────────────────────────
  console.log("\n3. Actualizando descripción de 'Malteada'…");
  const malteadas = await prisma.dish.findMany({
    where: { name: { contains: "malteada", mode: "insensitive" } },
    select: { id: true, name: true, description: true, category: { select: { name: true } } },
  });
  if (malteadas.length === 0) {
    console.log("   ⚠  No se encontró ninguna 'Malteada'.");
  } else {
    for (const m of malteadas) {
      if (m.description === MALTEADA_NEW_DESCRIPTION) {
        console.log(`   ↩  ${m.name}: descripción ya actualizada`);
        continue;
      }
      await prisma.dish.update({
        where: { id: m.id },
        data:  { description: MALTEADA_NEW_DESCRIPTION },
      });
      console.log(`   ✅ ${m.name} (cat: ${m.category.name}): descripción actualizada`);
    }
  }

  // ── 4. CHILAQUILES — soft-delete del original + 3 variantes nuevas ─
  console.log("\n4. Reemplazando 'Chilaquiles' con 3 variantes…");
  const oldChilaquiles = await prisma.dish.findMany({
    where: {
      name: { contains: "chilaquiles", mode: "insensitive" },
      // No soft-deleteamos las variantes nuevas si el seed se corre dos veces
      NOT: { name: { contains: "con huevo", mode: "insensitive" } },
      // Las dos exclusiones de variantes más específicas se hacen en code abajo
    },
    select: { id: true, name: true, available: true, categoryId: true, category: { select: { name: true } } },
  });
  // Aplicamos exclusión adicional para los que ya creamos
  const realOlds = oldChilaquiles.filter(
    (d) =>
      !d.name.toLowerCase().includes("con pollo") &&
      !d.name.toLowerCase().includes("con arrachera"),
  );

  let categoryId: string | null = null;
  if (realOlds.length === 0) {
    console.log("   ⚠  No se encontró 'Chilaquiles' original. Intentando localizar categoría 'Platti Salati (Brunch)'…");
    const cat = await prisma.menuCategory.findFirst({ where: { name: { contains: "platti salati", mode: "insensitive" } } });
    if (!cat) {
      console.log("   ❌ Tampoco se encontró la categoría. Saltando creación de variantes.");
    } else {
      categoryId = cat.id;
    }
  } else {
    for (const d of realOlds) {
      categoryId = d.categoryId; // usamos la categoría del primer match para las variantes nuevas
      if (!d.available) {
        console.log(`   ↩  ${d.name}: ya estaba inactivo`);
        continue;
      }
      await prisma.dish.update({
        where: { id: d.id },
        data:  { available: false },
      });
      console.log(`   ✅ ${d.name} (cat: ${d.category.name}) marcado como NO disponible`);
    }
  }

  if (categoryId) {
    const VARIANTS = [
      { name: "Chilaquiles con huevo",                    price: 225, description: "2 piezas de huevo." },
      { name: "Chilaquiles con pollo",                    price: 235, description: "100 g de pollo." },
      { name: "Chilaquiles con arrachera cross wagyu",    price: 295, description: "100 g de arrachera cross wagyu." },
    ];
    for (let i = 0; i < VARIANTS.length; i++) {
      const v = VARIANTS[i];
      const existing = await prisma.dish.findFirst({
        where: { name: v.name, categoryId },
        select: { id: true, price: true, available: true },
      });
      if (existing) {
        // Si existe, asegurar precio y disponibilidad correctos
        if (Number(existing.price) === v.price && existing.available) {
          console.log(`   ↩  "${v.name}": ya existe y está OK`);
          continue;
        }
        await prisma.dish.update({
          where: { id: existing.id },
          data:  { price: v.price, available: true, description: v.description },
        });
        console.log(`   🔄 "${v.name}": actualizado (precio/disponibilidad/descripción)`);
        continue;
      }
      await prisma.dish.create({
        data: {
          name:        v.name,
          description: v.description,
          price:       v.price,
          categoryId,
          position:    100 + i, // al final de la categoría
          available:   true,
        },
      });
      console.log(`   ✅ "${v.name}" creado a $${v.price}`);
    }
  }

  console.log("\n✨ Correcciones aplicadas. Siguiente paso recomendado:");
  console.log("   npm run db:seed:prep-area   (clasifica los chilaquiles nuevos como COCINA)");
  console.log();
}

main()
  .catch((e) => { console.error("Error en brunch-corrections:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
