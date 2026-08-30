-- ==========================================
-- MULTI-TENANT PLATFORM MIGRATION (CORRECTED)
-- ==========================================
-- Rewritten against the ACTUAL live schema on the "dubai-concierge"
-- Supabase project (ref: hhgzxpuzsbqirmbsiltn), verified 2026-08-30.
-- The original supabase-multitenant.sql was written against a stale/
-- assumed schema (wrong enum names, wrong policy names, wrong
-- get_job_by_token signature) and would have partially failed and
-- partially succeeded-but-done-nothing if run as-is. See notes inline.
--
-- Safe to run top-to-bottom in the Supabase SQL editor against
-- hhgzxpuzsbqirmbsiltn. Nothing here is destructive: no DROP TABLE,
-- no data loss, organization_id stays nullable until you explicitly
-- tighten it later.

-- ==========================================
-- 1. ORGANIZATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT DEFAULT 'internal' CHECK (plan IN ('internal', 'trial', 'standard', 'enterprise')),
    is_active BOOLEAN DEFAULT TRUE,
    branding JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'operator' CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can see their own memberships" ON public.org_members;
CREATE POLICY "Members can see their own memberships" ON public.org_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.org_members
        WHERE organization_id = org_id AND user_id = auth.uid()
    );
$$;

-- Seed tenant zero (your own courier business).
INSERT INTO public.organizations (name, slug, plan)
VALUES ('Nokael', 'nokael', 'internal')
ON CONFLICT (slug) DO NOTHING;

-- ==========================================
-- 2. API KEYS (for external tenant integrations)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members manage their own api keys" ON public.api_keys;
CREATE POLICY "Org members manage their own api keys" ON public.api_keys
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));

-- ==========================================
-- 3. ADD organization_id TO EXISTING TABLES
-- ==========================================
-- (all five tables confirmed to exist live, matching Nokael-Confirmation-Portal's schema)
ALTER TABLE public.quote_requests    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.business_inquiries ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.drivers           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.driver_documents  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.jobs              ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

DO $$
DECLARE
    tenant_zero UUID;
BEGIN
    SELECT id INTO tenant_zero FROM public.organizations WHERE slug = 'nokael';

    UPDATE public.quote_requests    SET organization_id = tenant_zero WHERE organization_id IS NULL;
    UPDATE public.business_inquiries SET organization_id = tenant_zero WHERE organization_id IS NULL;
    UPDATE public.drivers           SET organization_id = tenant_zero WHERE organization_id IS NULL;
    UPDATE public.driver_documents  SET organization_id = tenant_zero WHERE organization_id IS NULL;
    UPDATE public.jobs              SET organization_id = tenant_zero WHERE organization_id IS NULL;
END $$;

-- Left nullable on purpose — tighten to NOT NULL once every write path
-- (frontend + any RPCs) is confirmed to always pass organization_id:
-- ALTER TABLE public.quote_requests ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE public.jobs           ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE public.drivers        ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_requests_org ON public.quote_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org           ON public.jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_drivers_org        ON public.drivers(organization_id);

-- ==========================================
-- 4. REPLACE RLS POLICIES: SCOPE TO ORG MEMBERSHIP
-- ==========================================
-- IMPORTANT: these DROP the REAL policy names confirmed live via
-- pg_policies, not the placeholder names from the original migration
-- draft. Dropping the wrong names would silently no-op and leave the
-- old USING(true) policies in force alongside the new org-scoped ones
-- -- since RLS policies are OR'd, that would mean NO ISOLATION at all
-- even though the migration "succeeded". This is the one part of the
-- original script that would have failed to do its actual job.

-- quote_requests
DROP POLICY IF EXISTS "ops_quote_requests_all" ON public.quote_requests;
CREATE POLICY "org_members_manage_quote_requests" ON public.quote_requests
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));
-- "form_quote_requests_insert" (anon insert for the public quote form) is untouched.

-- business_inquiries
DROP POLICY IF EXISTS "ops_business_inquiries_all" ON public.business_inquiries;
CREATE POLICY "org_members_manage_business_inquiries" ON public.business_inquiries
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));
-- "form_business_inquiries_insert" (anon insert) is untouched.

-- drivers
DROP POLICY IF EXISTS "ops_drivers_all" ON public.drivers;
DROP POLICY IF EXISTS "Allow authenticated full access for drivers" ON public.drivers;
CREATE POLICY "org_members_manage_drivers" ON public.drivers
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));
-- "Allow public insert for drivers" (anon driver application form) is untouched.
-- NOTE (not changed here): "drivers_operators_all" still exists — it grants
-- full access to ANY user whose auth.users.raw_user_meta_data->>'role' =
-- 'operator', with no org check at all. With only tenant zero live today
-- that's harmless, but the day a second org exists, any 'operator'-tagged
-- user from either org can see both orgs' drivers through this policy.
-- Worth revisiting before onboarding a real second tenant — flagging now
-- rather than changing it silently since I don't know what currently
-- relies on that role flag.

-- driver_documents
DROP POLICY IF EXISTS "ops_driver_documents_all" ON public.driver_documents;
DROP POLICY IF EXISTS "Allow authenticated full access for driver_documents" ON public.driver_documents;
CREATE POLICY "org_members_manage_driver_documents" ON public.driver_documents
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));
-- "Allow public insert for driver_documents" (anon upload during application) is untouched.

-- jobs
DROP POLICY IF EXISTS "Authenticated operators full access to jobs" ON public.jobs;
CREATE POLICY "org_members_manage_jobs" ON public.jobs
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));

-- ==========================================
-- 5. TENANT-AWARE RPCs
-- ==========================================
-- get_job_by_token / update_job_by_token / confirm_job_step are already
-- token-scoped (a caller with a valid token for job X can only ever touch
-- job X), so org isolation for those three is automatic and they are NOT
-- touched here. The original draft tried to CREATE OR REPLACE
-- get_job_by_token with a UUID argument -- the live function takes TEXT,
-- so that would have just created an unused, confusing second overload.
-- Left out entirely.

-- New: list jobs for the calling user's org — lets a tenant dashboard
-- avoid needing raw SELECT on public.jobs.
CREATE OR REPLACE FUNCTION public.list_org_jobs(
    org_id UUID,
    status_filter job_status DEFAULT NULL,
    limit_val INT DEFAULT 50,
    offset_val INT DEFAULT 0
)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_org_member(org_id) THEN
        RAISE EXCEPTION 'Not a member of this organization';
    END IF;

    RETURN QUERY
    SELECT * FROM public.jobs
    WHERE organization_id = org_id
      AND (status_filter IS NULL OR status = status_filter)
    ORDER BY created_at DESC
    LIMIT limit_val OFFSET offset_val;
END;
$$;

-- New: create a job on behalf of an org via API key rather than a logged-in
-- session. Types corrected to match the LIVE enums (item_type /
-- urgency_level), not the item_type_enum / urgency_enum names from the
-- original draft (those don't exist and would have errored). As before,
-- key verification (hash lookup in api_keys, not-revoked check) stays in
-- the application layer -- this function trusts whatever org_id it's given.
CREATE OR REPLACE FUNCTION public.create_job_for_org(
    org_id UUID,
    p_sender_name TEXT,
    p_sender_phone TEXT,
    p_recipient_name TEXT,
    p_recipient_phone TEXT,
    p_pickup_emirate TEXT,
    p_pickup_location TEXT,
    p_delivery_emirate TEXT,
    p_delivery_location TEXT,
    p_item_type item_type,
    p_urgency urgency_level,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_job public.jobs;
BEGIN
    INSERT INTO public.jobs (
        organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
        pickup_emirate, pickup_location, delivery_emirate, delivery_location,
        item_type, urgency, operator_notes, source
    ) VALUES (
        org_id, p_sender_name, p_sender_phone, p_recipient_name, p_recipient_phone,
        p_pickup_emirate, p_pickup_location, p_delivery_emirate, p_delivery_location,
        p_item_type, p_urgency, p_notes, 'form'
    )
    RETURNING * INTO new_job;
    -- job_ref, tokens, and status all populate via existing defaults/triggers
    -- (fn_set_job_ref, gen_random_uuid() defaults) -- no need to set them here.

    RETURN jsonb_build_object(
        'success', true,
        'job_ref', new_job.job_ref,
        'tracking_tokens', jsonb_build_object(
            'client_pickup', new_job.token_client_pickup,
            'driver_pickup', new_job.token_driver_pickup,
            'driver_delivery', new_job.token_driver_delivery,
            'client_delivery', new_job.token_client_delivery
        )
    );
END;
$$;

-- ==========================================
-- 6. DRIVER-POOL MATCHING
-- ==========================================
-- get_available_drivers(emirate_filter) ALREADY EXISTS live and is
-- functionally the matching primitive the driver-pool plan called for.
-- Rather than write a new function from scratch, this adds org
-- scoping as a new trailing parameter (safe: CREATE OR REPLACE FUNCTION
-- allows appending parameters that have defaults, so every existing
-- caller that doesn't pass org_id keeps working unchanged -- passing
-- NULL preserves today's un-scoped behavior).
CREATE OR REPLACE FUNCTION public.get_available_drivers(
    emirate_filter TEXT DEFAULT NULL,
    org_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID, full_name TEXT, phone TEXT, vehicle_type TEXT, vehicle_plate TEXT,
    rating NUMERIC, jobs_completed INT, areas_covered TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id, d.full_name, d.phone, d.vehicle_type, d.vehicle_plate,
        d.rating, d.jobs_completed, d.areas_covered
    FROM public.drivers d
    WHERE d.active = true
      AND d.status = 'available'
      AND (emirate_filter IS NULL OR emirate_filter = ANY(d.areas_covered))
      AND (org_id IS NULL OR d.organization_id = org_id)
    ORDER BY d.rating DESC, d.jobs_completed DESC;
END;
$$;

-- New: the actual "matching API" a tenant's backend calls -- returns the
-- best available driver from THAT ORG'S OWN driver pool for a given
-- emirate, or NULL if none. Deliberately does NOT assign the driver to a
-- job itself (no jobs.driver_id write here) -- assignment stays wherever
-- job-assignment already happens today, so the existing driver-status
-- sync triggers (sync_driver_status_from_job / update_driver_status_on_job)
-- keep being the single source of truth for "driver went on_job". This
-- function only answers "who's free right now."
CREATE OR REPLACE FUNCTION public.match_driver_for_org(
    org_id UUID,
    p_emirate TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID, full_name TEXT, phone TEXT, vehicle_type TEXT, vehicle_plate TEXT,
    rating NUMERIC, jobs_completed INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT d.id, d.full_name, d.phone, d.vehicle_type, d.vehicle_plate, d.rating, d.jobs_completed
    FROM public.drivers d
    WHERE d.active = true
      AND d.status = 'available'
      AND d.organization_id = org_id
      AND (p_emirate IS NULL OR p_emirate = ANY(d.areas_covered))
    ORDER BY d.rating DESC, d.jobs_completed DESC
    LIMIT 1;
$$;

-- ==========================================
-- 7. NOTES / NOT DONE HERE (deliberately out of scope)
-- ==========================================
-- - drivers_operators_all and job_ratings_operators_all (role-metadata-based
--   policies, no org check) are left as-is -- flagged in section 4, not fixed,
--   since fixing them isn't needed to prove the Nokael-calls-its-own-pool
--   integration and I don't know what currently depends on that role flag.
-- - sync_driver_status_from_job and update_driver_status_on_job appear to
--   duplicate each other (both flip a driver to on_job/available around job
--   status changes). Not touched -- worth a look later, but changing trigger
--   behavior isn't part of this migration and risks breaking something that
--   currently works.
-- - Once Nokael's own backend is actually calling create_job_for_org /
--   match_driver_for_org with a real api_keys row instead of a service-role
--   key, uncomment the NOT NULL tightening in section 3.
