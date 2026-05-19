import type { Prisma } from "@prisma/client";

/**
 * Email único del usuario-sistema "anónimo".
 * Las reservaciones de cuentas eliminadas se reasignan a este user para
 * conservar el historial agregado (revenue, ocupación) sin vincularlo
 * a un titular real. Ver [[Data Deletion Procedure]] §2.2.
 */
export const ANON_SYSTEM_EMAIL = "anonimo@sistema.sanlucaristorante.com";
export const ANON_SYSTEM_NAME  = "ANONIMIZADO";
export const ANON_SYSTEM_PHONE = "0000000000";

/**
 * Devuelve el id del user-sistema "anónimo", creándolo si no existe.
 * Idempotente — apto para llamar dentro de la transacción de eliminación.
 */
export async function ensureAnonymousUserId(
  db: Prisma.TransactionClient,
): Promise<string> {
  const existing = await db.user.findUnique({
    where:  { email: ANON_SYSTEM_EMAIL },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.user.create({
    data: {
      name:   ANON_SYSTEM_NAME,
      email:  ANON_SYSTEM_EMAIL,
      phone:  ANON_SYSTEM_PHONE,
      role:   "CUSTOMER",
      source: "WEB",
    },
    select: { id: true },
  });
  return created.id;
}
