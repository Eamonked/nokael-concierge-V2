-- ==========================================
-- LOCK DOWN drivers.pin_hash
-- ==========================================
-- Run in the Supabase SQL editor against hhgzxpuzsbqirmbsiltn.
-- Not destructive (adds one generated column, changes grants only).
--
-- Problem: the dashboard read drivers with select('*'), so every org
-- member's browser received drivers.pin_hash -- a bcrypt hash of a 4-6
-- digit PIN. That keyspace (~1.1M) is small enough to brute-force
-- offline, so the hash effectively exposed each driver's app password.
--
-- Fix:
--   1. has_pin: a generated boolean the dashboard can read instead of
--      the hash ("PIN set" in the driver drawer's sign-in readiness box).
--   2. anon/authenticated lose the table-level SELECT/INSERT/UPDATE
--      grants and get per-column grants instead. A column-level REVOKE
--      does nothing while a table-level grant exists, so the table grant
--      has to be replaced rather than narrowed.
--        SELECT  -- every column except pin_hash
--        INSERT/UPDATE -- every column except pin_hash, pin_failed_attempts,
--                  pin_locked_until (only the PIN RPCs manage these) and
--                  has_pin (generated, can't be written anyway)
--      DELETE/REFERENCES/TRIGGER/TRUNCATE are left as they were.
--   3. driver_login, verify_driver_pin, set_driver_pin,
--      create_driver_session and get_driver_id_by_phone are SECURITY
--      DEFINER owned by postgres, so they still read/write pin_hash.
--      service_role keeps its full table grant.
--
-- Realtime: drivers is in supabase_realtime and dispatch_realtime.
-- Supabase Realtime drops columns the subscribing role can't SELECT, so
-- postgres_changes payloads stop carrying pin_hash too.
--
-- NOTE: columns added to drivers later are NOT automatically readable or
-- writable by anon/authenticated -- add a GRANT SELECT (col) / INSERT /
-- UPDATE for them in the same migration that adds them.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS has_pin boolean
  GENERATED ALWAYS AS (pin_hash IS NOT NULL) STORED;

REVOKE SELECT, INSERT, UPDATE ON public.drivers FROM anon, authenticated;

DO $$
DECLARE
  read_cols  text;
  write_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO read_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'drivers'
     AND column_name <> 'pin_hash';

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO write_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'drivers'
     AND column_name NOT IN ('pin_hash', 'pin_failed_attempts', 'pin_locked_until', 'has_pin');

  EXECUTE format('GRANT SELECT (%s) ON public.drivers TO anon, authenticated', read_cols);
  EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON public.drivers TO anon, authenticated', write_cols, write_cols);
END $$;

-- Grants on individual columns may already exist from Supabase's defaults
-- (they were shadowed by the table grant); make sure pin_hash has none.
REVOKE SELECT (pin_hash), INSERT (pin_hash), UPDATE (pin_hash)
  ON public.drivers FROM anon, authenticated;
REVOKE INSERT (pin_failed_attempts, pin_locked_until),
       UPDATE (pin_failed_attempts, pin_locked_until)
  ON public.drivers FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify (expect false, true, true):
--   SELECT has_column_privilege('authenticated', 'public.drivers', 'pin_hash', 'SELECT'),
--          has_column_privilege('authenticated', 'public.drivers', 'has_pin',  'SELECT'),
--          has_column_privilege('authenticated', 'public.drivers', 'full_name','UPDATE');
