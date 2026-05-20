/**
 * Seed idempotente del catálogo de tags default para conversaciones de WhatsApp.
 * Ver wiki [[Conversation Tags]] §Seed.
 *
 * Ejecutar en el VPS (después de `npm run db:push` para aplicar el schema):
 *   cd /var/www/sanluca && npx tsx scripts/seed-tags.ts
 *
 * Idempotente: usa upsert por `name`. Re-correrlo no duplica ni revierte
 * cambios manuales (descripción/color) que el admin haya hecho en /crm/tags
 * — el `update` solo escribe `description` y `color` la primera vez via
 * `create`. En re-runs, `update: {}` evita pisar ediciones humanas.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_TAGS: Array<{
  name: string;
  color: "slate" | "red" | "amber" | "green" | "blue" | "violet" | "pink";
  description: string;
}> = [
  { name: "VIP",          color: "amber",  description: "Cliente frecuente con prioridad de atención" },
  { name: "Cumpleañero",  color: "pink",   description: "Cumpleaños este mes" },
  { name: "Vegano",       color: "green",  description: "Preferencia alimentaria" },
  { name: "Vegetariano",  color: "green",  description: "Preferencia alimentaria" },
  { name: "Sin gluten",   color: "amber",  description: "Restricción alimentaria" },
  { name: "Mariscos",     color: "blue",   description: "Le gustan los mariscos" },
  { name: "Negocios",     color: "slate",  description: "Visitas de trabajo / reuniones" },
  { name: "Pareja",       color: "pink",   description: "Visitas en pareja, citas, etc." },
  { name: "Grupo grande", color: "violet", description: "Reservaciones de >8 personas" },
  { name: "Inactivo",     color: "red",    description: "Sin actividad en 90+ días" },
];

async function main() {
  // upsert atómico evita race conditions y respeta ediciones humanas:
  // `update: {}` no toca color/description si el tag ya existe — el admin
  // pudo haber recoloreado o reescrito la descripción desde /crm/tags.
  const results = await Promise.all(
    DEFAULT_TAGS.map((t) =>
      prisma.tag.upsert({
        where:  { name: t.name },
        update: {},
        create: {
          name:        t.name,
          color:       t.color,
          description: t.description,
          isActive:    true,
        },
        select: { createdAt: true, updatedAt: true },
      }),
    ),
  );

  // Heurística: si createdAt === updatedAt, fue creado en este run.
  const created = results.filter((r) => r.createdAt.getTime() === r.updatedAt.getTime()).length;
  const skipped = results.length - created;

  console.log(`[seed-tags] created=${created} skipped=${skipped} total=${DEFAULT_TAGS.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[seed-tags] failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
