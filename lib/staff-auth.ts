import bcrypt from "bcryptjs";

/**
 * Hashing de PINs de Staff (sistema de Comandas).
 *
 * El PIN es de 4 dígitos. Se hashea con bcrypt cost 8 (rápido para logins
 * frecuentes en piso, suficientemente seguro). NUNCA se almacena plano.
 *
 * Realm separado de `lib/auth.ts` (que usa scrypt para passwords de `User`).
 */

const PIN_COST = 8;
export const PIN_LENGTH = 4;

/** Valida que el PIN sea exactamente 4 dígitos numéricos. */
export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Hashea un PIN de 4 dígitos con bcrypt cost 8. */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PIN_COST);
}

/** Verifica un PIN contra su hash bcrypt. */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!pin || !hash) return false;
  return bcrypt.compare(pin, hash);
}

/** Genera un PIN aleatorio de 4 dígitos (string con ceros a la izquierda). */
export function generatePin(): string {
  const n = Math.floor(Math.random() * 10 ** PIN_LENGTH);
  return String(n).padStart(PIN_LENGTH, "0");
}
