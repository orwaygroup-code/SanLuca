/**
 * Lista usuarios registrados en la BD.
 * Uso local:  npx tsx scripts/list-users.ts
 * Uso en VPS: cd /var/www/sanluca && npx tsx scripts/list-users.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      source: true,
      googleId: true,
      createdAt: true,
      _count: { select: { reservations: true } },
    },
  });

  console.log(`\nTotal usuarios: ${users.length}\n`);
  console.table(
    users.map((u) => ({
      Nombre:     u.name || "—",
      Email:      u.email,
      Phone:      u.phone || "—",
      Role:       u.role,
      Source:     u.source,
      Login:      u.googleId ? "google" : "email",
      Reservas:   u._count.reservations,
      Registrado: u.createdAt.toISOString().slice(0, 10),
    }))
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
