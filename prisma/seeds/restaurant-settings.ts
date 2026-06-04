import { prisma } from "../../lib/prisma";

/**
 * Seed de RestaurantSettings (Fase B.1). Idempotente.
 * Crea 1 fila para el tenant 1 con el estado actual del restaurante:
 * IVA 16% activo (precios IVA-incluido).
 *
 * Correr: npm run db:seed:settings
 */
async function main() {
  const existing = await prisma.restaurantSettings.findUnique({ where: { tenantId: 1 } });
  if (existing) {
    console.log("↩ RestaurantSettings ya existe (sin cambios):", {
      taxEnabled: existing.taxEnabled,
      taxRate: existing.taxRate.toString(),
    });
    return;
  }
  const created = await prisma.restaurantSettings.create({
    data: { tenantId: 1, taxEnabled: true, taxRate: 0.16 },
  });
  console.log("✅ RestaurantSettings creado:", {
    taxEnabled: created.taxEnabled,
    taxRate: created.taxRate.toString(),
  });
}

main()
  .catch((e) => { console.error("Error en seed de settings:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
