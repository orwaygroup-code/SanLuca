import { PrismaClient, Prisma } from "@prisma/client";
import { getCurrentSession } from "./session-context";

/**
 * Cliente Prisma para requests web. Conecta como `sanluca_app` (rol con RLS).
 * Cualquier query ejecutada vía `withApp()` corre dentro de una transacción
 * que primero hace `SET LOCAL app.user_id` y `SET LOCAL app.role`, que las
 * policies de RLS evalúan.
 *
 * Si la sesión no está presente (público), se setea role='anon' — las
 * policies `public_read` permiten lectura, el resto bloquea.
 */

const globalForApp = globalThis as unknown as { prismaApp: PrismaClient | undefined };

export const prismaApp =
  globalForApp.prismaApp ??
  new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL_APP ?? process.env.DATABASE_URL ?? "" },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForApp.prismaApp = prismaApp;
}

/** Postgres single-quote escape. */
function pgEsc(v: string): string {
  return v.replace(/'/g, "''");
}

/**
 * Ejecuta `fn` dentro de una transacción con session vars RLS aplicados.
 * Lee la sesión de AsyncLocalStorage (`runWithSession`). Si no hay sesión,
 * usa role='anon'. La tx queda corta — solo `SET LOCAL` + queries del callback.
 *
 * Uso:
 *   return runWithSession(session, async () => {
 *     const data = await withApp((db) => db.reservation.findMany({...}));
 *     return NextResponse.json({ data });
 *   });
 */
export function withApp<T>(
  fn: (db: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const s = getCurrentSession();
  const userId = s ? pgEsc(s.userId) : "";
  const role   = s ? pgEsc(s.role)   : "anon";
  return prismaApp.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${userId}'`);
    await tx.$executeRawUnsafe(`SET LOCAL app.role    = '${role}'`);
    return fn(tx);
  });
}
