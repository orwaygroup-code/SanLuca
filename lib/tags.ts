import type { Prisma } from "@prisma/client";

/**
 * Helpers para el sistema de tags sobre conversaciones de WhatsApp.
 * Ver [[Conversation Tags]] del wiki para diseño y motivación.
 */

/**
 * Normaliza el nombre de un tag al input:
 *   - Trim
 *   - Colapsa espacios internos a uno solo
 *   - Capitaliza la primera letra; el resto queda como lo escribió el admin
 *
 * Ejemplos:
 *   "  vip  "          → "Vip"
 *   "  cumpleañero"    → "Cumpleañero"
 *   "Sin gluten "      → "Sin gluten"
 *
 * La unicidad en DB se valida case-insensitive aparte (ver `findTagByName`).
 */
export function normalizeTagName(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return "";
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

/**
 * Busca un tag por nombre case-insensitive. Devuelve null si no existe.
 * Sirve para detectar colisiones al renombrar/crear.
 */
export async function findTagByName(
  db: Prisma.TransactionClient | { tag: { findFirst: (args: unknown) => Promise<unknown> } },
  name: string,
): Promise<{ id: string; name: string; isActive: boolean } | null> {
  const normalized = normalizeTagName(name);
  if (!normalized) return null;
  // @ts-expect-error Prisma's loose typing across delegate/transaction client
  return db.tag.findFirst({
    where:  { name: { equals: normalized, mode: "insensitive" } },
    select: { id: true, name: true, isActive: true },
  });
}
