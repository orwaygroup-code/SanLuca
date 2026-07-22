/**
 * Especialidades del Chef — actualización julio 2026.
 *   1. Reemplaza "Langosta Empapelada Rellena de Mariscos" por
 *      "Langosta Roja Viva de Ensenada" (precio de mercado, $3/gramo).
 *   2. Agrega "Almejas Chocolatas Natural" ($90) y "a la Parmesana" ($125),
 *      sin descripción.
 * Idempotente (re-ejecutable sin duplicar).
 * Ejecutar en VPS: cd /var/www/sanluca && npx tsx scripts/update-menu-chef-2026-07.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const chef = await prisma.menuCategory.findFirst({
        where: { name: "Especialidades del Chef" },
    });
    if (!chef) throw new Error('Categoría "Especialidades del Chef" no encontrada');

    console.log("\n── Especialidades del Chef ──");

    // 1. Langosta Empapelada → Langosta Roja Viva de Ensenada (precio por gramo)
    const empapelada = await prisma.dish.findFirst({
        where: { name: "Langosta Empapelada Rellena de Mariscos", categoryId: chef.id },
    });
    if (empapelada) {
        await prisma.dish.update({
            where: { id: empapelada.id },
            data: {
                name: "Langosta Roja Viva de Ensenada",
                description: "Precio según tamaño. Pregunta a tu mesero por la receta del día.",
                price: 3,
            },
        });
        console.log('  ✓ "Langosta Empapelada" → "Langosta Roja Viva de Ensenada" ($3/gr)');
    } else {
        console.log('  ↩ "Langosta Empapelada" no encontrada (¿ya renombrada?)');
    }

    // 2. Almejas Chocolatas (2 preparaciones, sin descripción)
    const almejas = [
        { name: "Almejas Chocolatas Natural", price: 90, position: 12 },
        { name: "Almejas Chocolatas a la Parmesana", price: 125, position: 13 },
    ];
    for (const a of almejas) {
        const existing = await prisma.dish.findFirst({
            where: { name: a.name, categoryId: chef.id },
        });
        if (existing) {
            await prisma.dish.update({ where: { id: existing.id }, data: { price: a.price } });
            console.log(`  ✓ Actualizado: "${a.name}" ($${a.price})`);
        } else {
            await prisma.dish.create({
                data: {
                    name: a.name,
                    description: "",
                    price: a.price,
                    categoryId: chef.id,
                    position: a.position,
                    available: true,
                },
            });
            console.log(`  + Creado: "${a.name}" ($${a.price})`);
        }
    }

    console.log("\n✅ Especialidades del Chef actualizado.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
