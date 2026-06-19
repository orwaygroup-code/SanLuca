import { prisma } from "../../lib/prisma";

/**
 * Correcciones de la carta digital — 2026-06-17.
 *
 * Idempotente. Léelo por bloques numerados; cada bloque reporta lo que hizo.
 *
 * Cambios reales (validados contra el snapshot de DB):
 *   1. Cafés "agrupados" se separan en 8 productos con precio propio
 *   2. Soft-delete duplicados de Bloody Mary ($169) y Espresso Martini ($181)
 *      — el usuario pidió quedarse con Bloody Mary $110 y Expresso Martini $175
 *   3. Mimosa: $144 → $169
 *   4. Bellini: soft-delete
 *   5. Malteada: rename "Malteadas con fruta de temporada" → "Malteada"
 *      + precio $94 → $75 + nueva descripción
 *   6. Chilaquiles: soft-delete "Chilaquiles negros" + crear 3 variantes nuevas
 *
 * Correr:  npm run db:seed:brunch-fix
 */

// Cafés nuevos a crear en la categoría del dish agrupado original.
// Spelling italiano consistente con el resto del menú (Espresso, Cappuccino).
const NEW_COFFEES = [
  { name: "Americano",                          price: 49,  description: null,                                  position: 1 },
  { name: "Espresso",                           price: 55,  description: null,                                  position: 2 },
  { name: "Espresso doble",                     price: 85,  description: null,                                  position: 3 },
  { name: "Latte",                              price: 65,  description: null,                                  position: 4 },
  { name: "Latte sabor",                        price: 70,  description: "Pregunta al mesero los sabores del día.", position: 5 },
  { name: "Cappuccino",                         price: 69,  description: null,                                  position: 6 },
  { name: "Cappuccino Baileys",                 price: 135, description: null,                                  position: 7 },
  { name: "Cappuccino mocha y vainilla",        price: 77,  description: null,                                  position: 8 },
] as const;

// Chilaquiles nuevos a crear en la categoría del dish original
const NEW_CHILAQUILES = [
  { name: "Chilaquiles con huevo",                 price: 225, description: "2 piezas de huevo." },
  { name: "Chilaquiles con pollo",                 price: 235, description: "100 g de pollo." },
  { name: "Chilaquiles con arrachera cross wagyu", price: 295, description: "100 g de arrachera cross wagyu." },
] as const;

async function main() {
  console.log("\n── Correcciones carta brunch — 2026-06-17 ──\n");

  // ── 1. CAFÉS: soft-delete agrupado + crear 8 productos separados ───
  console.log("1. Separando cafés agrupados en 8 productos individuales…");
  const grouped = await prisma.dish.findFirst({
    where: { name: { contains: "Espresso / Americano / Latte", mode: "insensitive" } },
    select: { id: true, name: true, available: true, categoryId: true, category: { select: { name: true } } },
  });
  let coffeeCategoryId: string | null = null;
  if (grouped) {
    coffeeCategoryId = grouped.categoryId;
    if (grouped.available) {
      await prisma.dish.update({ where: { id: grouped.id }, data: { available: false } });
      console.log(`   ✅ "${grouped.name}" (cat: ${grouped.category.name}) marcado como NO disponible`);
    } else {
      console.log(`   ↩  "${grouped.name}": ya estaba inactivo`);
    }
  } else {
    console.log("   ⚠  No se encontró el dish agrupado de café — busco categoría 'Cafetería (Brunch)'.");
    const cat = await prisma.menuCategory.findFirst({
      where: { name: { contains: "cafetería", mode: "insensitive" } },
    });
    if (cat) coffeeCategoryId = cat.id;
  }

  if (coffeeCategoryId) {
    for (const c of NEW_COFFEES) {
      const existing = await prisma.dish.findFirst({
        where: { name: c.name, categoryId: coffeeCategoryId },
        select: { id: true, price: true, available: true, description: true },
      });
      if (existing) {
        const needsUpdate =
          Number(existing.price) !== c.price ||
          !existing.available ||
          (c.description ?? null) !== existing.description;
        if (!needsUpdate) {
          console.log(`   ↩  "${c.name}": ya existe y está OK`);
          continue;
        }
        await prisma.dish.update({
          where: { id: existing.id },
          data:  { price: c.price, available: true, description: c.description ?? null },
        });
        console.log(`   🔄 "${c.name}": actualizado`);
        continue;
      }
      await prisma.dish.create({
        data: {
          name:        c.name,
          description: c.description ?? null,
          price:       c.price,
          categoryId:  coffeeCategoryId,
          position:    c.position,
          available:   true,
        },
      });
      console.log(`   ✅ "${c.name}" creado a $${c.price}`);
    }
  } else {
    console.log("   ❌ Sin categoría destino, no se crearon cafés nuevos.");
  }

  // ── 2. SOFT-DELETE DUPLICADOS ──────────────────────────────────────
  console.log("\n2. Soft-delete de duplicados (Bloody Mary $169, Espresso Martini $181)…");
  await softDeleteByExactNameAndPrice("Bloody Mary",      169);
  await softDeleteByExactNameAndPrice("Espresso Martini", 181);

  // ── 3. MIMOSA $144 → $169 ──────────────────────────────────────────
  console.log("\n3. Actualizando precio de Mimosa…");
  await updatePriceByExactName("Mimosa", 169);

  // ── 4. BELLINI: soft-delete ────────────────────────────────────────
  console.log("\n4. Eliminando Bellini (soft-delete)…");
  const bellinis = await prisma.dish.findMany({
    where: { name: { equals: "Bellini", mode: "insensitive" } },
    select: { id: true, name: true, available: true, category: { select: { name: true } } },
  });
  if (bellinis.length === 0) {
    console.log("   ⚠  No se encontró 'Bellini'.");
  } else {
    for (const b of bellinis) {
      if (!b.available) {
        console.log(`   ↩  ${b.name}: ya estaba inactivo`);
        continue;
      }
      await prisma.dish.update({ where: { id: b.id }, data: { available: false } });
      console.log(`   ✅ ${b.name} (cat: ${b.category.name}) marcado como NO disponible`);
    }
  }

  // ── 5. MALTEADA: rename + precio + descripción ─────────────────────
  console.log("\n5. Actualizando 'Malteadas con fruta de temporada' → 'Malteada'…");
  const malteadaOriginal = await prisma.dish.findFirst({
    where: { name: { contains: "Malteadas con fruta", mode: "insensitive" } },
    select: { id: true, name: true, price: true, description: true },
  });
  if (!malteadaOriginal) {
    console.log("   ⚠  No se encontró la malteada original. Busco cualquier 'Malteada'…");
    const fallback = await prisma.dish.findFirst({
      where: { name: { contains: "malteada", mode: "insensitive" } },
      select: { id: true, name: true, price: true, description: true },
    });
    if (!fallback) {
      console.log("   ❌ Ninguna malteada encontrada. Saltando.");
    } else {
      await prisma.dish.update({
        where: { id: fallback.id },
        data:  { name: "Malteada", price: 75, description: "Sabores disponibles: vainilla, chocolate y fresa." },
      });
      console.log(`   ✅ "${fallback.name}" actualizado a "Malteada" $75 (sabores vainilla/chocolate/fresa)`);
    }
  } else {
    await prisma.dish.update({
      where: { id: malteadaOriginal.id },
      data:  { name: "Malteada", price: 75, description: "Sabores disponibles: vainilla, chocolate y fresa." },
    });
    console.log(`   ✅ "${malteadaOriginal.name}" $${Number(malteadaOriginal.price)} → "Malteada" $75 con nueva descripción`);
  }

  // ── 6. CHILAQUILES: soft-delete original + crear 3 variantes ───────
  console.log("\n6. Reemplazando 'Chilaquiles negros' con 3 variantes…");
  const oldChila = await prisma.dish.findMany({
    where: { name: { contains: "chilaquiles", mode: "insensitive" } },
    select: { id: true, name: true, available: true, categoryId: true, category: { select: { name: true } } },
  });
  // Excluir las variantes nuevas (por si re-corremos el seed)
  const realOldChila = oldChila.filter(
    (d) =>
      !d.name.toLowerCase().includes("con huevo") &&
      !d.name.toLowerCase().includes("con pollo") &&
      !d.name.toLowerCase().includes("con arrachera"),
  );

  let chilaCategoryId: string | null = null;
  for (const d of realOldChila) {
    chilaCategoryId = d.categoryId;
    if (!d.available) {
      console.log(`   ↩  ${d.name}: ya estaba inactivo`);
      continue;
    }
    await prisma.dish.update({ where: { id: d.id }, data: { available: false } });
    console.log(`   ✅ ${d.name} (cat: ${d.category.name}) marcado como NO disponible`);
  }
  if (!chilaCategoryId) {
    const cat = await prisma.menuCategory.findFirst({
      where: { name: { contains: "platti salati", mode: "insensitive" } },
    });
    if (cat) chilaCategoryId = cat.id;
  }

  if (chilaCategoryId) {
    for (let i = 0; i < NEW_CHILAQUILES.length; i++) {
      const v = NEW_CHILAQUILES[i];
      const existing = await prisma.dish.findFirst({
        where: { name: v.name, categoryId: chilaCategoryId },
        select: { id: true, price: true, available: true, description: true },
      });
      if (existing) {
        const needsUpdate =
          Number(existing.price) !== v.price ||
          !existing.available ||
          existing.description !== v.description;
        if (!needsUpdate) {
          console.log(`   ↩  "${v.name}": ya existe y está OK`);
          continue;
        }
        await prisma.dish.update({
          where: { id: existing.id },
          data:  { price: v.price, available: true, description: v.description },
        });
        console.log(`   🔄 "${v.name}": actualizado`);
        continue;
      }
      await prisma.dish.create({
        data: {
          name:        v.name,
          description: v.description,
          price:       v.price,
          categoryId:  chilaCategoryId,
          position:    100 + i,
          available:   true,
        },
      });
      console.log(`   ✅ "${v.name}" creado a $${v.price}`);
    }
  } else {
    console.log("   ❌ Sin categoría destino, no se crearon chilaquiles nuevos.");
  }

  console.log("\n✨ Correcciones aplicadas. Siguiente paso recomendado:");
  console.log("   npm run db:seed:prep-area   (clasifica los productos nuevos en BARRA o COCINA)");
  console.log();
}

// ── Helpers ──────────────────────────────────────────────────────────

async function updatePriceByExactName(name: string, newPrice: number) {
  const dishes = await prisma.dish.findMany({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true, price: true, category: { select: { name: true } } },
  });
  if (dishes.length === 0) {
    console.log(`   ⚠  No encontrado: "${name}"`);
    return;
  }
  for (const d of dishes) {
    const oldPrice = Number(d.price);
    if (oldPrice === newPrice) {
      console.log(`   ↩  ${d.name} (${d.category.name}): ya estaba en $${newPrice}`);
      continue;
    }
    await prisma.dish.update({ where: { id: d.id }, data: { price: newPrice } });
    console.log(`   ✅ ${d.name} (${d.category.name}): $${oldPrice} → $${newPrice}`);
  }
}

async function softDeleteByExactNameAndPrice(name: string, price: number) {
  const dishes = await prisma.dish.findMany({
    where: {
      name:  { equals: name, mode: "insensitive" },
      price: price,
    },
    select: { id: true, name: true, available: true, category: { select: { name: true } } },
  });
  if (dishes.length === 0) {
    console.log(`   ⚠  No encontrado: "${name}" a $${price}`);
    return;
  }
  for (const d of dishes) {
    if (!d.available) {
      console.log(`   ↩  ${d.name} $${price} (${d.category.name}): ya estaba inactivo`);
      continue;
    }
    await prisma.dish.update({ where: { id: d.id }, data: { available: false } });
    console.log(`   ✅ ${d.name} $${price} (${d.category.name}): soft-delete (duplicado)`);
  }
}

main()
  .catch((e) => { console.error("Error en brunch-corrections:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
