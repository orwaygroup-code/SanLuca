import { randomBytes } from "crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/auth";

/**
 * Crea el "mesero" de SISTEMA "Llevar". No es una persona: las cuentas PARA LLEVAR se le
 * asignan como mesero para que ese 7% (punto) NO sea de nadie. Se muestra "Llevar" en todo
 * el sistema; el creador real (ej. Perla) queda en openedById para auditoría.
 * NO puede loguearse: su pinHash es de una cadena aleatoria larga, ningún PIN de 4 dígitos
 * lo abre. Idempotente.
 *
 * Correr en el VPS:  cd /var/www/sanluca && npx tsx prisma/seeds/system-llevar.ts
 */
const TENANT = 1;

async function main() {
  const existing = await prisma.staff.findUnique({ where: { username: "llevar" }, select: { id: true, fullName: true } });
  if (existing) {
    console.log(`↩ Staff de sistema "Llevar" ya existe (#${existing.id}).`);
    return;
  }
  const s = await prisma.staff.create({
    data: {
      tenantId: TENANT,
      username: "llevar",
      fullName: "Llevar",
      role: "WAITER",
      pinHash: await hashPassword(randomBytes(24).toString("hex")), // no-login: ningún PIN 4-díg lo abre
    },
    select: { id: true },
  });
  console.log(`✅ Staff de sistema "Llevar" creado (#${s.id}). Las cuentas para llevar se le asignan; no genera punto.`);
}

main()
  .catch((e) => { console.error("Error en system-llevar:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
