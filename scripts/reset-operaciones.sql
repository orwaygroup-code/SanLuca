-- ============================================================================
-- reset-operaciones.sql  ·  San Luca
-- Borra SOLO comandas y caja (tenant 1) para arrancar producción desde cero.
--
-- NO toca: reservas, clientes/CRM, meseros/usuarios, menú, secciones, mesas,
--          bloqueos de mesa ni configuración (IVA, punto %).
--
-- Correr UNA sola vez, en el VPS, DESPUÉS de haber hecho un pg_dump del
-- sanluca_db. Todo va dentro de una transacción: si algo falla, no borra nada.
-- ============================================================================

BEGIN;

-- 1) Pagos: nunca se borran en cascada y bloquean el borrado de comandas/cajas.
DELETE FROM "ComandaPayment"     WHERE "tenantId" = 1;

-- 2) Impresiones: incluye tickets con comandaId NULL (cajón, corte, propina)
--    que la cascada de Comanda no alcanzaría. También limpia la cola PENDING.
DELETE FROM "ComandaPrint"       WHERE "tenantId" = 1;

-- 3) Créditos y liquidaciones de propina de meseros (parte del flujo de caja).
DELETE FROM "WaiterCredit"        WHERE "tenantId" = 1;
DELETE FROM "WaiterTipSettlement" WHERE "tenantId" = 1;

-- 4) Comandas → cascada borra items, descuentos, eventos y demás hijos.
DELETE FROM "Comanda"             WHERE "tenantId" = 1;

-- 5) Sesiones de caja → cascada borra movimientos y el reparto de propinas a áreas.
DELETE FROM "CashSession"         WHERE "tenantId" = 1;

-- Verificación: TODO debe quedar en 0 antes de confirmar.
SELECT
  (SELECT count(*) FROM "Comanda")             AS comandas,
  (SELECT count(*) FROM "ComandaItem")         AS items,
  (SELECT count(*) FROM "ComandaPayment")      AS pagos,
  (SELECT count(*) FROM "ComandaPrint")        AS impresiones,
  (SELECT count(*) FROM "CashSession")         AS cajas,
  (SELECT count(*) FROM "CashMovement")        AS movimientos,
  (SELECT count(*) FROM "WaiterCredit")        AS creditos,
  (SELECT count(*) FROM "WaiterTipSettlement") AS liquidaciones;

-- Si los números de arriba son 0, la transacción confirma aquí.
COMMIT;

-- Cordura: lo que NO se tocó (deben seguir con datos).
SELECT
  (SELECT count(*) FROM "Reservation") AS reservas_intactas,
  (SELECT count(*) FROM "User")        AS clientes_intactos,
  (SELECT count(*) FROM "Staff")       AS meseros_intactos,
  (SELECT count(*) FROM "Table")       AS mesas_intactas;
