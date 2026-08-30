-- ==========================================
-- MULTI-TENANT PLATFORM MIGRATION
-- ==========================================
-- Adds an organizations layer on top of the existing single-tenant
-- schema (quote_requests, jobs, drivers, driver_documents,
-- business_inquiries) without touching the custody-chain logic
-- itself. Your existing courier business becomes "tenant zero";
-- every table and RPC below is additive and backward compatible.
--
-- Run this AFTER supabase.sql and supabase-jobs.sql are already applied.

-- ==========================================
-- 1. ORGANIZATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,            -- e.g. 'nokael', used in URLs/subdomains
    plan TEXT DEFAULT 'internal' CHECK (plan IN ('internal', 'trial', 'standard', 'enterprise')),
    is_active BOOLEAN DEFAULT TRUE,
    branding JSONB DEFAULT '{}'::jsonb,   -- logo url, colors, custom domain, etc.
    settings JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Org members map Supabase auth users -> organizations with a role.
-- This is what lets RLS scope "authenticated" access down to "authenticated
-- AND belongs to this org" instead of "any authenticated user sees everything".
CREATE TABLE IF NOT EXISTS public.org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'operator' CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see their own memberships" ON public.org_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Helper: does the current authenticated user belong to org X?
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

-- Seed tenant zero (your own courier business). Adjust the slug/name.
INSERT INTO public.organizations (name, slug, plan)
VALUES ('Nokael', 'nokael', 'internal')
ON CONFLICT (slug) DO NOTHING;

-- ==========================================
-- 2. API KEYS (for external tenant integrations)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,          -- store a hash, never the raw key
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage their own api keys" ON public.api_keys
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));

-- ==========================================
-- 3. ADD organization_id TO EXISTING TABLES
-- ==========================================
ALTER TABLE public.quote_requests
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.business_inquiries
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.drivers
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.driver_documents
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Backfill all existing rows to tenant zero.
DO $$
DECLARE
    tenant_zero UUID;
BEGIN
    SELECT id INTO tenant_zero FROM public.organizations WHERE slug = 'nokael';

    UPDATE public.quote_requests SET organization_id = tenant_zero WHERE organization_id IS NULL;
    UPDATE public.business_inquiries SET organization_id = tenant_zero WHERE organization_id IS NULL;
    UPDATE public.drivers SET organization_id = tenant_zero WHERE organization_id IS NULL;
    UPDATE public.driver_documents SET organization_id = tenant_zero WHERE organization_id IS NULL;
    UPDATE public.jobs SET organization_id = tenant_zero WHERE organization_id IS NULL;
END $$;

-- Once backfilled and the app is passing organization_id on writes, tighten
-- these to NOT NULL (left nullable here so this migration is non-breaking
-- against code that hasn't been updated yet):
-- ALTER TABLE public.quote_requests ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE public.jobs ALTER COLUMN organization_id SET NOT NULL;
-- ALTER TABLE public.drivers ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_requests_org ON public.quote_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON public.jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_drivers_org ON public.drivers(organization_id);

-- ==========================================
-- 4. REPLACE RLS POLICIES: SCOPE TO ORG MEMBERSHIP
-- ==========================================

-- quote_requests
DROP POLICY IF EXISTS "Enable read for authenticated users only" ON public.quote_requests;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.quote_requests;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.quote_requests;
DROP POLICY IF EXISTS "Allow authenticated select" ON public.quote_requests;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.quote_requests;

CREATE POLICY "Org members read their quote_requests" ON public.quote_requests
    FOR SELECT TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Org members update their quote_requests" ON public.quote_requests
    FOR UPDATE TO authenticated
    USING (public.is_org_member(organization_id));

CREATE POLICY "Org members delete their quote_requests" ON public.quote_requests
    FOR DELETE TO authenticated
    USING (public.is_org_member(organization_id));
-- "Enable insert for all users" / "Allow public insert" stays as-is —
-- public quote forms still need unauthenticated insert.

-- jobs
DROP POLICY IF EXISTS "Full access for authenticated operators" ON public.jobs;

CREATE POLICY "Org members manage their jobs" ON public.jobs
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));

-- drivers
DROP POLICY IF EXISTS "Allow authenticated full access for drivers" ON public.drivers;

CREATE POLICY "Org members manage their drivers" ON public.drivers
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));

-- driver_documents
DROP POLICY IF EXISTS "Allow authenticated full access for driver_documents" ON public.driver_documents;

CREATE POLICY "Org members manage their driver_documents" ON public.driver_documents
    FOR ALL TO authenticated
    USING (public.is_org_member(organization_id))
    WITH CHECK (public.is_org_member(organization_id));

-- business_inquiries
DROP POLICY IF EXISTS "Allow authenticated read for business_inquiries" ON public.business_inquiries;

CREATE POLICY "Org members read their business_inquiries" ON public.business_inquiries
    FOR SELECT TO authenticated
    USING (public.is_org_member(organization_id));

-- ==========================================
-- 5. TENANT-AWARE VERSIONS OF THE CUSTODY RPCs
-- ==========================================
-- get_job_by_token and confirm_job_step are token-scoped already, so a
-- client presenting a valid token for job X can only ever touch job X —
-- org isolation for these two specifically comes for free from the token
-- design. We extend get_job_by_token to also return organization_id so a
-- tenant's own dashboard/webhook consumer can route the payload correctly,
-- and add an org-scoped RPC for authenticated dashboard use (listing jobs
-- without needing direct table SELECT).

CREATE OR REPLACE FUNCTION public.get_job_by_token(token_val UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_record RECORD;
BEGIN
    SELECT * INTO job_record
    FROM public.jobs
    WHERE token_client_pickup = token_val
       OR token_driver_pickup = token_val
       OR token_driver_delivery = token_val
       OR token_client_delivery = token_val;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'organization_id', job_record.organization_id,
        'job_ref', job_record.job_ref,
        'status', job_record.status,
        'pickup_location', job_record.pickup_location,
        'pickup_emirate', job_record.pickup_emirate,
        'delivery_location', job_record.delivery_location,
        'delivery_emirate', job_record.delivery_emirate,
        'item_type', job_record.item_type,
        'sender_name', job_record.sender_name,
        'recipient_name', job_record.recipient_name,
        'driver_name', job_record.driver_name,
        'client_pickup_confirmed_at', job_record.client_pickup_confirmed_at,
        'driver_pickup_confirmed_at', job_record.driver_pickup_confirmed_at,
        'driver_delivery_confirmed_at', job_record.driver_delivery_confirmed_at,
        'client_delivery_confirmed_at', job_record.client_delivery_confirmed_at
    );
END;
$$;

-- New: list jobs for the calling user's org(s) — lets a tenant dashboard
-- avoid ever needing raw SELECT on public.jobs.
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
-- session — this is the entry point an external tenant's backend calls.
-- Pair with an application-layer check that hashes the presented API key,
-- looks it up in public.api_keys, confirms it's not revoked, and passes its
-- organization_id in here. Keeping key verification in the app layer (not
-- SQL) makes it easier to add rate limiting and rotation later.
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
    p_item_type item_type_enum,
    p_urgency urgency_enum,
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
        item_type, urgency, notes, source
    ) VALUES (
        org_id, p_sender_name, p_sender_phone, p_recipient_name, p_recipient_phone,
        p_pickup_emirate, p_pickup_location, p_delivery_emirate, p_delivery_location,
        p_item_type, p_urgency, p_notes, 'form'
    )
    RETURNING * INTO new_job;

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

-- confirm_job_step needs no change: it is already purely token-scoped and
-- has no org-authenticated code path, so tenant isolation is automatic.

-- ==========================================
-- 6. NOTES / NEXT STEPS (not executed by this script)
-- ==========================================
-- - Update the frontend's Supabase client calls (src/lib/supabase.ts) to
--   pass organization_id on every insert to quote_requests, drivers, jobs.
-- - Once every write path is updated and backfilled, uncomment the
--   ALTER ... SET NOT NULL statements in section 3.
-- - api_keys.key_hash: hash keys with something like SHA-256 before
--   storing; verify in your Express layer (server.ts / routes/) before
--   calling create_job_for_org, never trust a client-supplied org_id alone.
-- - Add a webhook_endpoints table (organization_id, url, secret, events[])
--   when you're ready to push status-change events out to tenants instead
--   of only supporting pull via list_org_jobs / get_job_by_token.
