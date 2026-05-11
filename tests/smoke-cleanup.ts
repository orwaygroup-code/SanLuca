/**
 * Cleanup post-smoke: borra el user de prueba y sus dependencias.
 * Usa el cliente Prisma admin (BYPASSRLS) — para test cleanup ese privilegio
 * es necesario para garantizar borrado completo independientemente de RLS.
 *
 * Uso: npx tsx tests/smoke-cleanup.ts <email>
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Falta email");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    console.log(`No existe: ${email}`);
    return;
  }

  // Borrar reservas creadas/dueñas. Cascade en Reservation → ReservationItem.
  await prisma.reservation.deleteMany({
    where: { OR: [{ userId: user.id }, { createdById: user.id }] },
  });
  await prisma.user.delete({ where: { id: user.id } });
  console.log(`✓ Cleanup: ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
