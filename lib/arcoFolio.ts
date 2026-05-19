import type { Prisma } from "@prisma/client";

/**
 * Genera un folio único `ARCO-YYYY-NNNN` para el año en curso.
 * Cuenta los registros existentes con el prefijo del año y suma 1.
 * Dentro de una `$transaction` esto es suficiente porque el `INSERT`
 * posterior usa `folio @unique` — si dos requests concurrentes intentan
 * el mismo número, uno fallará y el caller debe reintentar.
 */
export async function nextArcoFolio(
  db: Prisma.TransactionClient,
  year = new Date().getFullYear(),
): Promise<string> {
  const prefix = `ARCO-${year}-`;
  const count = await db.arcoRequest.count({
    where: { folio: { startsWith: prefix } },
  });
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}${seq}`;
}
