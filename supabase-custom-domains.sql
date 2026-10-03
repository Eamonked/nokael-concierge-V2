-- ==========================================
-- CUSTOM DOMAINS (companies' own booking domains)
-- ==========================================
-- Target: live project hhgzxpuzsbqirmbsiltn, after supabase-tenant-onboarding.sql.
--
-- A company can serve its public site (booking, tracking, driver sign-up)
-- on its own domain, e.g. book.acme.ug. Traffic reaches us through
-- Cloudflare for SaaS (Custom Hostnames); the app resolves the company from
-- the request's hostname via get_public_org_by_domain().
--
-- Columns are written only by the server (service role, routes/onboarding.ts),
-- which validates the name and registers it with Cloudflare. Additive only.

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS custom_domain text,
  -- pending   = saved, waiting for the company's DNS record / certificate
  -- active    = Cloudflare reports hostname + certificate active
  -- error     = Cloudflare rejected it (see custom_domain_error)
  ADD COLUMN IF NOT EXISTS custom_domain_status text,
  ADD COLUMN IF NOT EXISTS custom_domain_cf_id text,
  ADD COLUMN IF NOT EXISTS custom_domain_error text,
  ADD COLUMN IF NOT EXISTS custom_domain_checked_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_custom_domain_format') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_custom_domain_format
      CHECK (custom_domain IS NULL OR custom_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_custom_domain_status_check') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_custom_domain_status_check
      CHECK (custom_domain_status IS NULL OR custom_domain_status IN ('pending', 'active', 'error'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_custom_domain_key
  ON public.organizations (custom_domain) WHERE custom_domain IS NOT NULL;

-- Public profile now carries the domain, so links a company shares (booking
-- page, driver sign-up) can use it. Status is included so the app only uses a
-- domain once it actually serves traffic.
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
    'settings', coalesce(o.settings, '{}'::jsonb) - 'onboarding',
    'custom_domain', CASE WHEN o.custom_domain_status = 'active' THEN o.custom_domain END
  )
  FROM public.organizations o
  WHERE o.id = p_org AND coalesce(o.is_active, true);
$function$;

-- Resolve the company for a request's hostname. Pending domains resolve too,
-- so the company can check its site the moment DNS + certificate are live.
CREATE OR REPLACE FUNCTION public.get_public_org_by_domain(p_host text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public._org_public_profile(o.id)
  FROM public.organizations o
  WHERE o.custom_domain = lower(rtrim(btrim(split_part(p_host, ':', 1)), '.'))
    AND coalesce(o.is_active, true);
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_org_by_domain(text) TO anon, authenticated, service_role;

COMMIT;
