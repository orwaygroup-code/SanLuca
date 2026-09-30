import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/dualAuth";

/**
 * Guard de nómina: sesión ADMIN + `Staff` ligado con `payrollAccess: true`. Devuelve el
 * staffId del actor (para `createdById`) o null si no tiene acceso. Lo usan los 3 handlers
 * de `/api/admin/nomina`.
 *
 * Vive aquí y no en `app/api/admin/nomina/route.ts` porque Next 14 valida los exports de un
 * `route.ts`: cualquier export que no sea un handler o una de sus constantes reservadas
 * rompe `next build` con «is not a valid Route export field». `tsc --noEmit` NO lo detecta
 * (es una regla de Next, no de TypeScript), así que el error viajó hasta el primer build en
 * frío y tiró el sitio el 30 de septiembre.
 */
export async function requirePayroll(request: NextRequest): Promise<number | null> {
  const a = await requireAdminSession(request);
  if (!a || a.staffId == null) return null;
  const staff = await prisma.staff.findUnique({ where: { id: a.staffId }, select: { payrollAccess: true } });
  return staff?.payrollAccess ? a.staffId : null;
}
