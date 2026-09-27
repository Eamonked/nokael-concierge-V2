-- Driver contacts: store every phone/WhatsApp number in one format (+9715XXXXXXXX)
-- so the dashboard can build tap-to-call and wa.me links that always work.
--
-- Safe for driver-app sign-in: driver_phone_key() uses the last 9 digits, which
-- this normalisation never changes. drivers_unique_identity still re-runs and
-- writes the same keys.
--
-- No new columns. The contact list already lives in drivers:
--   availability  full-time / part-time / on-call  = Core / Flex / Surge
--   pipeline_status  Sourced ... Active             = how far vetted
--   tier A-D, internal_notes                        = quality + free notes

BEGIN;

-- 1. Normaliser. UAE formats become +971; anything else is left untouched
--    (never destroy a number we don't understand).
CREATE OR REPLACE FUNCTION public.normalize_uae_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  WITH d AS (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS digits)
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' THEN p
    WHEN digits ~ '^00'                        THEN '+' || substr(digits, 3)
    WHEN digits ~ '^971[0-9]{8,9}$'            THEN '+' || digits
    WHEN digits ~ '^0[0-9]{8,9}$'              THEN '+971' || substr(digits, 2)
    WHEN digits ~ '^5[0-9]{8}$'                THEN '+971' || digits
    WHEN btrim(p) LIKE '+%'                    THEN '+' || digits
    ELSE btrim(p)
  END
  FROM d;
$$;

-- 2. Apply on every insert/update from any path (dashboard, public intake
--    form, pool registration, driver app).
CREATE OR REPLACE FUNCTION public.drivers_normalize_phones()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.phone    := public.normalize_uae_phone(NEW.phone);
  NEW.whatsapp := public.normalize_uae_phone(coalesce(nullif(btrim(NEW.whatsapp), ''), NEW.phone));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drivers_normalize_phones ON public.drivers;
CREATE TRIGGER drivers_normalize_phones
  BEFORE INSERT OR UPDATE OF phone, whatsapp ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.drivers_normalize_phones();

-- 3. Backfill existing rows (currently one driver stored as 05...).
UPDATE public.drivers
SET phone = public.normalize_uae_phone(phone),
    whatsapp = public.normalize_uae_phone(whatsapp)
WHERE phone IS DISTINCT FROM public.normalize_uae_phone(phone)
   OR whatsapp IS DISTINCT FROM public.normalize_uae_phone(whatsapp);

-- 4. pipeline_status is free text today. Pin it to the values the dashboard
--    and the Standby filter depend on (matches PipelineStatus in lib/supabase.ts).
ALTER TABLE public.drivers
  DROP CONSTRAINT IF EXISTS drivers_pipeline_status_check;
ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_pipeline_status_check
  CHECK (pipeline_status IN ('Sourced','Screening','Docs Pending','Trial Scheduled','Active','Rejected'));

COMMIT;

-- Verify:
--   SELECT full_name, phone, whatsapp, public.driver_phone_key(phone) FROM drivers;
