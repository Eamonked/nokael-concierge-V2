-- ============================================================================
-- One phone number and one email per driver.
--
-- The driver app signs in with a phone/WhatsApp number or an email
-- (driver_login). It matches numbers on their LAST 9 DIGITS across BOTH the
-- phone and whatsapp columns, and refuses to sign anyone in when more than one
-- driver matches. So a shared number or email silently locks every driver who
-- has it out of the app. This makes the database refuse the duplicate instead,
-- whichever path creates or edits the driver (public intake form, Add Agent,
-- direct SQL).
--
--   Email: unique index on lower(btrim(email)); blank emails are allowed.
--   Phone: driver_phone_keys holds each driver's last-9-digit keys for phone and
--          whatsapp, one row per key, primary key on the key, so the same number
--          can't belong to two drivers even across the two columns. A trigger
--          keeps it in sync.
--
-- Errors (SQLSTATE 23505) carry a stable message the apps map to readable text:
--   driver_phone_taken, driver_email_taken
-- ============================================================================

-- ---- Email ----------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS drivers_email_unique
  ON public.drivers (lower(btrim(email)))
  WHERE btrim(coalesce(email, '')) <> '';

-- ---- Phone / WhatsApp -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_phone_key(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 9
    THEN right(regexp_replace(p, '\D', '', 'g'), 9)
  END;
$$;

CREATE TABLE IF NOT EXISTS public.driver_phone_keys (
  phone_key text PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS driver_phone_keys_driver_idx ON public.driver_phone_keys (driver_id);

-- Internal bookkeeping only: no client access at all.
ALTER TABLE public.driver_phone_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_phone_keys FROM anon, authenticated;

-- BEFORE trigger for email: it has to run before the unique index fires so the
-- caller gets driver_email_taken instead of the raw index error. The index is
-- still what guarantees uniqueness under concurrency.
CREATE OR REPLACE FUNCTION public.drivers_check_unique_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER            -- the anon intake insert can't see other drivers under RLS
SET search_path = public
AS $$
BEGIN
  IF btrim(coalesce(NEW.email, '')) <> ''
     AND (TG_OP = 'INSERT' OR lower(btrim(NEW.email)) IS DISTINCT FROM lower(btrim(OLD.email)))
     AND EXISTS (
       SELECT 1 FROM public.drivers d
       WHERE d.id <> NEW.id AND lower(btrim(d.email)) = lower(btrim(NEW.email))
     ) THEN
    RAISE EXCEPTION 'driver_email_taken' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.drivers_check_unique_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS drivers_unique_email ON public.drivers;
CREATE TRIGGER drivers_unique_email
  BEFORE INSERT OR UPDATE OF email ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.drivers_check_unique_email();

-- AFTER trigger for phone/whatsapp keys (see below).
CREATE OR REPLACE FUNCTION public.drivers_enforce_unique_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER            -- the anon intake insert can't see other drivers under RLS
SET search_path = public
AS $$
DECLARE
  v_keys text[];
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.phone IS NOT DISTINCT FROM OLD.phone
     AND NEW.whatsapp IS NOT DISTINCT FROM OLD.whatsapp THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT k) INTO v_keys
  FROM unnest(ARRAY[public.driver_phone_key(NEW.phone), public.driver_phone_key(NEW.whatsapp)]) AS k
  WHERE k IS NOT NULL;

  DELETE FROM public.driver_phone_keys WHERE driver_id = NEW.id;

  IF v_keys IS NOT NULL THEN
    BEGIN
      INSERT INTO public.driver_phone_keys (phone_key, driver_id)
      SELECT unnest(v_keys), NEW.id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'driver_phone_taken' USING ERRCODE = '23505';
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.drivers_enforce_unique_identity() FROM PUBLIC, anon, authenticated;

-- AFTER trigger: the drivers row exists by then (FK on driver_phone_keys), and a
-- raised error still rolls the whole insert/update back.
DROP TRIGGER IF EXISTS drivers_unique_identity ON public.drivers;
CREATE TRIGGER drivers_unique_identity
  AFTER INSERT OR UPDATE OF phone, whatsapp ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.drivers_enforce_unique_identity();

-- Backfill existing drivers (fails loudly if any two already share a number).
INSERT INTO public.driver_phone_keys (phone_key, driver_id)
SELECT DISTINCT k.key, d.id
FROM public.drivers d
CROSS JOIN LATERAL unnest(ARRAY[public.driver_phone_key(d.phone), public.driver_phone_key(d.whatsapp)]) AS k(key)
WHERE k.key IS NOT NULL;
