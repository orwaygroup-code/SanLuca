/**
 * Migración idempotente: lleva la jerarquía del menú de config/Menustructure.ts
 * a la BD. Crea las Cartas (turno + clase) y asigna cada MenuCategory a su carta.
 * Reasignable sin riesgo (upsert + update por nombre). Solo agrega vínculos.
 *   npx tsx scripts/migrate-cartas.ts
 */
import { prisma } from "@/lib/prisma";
import { COMIDA_GROUPS, BRUNCH_GROUPS } from "@/config/Menustructure";

// Cartas cuyo contenido es BEBIDAS (barra); el resto es ALIMENTOS (cocina).
const BARRA_CARTAS = new Set(["Bebidas", "Destilados", "Vinos"]);

async function main() {
  const plan = [
    ...COMIDA_GROUPS.map((g, i) => ({ turno: "COMIDA" as const, group: g, pos: i })),
    ...BRUNCH_GROUPS.map((g, i) => ({ turno: "BRUNCH" as const, group: g, pos: i })),
  ];

  let assigned = 0;
  const unmatched: string[] = [];

  for (const { turno, group, pos } of plan) {
    const clase = BARRA_CARTAS.has(group.groupName) ? ("BARRA" as const) : ("COCINA" as const);
    const carta = await prisma.carta.upsert({
      where: { turno_name: { turno, name: group.groupName } },
      update: { clase, position: pos },
      create: { name: group.groupName, turno, clase, position: pos },
    });
    console.log(`Carta ${turno} · ${group.groupName} (${clase})`);

    for (const cat of group.categories) {
      // Las categorías de brunch en la BD llevan sufijo " (Brunch)".
      const dbName = turno === "BRUNCH" ? `${cat.name} (Brunch)` : cat.name;
      const dbCat = await prisma.menuCategory.findFirst({ where: { name: dbName } });
      if (!dbCat) { unmatched.push(`${turno}/${group.groupName}/${dbName}`); continue; }
      await prisma.menuCategory.update({ where: { id: dbCat.id }, data: { cartaId: carta.id } });
      assigned++;
      console.log(`  ✓ ${dbName}`);
    }
  }

  console.log(`\nCategorías asignadas: ${assigned}`);
  if (unmatched.length) console.log(`Sin match en BD (config sin categoría real): ${unmatched.join(", ")}`);

  const orphans = await prisma.menuCategory.findMany({ where: { cartaId: null }, select: { name: true } });
  if (orphans.length) console.log(`⚠ Categorías SIN carta (${orphans.length}): ${orphans.map((o) => o.name).join(", ")}`);
  else console.log("✓ Todas las categorías de la BD quedaron asignadas a una carta.");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
