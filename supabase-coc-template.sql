-- ==========================================
-- COC certificate template per company
-- ==========================================
-- The Chain of Custody certificate (dashboard + coc portal) reads its
-- look and wording from organizations.settings.coc. This only lets org
-- admins save that key through update_org_profile. _org_public_profile
-- already returns settings, so the portal sees it with no further change.
-- Everything in it is printed on the certificate, so nothing here is private.

CREATE OR REPLACE FUNCTION public.update_org_profile(
  p_org uuid,
  p_name text DEFAULT NULL,
  p_settings jsonb DEFAULT NULL,
  p_branding jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_allowed_settings text[] := ARRAY['country','currency','timezone','locale','dial_code','region_label',
    'regions','tax_label','tax_rate','job_ref_prefix','map_center','languages','geofence','onboarding',
    'price_same_day','price_dedicated','coc'];
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

  IF v_settings ? 'coc' AND (
       jsonb_typeof(v_settings -> 'coc') <> 'object'
       OR length((v_settings -> 'coc')::text) > 8000) THEN
    RAISE EXCEPTION 'COC template must be an object under 8 KB';
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
-- Company logos (COC header, booking pages)
-- ==========================================
-- Public bucket so the logo loads from any site (dashboard on nokael.com,
-- client certificates on coc.nokael.com, company custom domains).
-- Files live under <organization_id>/…; only that company's owners and
-- admins can add or remove them. Raster images only — no SVG, which could
-- carry script on a public URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('org-logos', 'org-logos', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- First path segment as an org id, or NULL when it isn't a uuid.
CREATE OR REPLACE FUNCTION public._org_logo_owner(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE WHEN (storage.foldername(p_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN ((storage.foldername(p_name))[1])::uuid END;
$$;

DROP POLICY IF EXISTS org_logos_admin_insert ON storage.objects;
CREATE POLICY org_logos_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos' AND public.is_org_admin(public._org_logo_owner(name)));

DROP POLICY IF EXISTS org_logos_admin_delete ON storage.objects;
CREATE POLICY org_logos_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos' AND public.is_org_admin(public._org_logo_owner(name)));
