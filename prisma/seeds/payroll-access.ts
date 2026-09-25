import { prisma } from "../../lib/prisma";

/**
 * Arranque en frío del permiso de nómina (Ola N-1). Nadie tiene `payrollAccess` al
 * desplegar, y como solo lo enciende quien ya lo tiene, nadie podría dárselo. Este seed
 * lo enciende para los usernames que reciba por `PAYROLL_USERS` (separados por coma).
 * Idempotente. `DRY_RUN=1` imprime el plan sin escribir.
 *
 * Uso:  PAYROLL_USERS=ricardo,paul npm run db:seed:payroll-access
 * DRY:  DRY_RUN=1 PAYROLL_USERS=ricardo npm run db:seed:payroll-access
 */

const DRY = process.env.DRY_RUN === "1";

async function main() {
  const usernames = [...new Set(
    (process.env.PAYROLL_USERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  )];
  if (usernames.length === 0) {
    console.error("✗ Falta PAYROLL_USERS. Formato: PAYROLL_USERS=ricardo,paul npm run db:seed:payroll-access");
    process.exit(1);
  }

  console.log(`\n── Acceso a nómina ${DRY ? "(DRY_RUN: no escribe)" : "(EN FIRME)"} ──`);
  console.log(`Usuarios pedidos: ${usernames.join(", ")}\n`);

  let encendidos = 0;
  const yaTenian: string[] = [];
  for (const username of usernames) {
    const staff = await prisma.staff.findUnique({
      where: { username },
      select: { id: true, fullName: true, active: true, payrollAccess: true },
    });
    if (!staff) { console.log(`   ⚠  "${username}": no existe, se omite.`); continue; }
    if (!staff.active) { console.log(`   ⚠  "${username}" (${staff.fullName}): inactivo, se omite.`); continue; }
    if (staff.payrollAccess) { yaTenian.push(username); console.log(`   ↩  "${username}" (${staff.fullName}): ya tenía el permiso.`); continue; }
    encendidos++;
    if (!DRY) await prisma.staff.update({ where: { id: staff.id }, data: { payrollAccess: true } });
    console.log(`   ${DRY ? "[DRY] ✚" : "✅"} "${username}" (${staff.fullName}): permiso ${DRY ? "se encendería" : "encendido"}.`);
  }

  console.log(`\nResumen: ${DRY ? "se encenderían" : "encendidos"} ${encendidos} · ya tenían el permiso ${yaTenian.length}${yaTenian.length ? ` (${yaTenian.join(", ")})` : ""}.`);
  if (DRY) console.log("\nDRY_RUN=1 → NO se escribió nada.\n");
}

main()
  .catch((e) => { console.error("Error en payroll-access:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
