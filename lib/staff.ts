import { prisma } from "./prisma";
import { hashPin, verifyPin, generatePin } from "./staff-auth";

/**
 * Lógica de negocio compartida para Staff (sistema de Comandas).
 * Usa el cliente admin `prisma` (BYPASSRLS): el modelo Staff todavía no
 * tiene policies de RLS y vive en un realm de auth aparte de `User`.
 *
 * Regla de negocio (plan Fase 0): los PINs son únicos POR TENANT. Como se
 * hashean con bcrypt (salt por hash), la unicidad no se puede imponer con un
 * índice — se valida al setear comparando contra los hashes del tenant. Se
 * incluyen empleados INACTIVOS en la comparación: si un ex-empleado se
 * reactiva, su PIN no debe colisionar con uno asignado entretanto.
 */

const DEFAULT_TENANT = 1;
const MAX_PIN_ATTEMPTS = 50;

/** ¿El PIN ya está en uso por otro empleado del mismo tenant (activo o inactivo)? */
export async function pinTakenInTenant(
  pin: string,
  opts: { tenantId?: number; excludeStaffId?: number } = {}
): Promise<boolean> {
  const tenantId = opts.tenantId ?? DEFAULT_TENANT;
  const others = await prisma.staff.findMany({
    where: {
      tenantId,
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

/**
 * Override de supervisor: devuelve el `staffId` de un CAPTAIN/MANAGER activo del
 * tenant cuyo PIN coincide, o null. Autoriza acciones sensibles de caja
 * (descuento, reabrir, merge, traspaso) SIN cambiar de sesión — el cajero
 * (OPERATION) inicia, un supervisor teclea su PIN en el modal. Reutiliza verifyPin.
 */
export async function verifySupervisorPin(
  pin: string,
  opts: { tenantId?: number } = {},
): Promise<number | null> {
  if (!/^\d{4}$/.test(pin)) return null;
  const tenantId = opts.tenantId ?? DEFAULT_TENANT;
  const supers = await prisma.staff.findMany({
    where: { tenantId, active: true, role: { in: ["CAPTAIN", "MANAGER"] } },
    select: { id: true, pinHash: true },
  });
  for (const s of supers) {
    if (await verifyPin(pin, s.pinHash)) return s.id;
  }
  return null;
}

/**
 * Verifica que `pin` pertenezca al empleado `staffId` (activo del tenant). Usado
 * para que un MESERO autorice SU propia liquidación de propina en caja (teclea su
 * PIN sin cambiar de sesión). Devuelve true/false; nunca revela de quién es el PIN.
 */
export async function verifyWaiterPin(
  staffId: number,
  pin: string,
  opts: { tenantId?: number } = {},
): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false;
  const tenantId = opts.tenantId ?? DEFAULT_TENANT;
  const s = await prisma.staff.findFirst({
    where: { id: staffId, tenantId, active: true },
    select: { pinHash: true },
  });
  if (!s) return false;
  return verifyPin(pin, s.pinHash);
}

/** Error tipado para PIN duplicado → el API lo mapea a 409. */
export class PinConflictError extends Error {
  constructor() {
    super("PIN_TAKEN");
    this.name = "PinConflictError";
  }
}
