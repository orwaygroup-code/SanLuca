/**
 * Actualizar precios, descripciones, imágenes y platillos faltantes del menú brunch.
 * Ejecutar en VPS: cd /var/www/sanluca && npx tsx scripts/update-menu-brunch.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findCategory(name: string) {
    const cat = await prisma.menuCategory.findFirst({ where: { name } });
    if (!cat) throw new Error(`Categoría no encontrada: "${name}"`);
    return cat;
}

async function updateDish(categoryId: string, name: string, data: { price?: number; description?: string | null; imageUrl?: string | null; position?: number }) {
    const result = await prisma.dish.updateMany({ where: { name, categoryId }, data });
    if (result.count === 0) {
        console.warn(`  ⚠ No encontrado para actualizar: "${name}"`);
    } else {
        console.log(`  ✓ Actualizado: "${name}"`);
    }
}

async function upsertDish(categoryId: string, name: string, data: { price: number; description?: string | null; imageUrl?: string | null; position?: number }) {
    const existing = await prisma.dish.findFirst({ where: { name, categoryId } });
    if (existing) {
        await prisma.dish.update({ where: { id: existing.id }, data });
        console.log(`  ✓ Actualizado: "${name}"`);
    } else {
        await prisma.dish.create({ data: { name, categoryId, ...data } });
        console.log(`  + Creado: "${name}"`);
    }
}

async function main() {
    // ── PIATTI SALATI ─────────────────────────────────────────────────────────
    console.log("\n📋 Piatti Salati (Brunch)");
    const plattiSalati = await findCategory("Platti Salati (Brunch)");

    await updateDish(plattiSalati.id, "Huevos rotos (estilo español)", {
        price: 252,
        imageUrl: "/images/menu/brunch/Alimentos/huevos-rotos.jpg",
    });
    await updateDish(plattiSalati.id, "Uova alla Benedict", {
        price: 252,
        imageUrl: "/images/menu/brunch/Alimentos/uova-alla-benedict.jpg",
    });
    await updateDish(plattiSalati.id, "Uova alla Milanese", {
        price: 255,
    });
    await updateDish(plattiSalati.id, "Tortilla española", {
        price: 199,
        imageUrl: "/images/menu/brunch/Alimentos/tortilla-espanola.jpg",
    });
    await updateDish(plattiSalati.id, "Molletes", {
        price: 155,
        imageUrl: "/images/menu/brunch/Alimentos/molletes.jpg",
    });
    // Nuevo
    await upsertDish(plattiSalati.id, "Chilaquiles negros", {
        price: 179,
        description: "Con huevo (2pz) $225 · Con pollo 100g $235 · Con arrachera Cross Wagyu 100g $295.",
        imageUrl: "/images/menu/brunch/Alimentos/chilaquiles-negros.jpg",
        position: 6,
    });

    // ── TOASTS & PANINI ───────────────────────────────────────────────────────
    console.log("\n📋 Toasts & Panini (Brunch)");
    const toastsPanini = await findCategory("Toasts & Panini (Brunch)");

    await updateDish(toastsPanini.id, "Toast prosciutto e formaggio", {
        price: 155,
        description: "Tost de jamón de pierna y queso fundido.",
    });
    await updateDish(toastsPanini.id, "Pepito di arrachera", {
        price: 252,
        imageUrl: "/images/menu/brunch/Alimentos/pepito-di-arrachera.jpg",
    });
    await updateDish(toastsPanini.id, "Panino di roast beef di picanha", {
        price: 275,
    });
    await updateDish(toastsPanini.id, "Mozzarella in carrozza", {
        price: 228,
        imageUrl: "/images/menu/brunch/Alimentos/mozzarella-in-carrozza.jpg",
    });
    await updateDish(toastsPanini.id, "Croque Madame", {
        price: 255,
        imageUrl: "/images/menu/brunch/Alimentos/croque-madame.jpg",
    });

    // ── ESPECIALES ────────────────────────────────────────────────────────────
    console.log("\n📋 Especiales (Brunch)");
    const especiales = await findCategory("Especiales (Brunch)");

    // Nuevo
    await upsertDish(especiales.id, "Lasagna de crepas", {
        price: 255,
        description: "Crepas a la bolognesa de Cross Wagyu.",
        position: 1,
    });
    await updateDish(especiales.id, "Crepes di ricotta e spinaci gratinate ai quattro formaggi", {
        price: 215,
    });
    await updateDish(especiales.id, "Polpette al sugo", {
        price: 255,
    });
    await updateDish(especiales.id, "Crostoni casarecci", {
        price: 350,
    });
    await updateDish(especiales.id, "Bagel con salmone Oraking e formaggio cremoso", {
        price: 225,
    });
    // Eliminar Ratatouille (no está en la carta actual)
    const ratatouille = await prisma.dish.findFirst({ where: { name: "Ratatouille", categoryId: especiales.id } });
    if (ratatouille) {
        await prisma.dish.delete({ where: { id: ratatouille.id } });
        console.log(`  ✗ Eliminado: "Ratatouille"`);
    }

    // ── PANETTERIA & DOLCI ────────────────────────────────────────────────────
    console.log("\n📋 Panetteria & Dolci (Brunch)");
    const panetteria = await findCategory("Panetteria & Dolci (Brunch)");

    await updateDish(panetteria.id, "Affogato al Gelato", { price: 179 });

    // Nuevos
    await upsertDish(panetteria.id, "Crepas de cajeta", {
        price: 155,
        position: 4,
    });
    await upsertDish(panetteria.id, "Crepas de cajeta con gelato extra", {
        price: 215,
        position: 5,
    });

    console.log("\n✅ Menú brunch actualizado correctamente.");
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
