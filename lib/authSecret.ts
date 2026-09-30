/**
 * Secreto ÚNICO para firmar/verificar todo lo firmado con HMAC del proyecto: la sesión de
 * `User` (`sl_session`, lib/session.ts), la de `Staff` (`sl_staff`, lib/staff-session.ts) y
 * el token de Google de un solo uso (lib/google-token.ts). Una sola fuente para que las tres
 * firmas usen el mismo valor y la guarda de producción viva en un solo lugar.
 *
 * El valor de desarrollo ("sanluca-dev-secret") NUNCA debe usarse en producción: está
 * publicado en el repo, así que firmar con él dejaría que cualquiera forje sesiones o el
 * token de Google (ADMIN incluido). Por eso el fail-fast: en producción, si falta
 * `AUTH_SECRET`, se aborta al importar este módulo.
 *
 * La excepción de `NEXT_PHASE` existe porque `next build` corre con `NODE_ENV=production` y
 * sin ella el build reventaría; la guarda solo aplica en runtime, no al compilar.
 */
export const AUTH_SECRET = process.env.AUTH_SECRET ?? "sanluca-dev-secret";

if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !process.env.AUTH_SECRET
) {
  throw new Error("AUTH_SECRET no está definido en producción.");
}
