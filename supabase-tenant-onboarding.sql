-- ==========================================
-- TENANT ONBOARDING + MULTI-COUNTRY MIGRATION
-- ==========================================
-- Target: live project hhgzxpuzsbqirmbsiltn. Written against the live schema
-- as read on 2026-09-30 (functions copied from pg_get_functiondef, then edited).
--
-- What this does, in one line each:
--   1. Gives every organization a country profile in organizations.settings
--      (country, currency, timezone, locale, dial code, region list, tax,
--      job-ref prefix) and backfills Nokael's as the UAE profile it already is.
--   2. Adds jobs.currency (existing rows = 'AED'; new rows take the org's).
--   3. Makes phone normalisation, job refs, pickup-reminder times and the
--      "you're approved" driver push use the job's / driver's org, not the UAE.
--   4. Lets the public site resolve a tenant by slug (/c/<slug>/...) and lets
--      tracking/driver pages resolve the tenant from a job token.
--   5. Fills organization_id on staff inserts that forget it.
--   6. Lets an org owner/admin issue and revoke their own API keys.
--
-- Nothing here drops a table or a column, and Nokael's behaviour is unchanged:
-- its settings are the UAE values the code used to hardcode, and the phone
-- normaliser falls through to the exact old normalize_uae_phone for +971.
--
-- Naming note: the columns pickup_emirate / delivery_emirate / price_aed /
-- driver_payout_aed are kept as-is (≈30 live functions and three apps read
-- them). For non-UAE tenants they hold "region" and "amount in jobs.currency".
-- COMMENTs below record that so nobody reads price_aed as dirhams by accident.
--
-- organizations.settings and .branding are PUBLIC: get_public_org() returns
-- them to anonymous visitors. Never store secrets in either.

BEGIN;

-- ==========================================
-- 1. ORG COUNTRY PROFILE
-- ==========================================
-- Merge (defaults || existing) so any key already set — e.g. settings.geofence
-- used by the live map — wins over the default.
UPDATE public.organizations
SET settings = jsonb_build_object(
      'country', 'AE',
      'currency', 'AED',
      'timezone', 'Asia/Dubai',
      'locale', 'en-AE',
      'dial_code', '+971',
      'region_label', 'Emirate',
      'regions', jsonb_build_array('Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'),
      'tax_label', 'VAT',
      'tax_rate', 5,
      'job_ref_prefix', 'NOK',
      'map_center', jsonb_build_array(55.0, 25.0),
      'languages', jsonb_build_array('en', 'ar'),
      'onboarding', jsonb_build_object('completed_at', now())
    ) || coalesce(settings, '{}'::jsonb),
    branding = jsonb_build_object(
      'display_name', 'Nokael',
      'primary_color', '#00E08A',
      'support_phone', '+971509710446',
      'whatsapp', '971509710446'
    ) || coalesce(branding, '{}'::jsonb)
WHERE slug = 'nokael';

-- Slugs become URL segments (/c/<slug>) — keep them URL-safe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_slug_format') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_slug_format
      CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$');
  END IF;
END $$;

-- One setting as text, for triggers/functions. SECURITY DEFINER because the
-- callers include anon-fired triggers (public driver applications) and anon
-- cannot SELECT organizations under RLS.
CREATE OR REPLACE FUNCTION public.org_setting(p_org uuid, p_key text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT settings ->> p_key FROM public.organizations WHERE id = p_org;
$function$;

-- Public-safe view of one org (what an anonymous visitor may see).
CREATE OR REPLACE FUNCTION public._org_public_profile(p_org uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'branding', coalesce(o.branding, '{}'::jsonb),
    'settings', coalesce(o.settings, '{}'::jsonb) - 'onboarding'
  )
  FROM public.organizations o
  WHERE o.id = p_org AND coalesce(o.is_active, true);
$function$;

-- /c/<slug>/... on the public site.
CREATE OR REPLACE FUNCTION public.get_public_org(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public._org_public_profile(o.id)
  FROM public.organizations o
  WHERE o.slug = lower(btrim(p_slug)) AND coalesce(o.is_active, true);
$function$;

-- Tracking / confirmation / driver pages only hold a job token or ref.
CREATE OR REPLACE FUNCTION public.get_public_org_for_job(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public._org_public_profile(j.organization_id)
  FROM public.jobs j
  WHERE j.token_client_pickup::text   = p_token
     OR j.token_driver_pickup::text   = p_token
     OR j.token_driver_delivery::text = p_token
     OR j.token_client_delivery::text = p_token
     OR j.tracking_token              = p_token
     OR upper(j.job_ref)              = upper(btrim(p_token))
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.org_setting(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._org_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_setting(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_org(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_org_for_job(text) TO anon, authenticated, service_role;

-- Org admins edit their own profile. Only whitelisted keys; onboarding state
-- is merged, never replaced wholesale.
CREATE OR REPLACE FUNCTION public.update_org_profile(
  p_org uuid,
  p_name text DEFAULT NULL,
  p_settings jsonb DEFAULT NULL,
  p_branding jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed_settings text[] := ARRAY['country','currency','timezone','locale','dial_code','region_label',
    'regions','tax_label','tax_rate','job_ref_prefix','map_center','languages','geofence','onboarding',
    'price_same_day','price_dedicated'];
  v_allowed_branding text[] := ARRAY['display_name','logo_url','primary_color','support_phone','whatsapp',
    'support_email','website'];
  v_settings jsonb;
  v_branding jsonb;
BEGIN
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only owners and admins can edit the company profile' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_settings
  FROM jsonb_each(coalesce(p_settings, '{}'::jsonb)) WHERE key = ANY (v_allowed_settings);
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_branding
  FROM jsonb_each(coalesce(p_branding, '{}'::jsonb)) WHERE key = ANY (v_allowed_branding);

  IF v_settings ? 'job_ref_prefix'
     AND (v_settings ->> 'job_ref_prefix') !~ '^[A-Z0-9]{2,5}$' THEN
    RAISE EXCEPTION 'Job reference prefix must be 2–5 capital letters or digits';
  END IF;

  UPDATE public.organizations o
  SET name = coalesce(nullif(btrim(p_name), ''), o.name),
      settings = coalesce(o.settings, '{}'::jsonb)
        || (v_settings - 'onboarding')
        || CASE WHEN v_settings ? 'onboarding'
             THEN jsonb_build_object('onboarding',
                    coalesce(o.settings -> 'onboarding', '{}'::jsonb) || (v_settings -> 'onboarding'))
             ELSE '{}'::jsonb END,
      branding = coalesce(o.branding, '{}'::jsonb) || v_branding
  WHERE o.id = p_org;

  RETURN (SELECT jsonb_build_object('id', id, 'name', name, 'slug', slug, 'settings', settings, 'branding', branding)
          FROM public.organizations WHERE id = p_org);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_org_profile(uuid, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_org_profile(uuid, text, jsonb, jsonb) TO authenticated, service_role;

-- ==========================================
-- 2. JOB CURRENCY
-- ==========================================
-- ADD COLUMN ... DEFAULT fills existing rows without an UPDATE (so no job
-- triggers / pushes fire). The default is then dropped so the insert trigger
-- below can tell "not given" (NULL) from "given".
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS currency text DEFAULT 'AED';
ALTER TABLE public.jobs ALTER COLUMN currency DROP DEFAULT;

COMMENT ON COLUMN public.jobs.currency IS 'ISO 4217 code for price_aed / driver_payout_aed. Defaults from organizations.settings.currency.';
COMMENT ON COLUMN public.jobs.price_aed IS 'Client price in jobs.currency (legacy name — AED only for UAE tenants).';
COMMENT ON COLUMN public.jobs.driver_payout_aed IS 'Driver payout in jobs.currency (legacy name — AED only for UAE tenants).';
COMMENT ON COLUMN public.jobs.pickup_emirate IS 'Pickup region (emirate / state / city — see organizations.settings.region_label).';
COMMENT ON COLUMN public.jobs.delivery_emirate IS 'Delivery region (emirate / state / city — see organizations.settings.region_label).';

-- ==========================================
-- 3. ORG-AWARE DEFAULTS ON INSERT
-- ==========================================
-- Staff inserts that forget organization_id land in the caller's org (only
-- when they belong to exactly one, so it can never guess between two).
-- Anonymous inserts are left alone: the public forms always send the org of
-- the page they were filled on.
CREATE OR REPLACE FUNCTION public.fn_default_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.organization_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT CASE WHEN count(*) = 1 THEN min(organization_id::text)::uuid END INTO v_org
    FROM public.org_members WHERE user_id = auth.uid();
    NEW.organization_id := v_org;
  END IF;
  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['jobs','drivers','quote_requests','business_inquiries','business_contacts','driver_documents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS a0_default_org_id ON public.%I', t);
    -- "a0_" so it sorts (and so fires) before the other BEFORE triggers,
    -- which read organization_id.
    EXECUTE format('CREATE TRIGGER a0_default_org_id BEFORE INSERT ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.fn_default_org_id()', t);
  END LOOP;
END $$;

-- Job ref prefix + currency from the job's org. Body otherwise identical to
-- the live fn_set_job_ref.
CREATE OR REPLACE FUNCTION public.fn_set_job_ref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_ref text;
  v_prefix text;
BEGIN
  v_prefix := coalesce(nullif(public.org_setting(NEW.organization_id, 'job_ref_prefix'), ''), 'NOK');
  NEW.currency := coalesce(NEW.currency, nullif(public.org_setting(NEW.organization_id, 'currency'), ''), 'AED');

  -- Skip refs that already exist (e.g. NOK-0085, created out of sequence), so a
  -- collision can never block dispatch from creating a job.
  LOOP
    v_ref := v_prefix || '-' || LPAD(nextval('job_ref_seq')::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.jobs WHERE job_ref = v_ref);
  END LOOP;
  NEW.job_ref             := v_ref;
  NEW.otp_sender          := LPAD((FLOOR(RANDOM() * 1000000))::TEXT, 6, '0');
  NEW.otp_driver_pickup   := LPAD((FLOOR(RANDOM() * 1000000))::TEXT, 6, '0');
  NEW.otp_driver_delivery := LPAD((FLOOR(RANDOM() * 1000000))::TEXT, 6, '0');
  NEW.otp_recipient       := LPAD((FLOOR(RANDOM() * 1000000))::TEXT, 6, '0');
  RETURN NEW;
END;
$function$;

-- ==========================================
-- 4. PHONE NUMBERS PER COUNTRY
-- ==========================================
-- +971 (or no dial code) → the existing UAE rules, unchanged. Any other
-- country: 00… and +… are kept as international; a leading trunk 0 is
-- replaced by the country code; a bare national number gets the code added.
CREATE OR REPLACE FUNCTION public.normalize_phone(p text, p_dial text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_cc text := regexp_replace(coalesce(p_dial, ''), '\D', '', 'g');
  v_digits text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
BEGIN
  IF v_cc IN ('', '971') THEN
    RETURN public.normalize_uae_phone(p);
  END IF;
  IF p IS NULL OR btrim(p) = '' THEN RETURN p; END IF;
  IF v_digits ~ '^00' THEN RETURN '+' || substr(v_digits, 3); END IF;
  IF btrim(p) LIKE '+%' THEN RETURN '+' || v_digits; END IF;
  IF v_digits LIKE v_cc || '%' AND length(v_digits) >= length(v_cc) + 7 THEN RETURN '+' || v_digits; END IF;
  IF v_digits ~ '^0[0-9]{6,}$' THEN RETURN '+' || v_cc || substr(v_digits, 2); END IF;
  IF length(v_digits) BETWEEN 6 AND 12 THEN RETURN '+' || v_cc || v_digits; END IF;
  RETURN btrim(p);
END;
$function$;

-- Now SECURITY DEFINER: it runs on anonymous driver applications and needs
-- to read the org's dial code.
CREATE OR REPLACE FUNCTION public.drivers_normalize_phones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dial text := public.org_setting(NEW.organization_id, 'dial_code');
BEGIN
  NEW.phone    := public.normalize_phone(NEW.phone, v_dial);
  NEW.whatsapp := public.normalize_phone(coalesce(nullif(btrim(NEW.whatsapp), ''), NEW.phone), v_dial);
  RETURN NEW;
END;
$function$;

-- ==========================================
-- 5. ORG TIMEZONE / NAME IN PUSH MESSAGES
-- ==========================================
CREATE OR REPLACE FUNCTION public.push_queue_pickup_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  r record;
  n integer := 0;
begin
  for r in
    update public.jobs j
       set pickup_reminded_for = j.scheduled_pickup_at
     where j.driver_id is not null
       and j.scheduled_pickup_at between now() + interval '20 minutes' and now() + interval '35 minutes'
       and j.pickup_reminded_for is distinct from j.scheduled_pickup_at
       and j.driver_pickup_at is null
       and j.status not in ('completed', 'cancelled', 'returned')
    returning j.*
  loop
    perform public.push_enqueue('driver', r.organization_id, r.driver_id, null, r.id,
      'Pickup at ' || to_char(r.scheduled_pickup_at at time zone
        coalesce(nullif(public.org_setting(r.organization_id, 'timezone'), ''), 'Asia/Dubai'), 'HH24:MI'),
      coalesce(r.job_ref, left(r.id::text, 8)) || ' · ' || public._push_place(r.pickup_location) || ' in about 30 minutes.',
      '/driver-app/', 'job:' || r.id || ':reminder');
    n := n + 1;
  end loop;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public._push_on_driver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    perform public.push_enqueue('staff', new.organization_id, null, null, null,
      'New driver application', coalesce(nullif(btrim(new.full_name), ''), 'A driver') || ' applied to drive.', '/dashboard', 'driver:' || new.id);
  elsif new.onboarding_status = 'approved' and old.onboarding_status is distinct from 'approved' then
    perform public.push_enqueue('driver', new.organization_id, new.id, null, null,
      'You''re approved',
      'Your ' || coalesce((select coalesce(nullif(o.branding ->> 'display_name', ''), o.name)
                           from public.organizations o where o.id = new.organization_id), 'Nokael')
        || ' driver account is approved. You can now take jobs.',
      '/driver-app/', 'approved:' || new.id);
  end if;
  return null;
end $function$;

-- The driver app learns its org's currency / timezone / name at sign-in.
-- Additive: the existing 'ok' and 'driver' keys are unchanged.
CREATE OR REPLACE FUNCTION public.driver_me(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_driver uuid := public._driver_from_session(p_token);
begin
  return (
    select jsonb_build_object(
      'ok', true,
      'driver', jsonb_build_object(
        'id', d.id,
        'full_name', d.full_name,
        'phone', d.phone,
        'email', d.email
      ),
      'org', public._org_public_profile(d.organization_id)
    )
    from public.drivers d
    where d.id = v_driver
  );
end;
$function$;

-- The client portal (business customers) learns its delivery company the
-- same way. client_me returns a TABLE, so this is a separate function
-- rather than a changed signature.
CREATE OR REPLACE FUNCTION public.client_org()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public._org_public_profile(m.organization_id)
  FROM public.client_members m
  WHERE m.user_id = auth.uid()
  ORDER BY m.created_at
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.client_org() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_org() TO authenticated;

-- ==========================================
-- 6. SELF-SERVE API KEYS
-- ==========================================
-- The plaintext key is returned exactly once; only the bcrypt hash is stored
-- (verify_api_key already checks crypt(p_key, key_hash)).
CREATE OR REPLACE FUNCTION public.issue_api_key(p_org uuid, p_label text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_key text := 'nk_live_' || encode(gen_random_bytes(24), 'hex');
  v_id uuid;
BEGIN
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only owners and admins can create API keys' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.api_keys (organization_id, key_hash, label)
  VALUES (p_org, crypt(v_key, gen_salt('bf')), nullif(btrim(coalesce(p_label, '')), ''))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'key', v_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.api_keys SET revoked_at = now()
  WHERE id = p_key_id AND revoked_at IS NULL AND public.is_org_admin(organization_id);
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_api_key(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_api_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_api_key(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO authenticated;

COMMIT;
