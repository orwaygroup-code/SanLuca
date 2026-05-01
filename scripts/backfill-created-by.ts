/**
 * Backfill `Reservation.createdById`:
 * - Reservas cuyo userId tiene email `*@hostes.guest` fueron creadas por staff (no por el "guest").
 *   Asignamos createdById al primer usuario HOSTES o ADMIN encontrado.
 * - Reservas con createdById ya seteado se omiten.
 * - Reservas restantes (cliente reservó por sí mismo): createdById = userId.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.user.findFirst({
    where: { role: { in: ["HOSTES", "ADMIN"] } },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, role: true },
  });
  if (!staff) {
    console.log("No HOSTES/ADMIN encontrado — saltando backfill de staff.");
  } else {
    console.log(`Staff por defecto: ${staff.name} (${staff.role})`);
  }

  // 1) Reservas con guest creado por staff
  if (staff) {
    const staffRes = await prisma.reservation.updateMany({
      where: {
        createdById: null,
        user: { email: { endsWith: "@hostes.guest" } },
      },
      data: { createdById: staff.id },
    });
    console.log(`✓ Asignadas a staff (${staff.name}): ${staffRes.count}`);
  }

  // 2) El resto: createdById = userId
  const remaining = await prisma.reservation.findMany({
    where: { createdById: null },
    select: { id: true, userId: true },
  });
  for (const r of remaining) {
    await prisma.reservation.update({ where: { id: r.id }, data: { createdById: r.userId } });
  }
  console.log(`✓ Asignadas a su propio dueño: ${remaining.length}`);

  // Resumen
  const total = await prisma.reservation.count();
  const withCreator = await prisma.reservation.count({ where: { createdById: { not: null } } });
  console.log(`\nTotal reservas: ${total} · Con createdById: ${withCreator}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
