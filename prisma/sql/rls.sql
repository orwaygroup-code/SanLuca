-- ============================================================================
-- Row Level Security — SanLuca
-- Idempotente: re-ejecutar es seguro. Aplica por deploy.sh tras `prisma db push`.
--
-- Modelo:
--   `sanluca_user` (BYPASSRLS) → migraciones, webhooks, scripts → bypass total.
--   `sanluca_app`              → app web. Las queries setean session vars:
--      SET LOCAL app.user_id = '<cuid>';
--      SET LOCAL app.role    = 'CUSTOMER' | 'HOSTES' | 'ADMIN' | 'anon';
-- ============================================================================

-- Garantizamos que el rol app exista (en caso de no haberse creado aún)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sanluca_app') THEN
    RAISE NOTICE 'Rol sanluca_app no existe — crearlo manualmente antes (ver doc VPS).';
  END IF;
END$$;

-- Helpers seguros: leen el setting sin error si no está definido.
CREATE OR REPLACE FUNCTION app_user_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'anon');
$$;

-- ============================================================================
-- USER
-- ============================================================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_self_read       ON "User";
DROP POLICY IF EXISTS user_self_update     ON "User";
DROP POLICY IF EXISTS user_anon_insert     ON "User";
DROP POLICY IF EXISTS user_staff_modify    ON "User";

CREATE POLICY user_self_read ON "User"
  FOR SELECT
  USING (id = app_user_id() OR app_role() IN ('HOSTES','ADMIN'));

CREATE POLICY user_self_update ON "User"
  FOR UPDATE
  USING      (id = app_user_id() OR app_role() = 'ADMIN')
  WITH CHECK (id = app_user_id() OR app_role() = 'ADMIN');

-- Staff puede crear usuarios (HOSTES creando guest, ADMIN cualquier cosa)
CREATE POLICY user_staff_modify ON "User"
  FOR INSERT
  WITH CHECK (app_role() IN ('HOSTES','ADMIN'));

-- ============================================================================
-- RESERVATION
-- ============================================================================
ALTER TABLE "Reservation" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS res_owner_read   ON "Reservation";
DROP POLICY IF EXISTS res_owner_insert ON "Reservation";
DROP POLICY IF EXISTS res_owner_update ON "Reservation";
DROP POLICY IF EXISTS res_staff_modify ON "Reservation";
DROP POLICY IF EXISTS res_staff_delete ON "Reservation";

CREATE POLICY res_owner_read ON "Reservation"
  FOR SELECT
  USING (
       "userId"      = app_user_id()
    OR "createdById" = app_user_id()
    OR app_role() IN ('HOSTES','ADMIN')
  );

CREATE POLICY res_owner_insert ON "Reservation"
  FOR INSERT
  WITH CHECK (
       "userId" = app_user_id()
    OR app_role() IN ('HOSTES','ADMIN')
  );

CREATE POLICY res_owner_update ON "Reservation"
  FOR UPDATE
  USING (
       "userId" = app_user_id()
    OR app_role() IN ('HOSTES','ADMIN')
  )
  WITH CHECK (
       "userId" = app_user_id()
    OR app_role() IN ('HOSTES','ADMIN')
  );

CREATE POLICY res_staff_delete ON "Reservation"
  FOR DELETE
  USING (app_role() = 'ADMIN');

-- ============================================================================
-- RESERVATION ITEM
-- ============================================================================
ALTER TABLE "ReservationItem" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resitem_via_reservation ON "ReservationItem";

CREATE POLICY resitem_via_reservation ON "ReservationItem"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Reservation" r
      WHERE r.id = "ReservationItem"."reservationId"
        AND (
             r."userId" = app_user_id()
          OR app_role() IN ('HOSTES','ADMIN')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Reservation" r
      WHERE r.id = "ReservationItem"."reservationId"
        AND (
             r."userId" = app_user_id()
          OR app_role() IN ('HOSTES','ADMIN')
        )
    )
  );

-- ============================================================================
-- PAYMENT
-- ============================================================================
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pay_self_or_admin ON "Payment";
DROP POLICY IF EXISTS pay_admin_modify  ON "Payment";

CREATE POLICY pay_self_or_admin ON "Payment"
  FOR SELECT
  USING (
       app_role() = 'ADMIN'
    OR "customerEmail" = (
         SELECT lower(u.email) FROM "User" u WHERE u.id = app_user_id()
       )
  );

CREATE POLICY pay_admin_modify ON "Payment"
  FOR ALL
  USING      (app_role() = 'ADMIN')
  WITH CHECK (app_role() = 'ADMIN');

-- ============================================================================
-- CREDIT
-- ============================================================================
ALTER TABLE "Credit" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cred_self_or_admin ON "Credit";
DROP POLICY IF EXISTS cred_admin_modify  ON "Credit";

CREATE POLICY cred_self_or_admin ON "Credit"
  FOR SELECT
  USING (
       app_role() = 'ADMIN'
    OR "customerEmail" = (
         SELECT lower(u.email) FROM "User" u WHERE u.id = app_user_id()
       )
  );

CREATE POLICY cred_admin_modify ON "Credit"
  FOR ALL
  USING      (app_role() = 'ADMIN')
  WITH CHECK (app_role() = 'ADMIN');

-- ============================================================================
-- TABLE BLOCK — solo staff
-- ============================================================================
ALTER TABLE "TableBlock" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tblock_staff ON "TableBlock";
CREATE POLICY tblock_staff ON "TableBlock"
  FOR ALL
  USING      (app_role() IN ('HOSTES','ADMIN'))
  WITH CHECK (app_role() IN ('HOSTES','ADMIN'));

-- ============================================================================
-- TABLAS PÚBLICAS — lectura para todos, escritura solo ADMIN
-- ============================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['MenuCategory','Dish','Section','Table','SpecialDate'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS public_read_%s ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS admin_write_%s ON %I', t, t);
    EXECUTE format('CREATE POLICY public_read_%s ON %I FOR SELECT USING (true)', t, t);
    EXECUTE format(
      'CREATE POLICY admin_write_%s ON %I FOR ALL USING (app_role() = ''ADMIN'') WITH CHECK (app_role() = ''ADMIN'')',
      t, t
    );
  END LOOP;
END$$;

-- ============================================================================
-- Permisos al rol sanluca_app (idempotente)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sanluca_app') THEN
    GRANT CONNECT ON DATABASE current_database() TO sanluca_app;
    EXECUTE 'GRANT USAGE ON SCHEMA public TO sanluca_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sanluca_app';
    EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO sanluca_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sanluca_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO sanluca_app';
  END IF;
END$$;
