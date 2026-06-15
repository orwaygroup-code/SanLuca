/**
 * Correcciones de carta digital: precios, nombres, eliminaciones y sección Copeos.
 * Ejecutar en VPS: cd /var/www/sanluca && npx tsx scripts/update-menu-carta-digital.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findCategory(name: string) {
    const cat = await prisma.menuCategory.findFirst({ where: { name } });
    if (!cat) throw new Error(`Categoría no encontrada: "${name}"`);
    return cat;
}

async function updatePrice(categoryId: string, name: string, price: number) {
    const r = await prisma.dish.updateMany({ where: { name, categoryId }, data: { price } });
    r.count === 0
        ? console.warn(`  ⚠ No encontrado: "${name}"`)
        : console.log(`  ✓ Precio "${name}" -> $${price}`);
}

async function rename(categoryId: string, oldName: string, newName: string, price?: number) {
    const data: { name: string; price?: number } = { name: newName };
    if (price !== undefined) data.price = price;
    const r = await prisma.dish.updateMany({ where: { name: oldName, categoryId }, data });
    r.count === 0
        ? console.warn(`  ⚠ No encontrado: "${oldName}"`)
        : console.log(`  ✓ Renombrado "${oldName}" -> "${newName}"${price !== undefined ? ` ($${price})` : ""}`);
}

async function remove(categoryId: string, name: string) {
    const r = await prisma.dish.deleteMany({ where: { name, categoryId } });
    console.log(r.count > 0 ? `  ✓ Eliminado: "${name}"` : `  ⚠ No encontrado para eliminar: "${name}"`);
}

async function main() {
    // ── CAFETERÍA ─────────────────────────────────
    const cafeteria = await findCategory("Cafetería");
    await updatePrice(cafeteria.id, "Expreso corto", 55);
    await rename(cafeteria.id, "Expreso doble", "Expreso largo", 85);

    // ── CERVEZA ───────────────────────────────────
    const cerveza = await findCategory("Cerveza");
    await updatePrice(cerveza.id, "Chelada", 20);
    await updatePrice(cerveza.id, "Gringa", 45);
    await updatePrice(cerveza.id, "Michelada", 25);

    // ── SIN ALCOHOL ───────────────────────────────
    const sinAlcohol = await findCategory("Sin Alcohol");
    await updatePrice(sinAlcohol.id, "Naranjada", 40);
    await updatePrice(sinAlcohol.id, "Limonada", 40);
    await updatePrice(sinAlcohol.id, "Agua Panna natural", 70);
    await updatePrice(sinAlcohol.id, "Agua Panna", 70);
    await updatePrice(sinAlcohol.id, "Agua tónica", 40);
    await updatePrice(sinAlcohol.id, "Clamato preparado", 50);

    // ── COCTELERÍA ────────────────────────────────
    const cocteleria = await findCategory("Coctelería");
    await updatePrice(cocteleria.id, "Mezcalita", 135);
    await remove(cocteleria.id, "Cerveza (coctelería)");
    await updatePrice(cocteleria.id, "Expreso Martini", 175);
    await rename(cocteleria.id, "Germain Spritz", "St Germain Spritz");
    await updatePrice(cocteleria.id, "Tinto de Verano", 115);

    // Mover "Jarra de Clericot 2L" de Jarras -> Coctelería
    const jarras = await findCategory("Jarras");
    const jarraClericot = await prisma.dish.findFirst({ where: { name: "Jarra de Clericot 2L", categoryId: jarras.id } });
    if (jarraClericot) {
        await prisma.dish.update({ where: { id: jarraClericot.id }, data: { categoryId: cocteleria.id } });
        console.log(`  ✓ Movido "Jarra de Clericot 2L" -> Coctelería`);
    } else {
        console.warn(`  ⚠ No encontrado: "Jarra de Clericot 2L"`);
    }

    // ── TEQUILA ───────────────────────────────────
    const tequila = await findCategory("Tequila");
    await updatePrice(tequila.id, "Don Julio Reposado", 210);

    // ── RON ───────────────────────────────────────
    const ron = await findCategory("Ron");
    await updatePrice(ron.id, "Bacardi Blanco", 110);
    await rename(ron.id, "Bacardi (limón, mango, chile, raspberry)", "Bacardi sabores", 110);

    // ── VODKA ─────────────────────────────────────
    const vodka = await findCategory("Vodka");
    await updatePrice(vodka.id, "Smirnoff", 95);
    await updatePrice(vodka.id, "Smirnoff de Tamarindo", 95);

    // ── MEZCAL ────────────────────────────────────
    const mezcal = await findCategory("Mezcal");
    await updatePrice(mezcal.id, "400 Conejos", 175);

    // ── WHISKEY ───────────────────────────────────
    const whiskey = await findCategory("Whiskey");
    await updatePrice(whiskey.id, "Jack Daniel's", 145);
    await rename(whiskey.id, "Bucanas Master", "Buchanan's Master");

    // ── CONAC ─────────────────────────────────────
    const conac = await findCategory("Coñac");
    await updatePrice(conac.id, "Martel VS", 220);

    // ── COPEOS (nueva sección en Vinos) ───────────
    console.log("\n🍷 Sección Copeos");
    let copeos = await prisma.menuCategory.findFirst({ where: { name: "Copeos" } });
    if (!copeos) {
        copeos = await prisma.menuCategory.create({ data: { name: "Copeos", position: 30 } });
        console.log(`  + Categoría creada: "Copeos"`);
    }

    // Mover Copa Montepulciano de Vino Tinto -> Copeos y actualizar precio
    const vinoTinto = await findCategory("Vino Tinto");
    const copaMonte = await prisma.dish.findFirst({ where: { name: "Copa Montepulciano", categoryId: vinoTinto.id } });
    if (copaMonte) {
        await prisma.dish.update({ where: { id: copaMonte.id }, data: { categoryId: copeos.id, price: 190, position: 1 } });
        console.log(`  ✓ Movido "Copa Montepulciano" -> Copeos ($190)`);
    } else {
        await prisma.dish.create({ data: { name: "Copa Montepulciano", description: "3 oz.", price: 190, categoryId: copeos.id, position: 1 } });
        console.log(`  + Creado "Copa Montepulciano" en Copeos ($190)`);
    }

    const nuevosCopeos = [
        { name: "Copa Negroamaro (tinto y rosado)", price: 250, position: 2 },
        { name: "Copa Scaia (blanco y tinto)", price: 280, position: 3 },
        { name: "Copa Primitivo", price: 280, position: 4 },
        { name: "Copa Pinot Grigio (blanco y rosado)", price: 190, position: 5 },
        { name: "Copa Lupo Nero (blanco)", price: 175, position: 6 },
    ];
    for (const item of nuevosCopeos) {
        const existing = await prisma.dish.findFirst({ where: { name: item.name, categoryId: copeos.id } });
        if (existing) {
            await prisma.dish.update({ where: { id: existing.id }, data: { price: item.price, position: item.position } });
            console.log(`  ✓ Actualizado "${item.name}"`);
        } else {
            await prisma.dish.create({ data: { ...item, description: "3 oz.", categoryId: copeos.id } });
            console.log(`  + Creado "${item.name}" ($${item.price})`);
        }
    }

    console.log("\n✅ Listo");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });