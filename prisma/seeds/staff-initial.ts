import type { StaffRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { resolvePin } from "../../lib/staff";
import { isValidPin } from "../../lib/staff-auth";

/**
 * Seed inicial de empleados (Fase 0 — sistema de Comandas).
 *
 * IDEMPOTENTE: si un username ya existe, lo deja intacto (NO resetea su PIN).
 * Solo crea los que falten. Los PINs se generan aleatorios y únicos por
 * tenant, y se imprimen UNA vez al final (no se pueden consultar después).
 *
 * Para fijar PINs conocidos en el primer seed, exporta antes:
 *   SEED_RICARDO_PIN, SEED_PERLA_PIN, SEED_CAPITAN_PIN  (4 dígitos)
 *
 * Correr:  npm run db:seed:staff
 */

const TENANT = 1;

interface SeedDef {
  username: string;
  fullName: string;
  role: StaffRole;
  pin?: string; // PIN fijo opcional (solo Ricardo/Perla/Capitán vía env)
}

function envPin(name: string): string | undefined {
  const v = process.env[name];
  return v && isValidPin(v) ? v : undefined;
}

const defs: SeedDef[] = [
  { username: "ricardo", fullName: "Ricardo Camacho",          role: "MANAGER",   pin: envPin("SEED_RICARDO_PIN") },
  { username: "perla",   fullName: "Perla (Operación)",        role: "OPERATION", pin: envPin("SEED_PERLA_PIN") },
  { username: "capitan", fullName: "[Capitán - asignar nombre]", role: "CAPTAIN", pin: envPin("SEED_CAPITAN_PIN") },
  // 12 meseros placeholder — Ricardo edita nombres y PINs desde /admin/staff.
  ...Array.from({ length: 12 }, (_, i): SeedDef => ({
    username: `mesero${i + 1}`,
    fullName: `Mesero ${i + 1} (cambiar nombre)`,
    role: "WAITER",
  })),
];

async function main() {
  const created: { username: string; role: string; pin: string }[] = [];
  const skipped: string[] = [];

  for (const def of defs) {
    const existing = await prisma.staff.findUnique({ where: { username: def.username } });
    if (existing) {
      skipped.push(def.username);
      continue;
    }
    // resolvePin valida unicidad contra los ya creados (se confirman secuencialmente).
    const { pin, hash } = await resolvePin(def.pin, { tenantId: TENANT });
    await prisma.staff.create({
      data: {
        tenantId: TENANT,
        username: def.username,
        fullName: def.fullName,
        role: def.role,
        pinHash: hash,
      },
    });
    created.push({ username: def.username, role: def.role, pin });
  }

  console.log("\n──────────────────────────────────────────────");
  console.log(" SEED STAFF — Fase 0 (sistema de Comandas)");
  console.log("──────────────────────────────────────────────");
  if (created.length) {
    console.log(`\n✅ Creados (${created.length}). PINs (se muestran SOLO esta vez):\n`);
    console.table(created);
    console.log("\n⚠  Guarda estos PINs ahora. Ricardo puede regenerarlos desde /admin/staff.");
  }
  if (skipped.length) {
    console.log(`\n↩  Ya existían (sin cambios): ${skipped.join(", ")}`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("Error en seed de staff:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
