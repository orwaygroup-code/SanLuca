import { prisma } from "../../lib/prisma";
import { generatePin, hashPin } from "../../lib/staff-auth";

/**
 * Crea ~8 empleados de COCINA (rol KITCHEN): NO son meseros, no operan el POS. Solo pueden
 * recibir credito (cuenta a credito que se salda despues) y ver su wallet (/staff/wallet).
 * Cada uno nace con un PIN generado que se IMPRIME aqui para distribuirlo; renombra al
 * empleado real y/o cambia su PIN en /admin (Empleados). Idempotente por username cocinaN.
 *
 * Correr en el VPS:  cd /var/www/sanluca && npx tsx prisma/seeds/kitchen-staff.ts
 */
const TENANT = 1;
const COUNT = 8;

async function main() {
  const created: { username: string; fullName: string; pin: string }[] = [];
  for (let i = 1; i <= COUNT; i++) {
    const username = `cocina${i}`;
    const existing = await prisma.staff.findUnique({ where: { username }, select: { id: true } });
    if (existing) { console.log(`- ${username} ya existe (#${existing.id}), se omite.`); continue; }
    const pin = generatePin();
    await prisma.staff.create({
      data: { tenantId: TENANT, username, fullName: `Cocina ${i}`, role: "KITCHEN", pinHash: await hashPin(pin) },
    });
    created.push({ username, fullName: `Cocina ${i}`, pin });
  }

  if (created.length === 0) { console.log("Sin cambios: los usuarios de cocina ya existian."); return; }
  console.log(`\nCreados ${created.length} usuarios de COCINA (rol KITCHEN). PINs generados (guardalos):`);
  for (const c of created) console.log(`  ${c.fullName} (${c.username})  ->  PIN ${c.pin}`);
  console.log("\nRenombra cada uno con el nombre real y/o cambia su PIN en /admin -> Empleados.");
}

main()
  .catch((e) => { console.error("Error en kitchen-staff:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
