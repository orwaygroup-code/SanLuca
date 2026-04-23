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
    await prisma.menuCategory.update({ where: { id: plattiSalati.id }, data: { imageUrl: "/images/menu/brunch/portadas/platti-salati.jpg" } });
    console.log("  ✓ Portada: platti-salati.jpg");

    await updateDish(plattiSalati.id, "Huevos rotos (estilo español)", {
        price: 252,
        imageUrl: "/images/menu/brunch/Alimentos/platti salati/huevos-rotos.jpg",
    });
    await updateDish(plattiSalati.id, "Uova alla Benedict", {
        price: 252,
        imageUrl: "/images/menu/brunch/Alimentos/platti salati/uova-alla-benedict.jpg",
    });
    await updateDish(plattiSalati.id, "Uova alla Milanese", {
        price: 255,
        imageUrl: "/images/menu/brunch/Alimentos/platti salati/uova-alla-milanese.jpg",
    });
    await updateDish(plattiSalati.id, "Tortilla española", {
        price: 199,
        imageUrl: "/images/menu/brunch/Alimentos/platti salati/tortilla-espanola.jpg",
    });
    await updateDish(plattiSalati.id, "Molletes", {
        price: 155,
        imageUrl: "/images/menu/brunch/Alimentos/platti salati/molletes.jpg",
    });
    // Nuevo
    await upsertDish(plattiSalati.id, "Chilaquiles negros", {
        price: 179,
        description: "Con huevo (2pz) $225 · Con pollo 100g $235 · Con arrachera Cross Wagyu 100g $295.",
        imageUrl: "/images/menu/brunch/Alimentos/platti salati/chilaquiles-negros.jpg",
        position: 6,
    });

    // ── TOASTS & PANINI ───────────────────────────────────────────────────────
    console.log("\n📋 Toasts & Panini (Brunch)");
    const toastsPanini = await findCategory("Toasts & Panini (Brunch)");
    await prisma.menuCategory.update({ where: { id: toastsPanini.id }, data: { imageUrl: "/images/menu/brunch/portadas/toasts-panini.jpg" } });
    console.log("  ✓ Portada: toasts-panini.jpg");

    await updateDish(toastsPanini.id, "Toast prosciutto e formaggio", {
        price: 155,
        description: "Tost de jamón de pierna y queso fundido.",
        imageUrl: "/images/menu/brunch/Alimentos/toast&panini/toast-prosciutto.jpg",
    });
    await updateDish(toastsPanini.id, "Pepito di arrachera", {
        price: 252,
        imageUrl: "/images/menu/brunch/Alimentos/toast&panini/pepito-di-arrachera.jpg",
    });
    await updateDish(toastsPanini.id, "Panino di roast beef di picanha", {
        price: 275,
    });
    await updateDish(toastsPanini.id, "Panino di porchetta", {
        price: 252,
        imageUrl: "/images/menu/brunch/Alimentos/toast&panini/panino-di-porchetta.jpg",
    });
    await updateDish(toastsPanini.id, "Panini de pulpo a las brasas", {
        price: 295,
        imageUrl: "/images/menu/brunch/Alimentos/toast&panini/panini-pulpo.jpg",
    });
    await updateDish(toastsPanini.id, "Mozzarella in carrozza", {
        price: 228,
        imageUrl: "/images/menu/brunch/Alimentos/toast&panini/mozzarella-in-carrozza.jpg",
    });
    await updateDish(toastsPanini.id, "Croque Madame", {
        price: 255,
        imageUrl: "/images/menu/brunch/Alimentos/toast&panini/croque-madame.jpg",
    });

    // ── OMELETTES ─────────────────────────────────────────────────────────────
    console.log("\n📋 Omelettes (Brunch)");
    const omelettes = await findCategory("Omelettes (Brunch)");
    await prisma.menuCategory.update({ where: { id: omelettes.id }, data: { imageUrl: "/images/menu/brunch/portadas/omelettes.jpg" } });
    console.log("  ✓ Portada: omelettes.jpg");

    await updateDish(omelettes.id, "Omelette de queso con jamón", {
        imageUrl: "/images/menu/brunch/Alimentos/omelettes/om-queso-con-jamon.jpg",
    });
    await updateDish(omelettes.id, "Omelette de salmón Oraking y queso crema", {
        imageUrl: "/images/menu/brunch/Alimentos/omelettes/om-salmon-y quesocrema.jpg",
    });
    await updateDish(omelettes.id, "Omelette cuatro quesos", {
        imageUrl: "/images/menu/brunch/Alimentos/omelettes/om-cuatro-quesos.jpg",
    });
    await updateDish(omelettes.id, "Omelette light de claras con espinacas", {
        imageUrl: "/images/menu/brunch/Alimentos/omelettes/om-light-con-espinacas.jpg",
    });

    // ── ESPECIALES ────────────────────────────────────────────────────────────
    console.log("\n📋 Especiales (Brunch)");
    const especiales = await findCategory("Especiales (Brunch)");
    await prisma.menuCategory.update({ where: { id: especiales.id }, data: { imageUrl: "/images/menu/brunch/portadas/especiales.jpg" } });
    console.log("  ✓ Portada: especiales.jpg");

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
    await updateDish(especiales.id, "Brioche di brisket en salsa gravy", {
        price: 252,
    });
    await updateDish(especiales.id, "Crostoni casarecci", {
        price: 225,
    });
    await updateDish(especiales.id, "Bagel con salmone Oraking e formaggio cremoso", {
        price: 350,
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

    // ── COMIDA: portadas de categorías ────────────────────────────────────────
    console.log("\n📋 Portadas Comida (Clásica)");

    const comidaPortadas: { name: string; imageUrl: string }[] = [
        { name: "Antipasti",        imageUrl: "/images/menu/clasica/antipaste.png" },
        { name: "Paste",            imageUrl: "/images/menu/clasica/paste.png" },
        { name: "Pizza",            imageUrl: "/images/menu/clasica/pizza.png" },
        { name: "Risotto",          imageUrl: "/images/menu/clasica/risoto.png" },
        { name: "Insalate",         imageUrl: "/images/menu/clasica/ensalada.png" },
        { name: "Terra",            imageUrl: "/images/menu/clasica/terra.png" },
        { name: "Pesce Del Giorno", imageUrl: "/images/menu/clasica/pesce.png" },
    ];

    for (const { name, imageUrl } of comidaPortadas) {
        const cat = await prisma.menuCategory.findFirst({ where: { name } });
        if (cat) {
            await prisma.menuCategory.update({ where: { id: cat.id }, data: { imageUrl } });
            console.log(`  ✓ Portada: ${name}`);
        } else {
            console.warn(`  ⚠ No encontrada: "${name}"`);
        }
    }

    console.log("\n✅ Portadas Comida actualizadas.");
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
