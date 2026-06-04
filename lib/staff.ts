import { prisma } from "./prisma";
import { hashPin, verifyPin, generatePin } from "./staff-auth";

/**
 * Lógica de negocio compartida para Staff (sistema de Comandas).
 * Usa el cliente admin `prisma` (BYPASSRLS): el modelo Staff todavía no
 * tiene policies de RLS y vive en un realm de auth aparte de `User`.
 *
 * Regla de negocio (plan Fase 0): los PINs son únicos POR TENANT. Como se
 * hashean con bcrypt (salt por hash), la unicidad no se puede imponer con un
 * índice — se valida al setear comparando contra los hashes activos del tenant.
 */

const DEFAULT_TENANT = 1;
const MAX_PIN_ATTEMPTS = 50;

/** ¿El PIN ya está en uso por otro empleado activo del mismo tenant? */
export async function pinTakenInTenant(
  pin: string,
  opts: { tenantId?: number; excludeStaffId?: number } = {}
): Promise<boolean> {
  const tenantId = opts.tenantId ?? DEFAULT_TENANT;
  const others = await prisma.staff.findMany({
    where: {
      tenantId,
      active: true,
      ...(opts.excludeStaffId ? { id: { not: opts.excludeStaffId } } : {}),
    },
    select: { pinHash: true },
  });
  for (const s of others) {
    if (await verifyPin(pin, s.pinHash)) return true;
  }
  return false;
}

/** Genera un PIN de 4 dígitos único dentro del tenant. */
export async function generateUniquePin(
  opts: { tenantId?: number; excludeStaffId?: number } = {}
): Promise<string> {
  for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
    const pin = generatePin();
    if (!(await pinTakenInTenant(pin, opts))) return pin;
  }
  throw new Error("No se pudo generar un PIN único (demasiados empleados activos)");
}

/**
 * Resuelve el PIN a usar: si viene uno explícito valida que no choque; si no,
 * genera uno único. Devuelve { pin, hash } — el `pin` plano se muestra UNA vez.
 */
export async function resolvePin(
  desired: string | undefined,
  opts: { tenantId?: number; excludeStaffId?: number } = {}
): Promise<{ pin: string; hash: string }> {
  let pin = desired;
  if (pin) {
    if (await pinTakenInTenant(pin, opts)) {
      throw new PinConflictError();
    }
  } else {
    pin = await generateUniquePin(opts);
  }
  return { pin, hash: await hashPin(pin) };
}

/** Error tipado para PIN duplicado → el API lo mapea a 409. */
export class PinConflictError extends Error {
  constructor() {
    super("PIN_TAKEN");
    this.name = "PinConflictError";
  }
}
