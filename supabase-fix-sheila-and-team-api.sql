-- ==========================================
-- FIX: SHEILA LOGIN + TEAM API FOUNDATION
-- ==========================================
-- Run top-to-bottom in the Supabase SQL editor for project hhgzxpuzsbqirmbsiltn.
-- Not destructive. Idempotent (safe to re-run).
--
-- What this fixes:
--   1. Ensures sheila@nokael.com has an org_members row for tenant zero.
--      Without it, the Dashboard's getCurrentUserOrg() call returns null,
--      and every RLS policy on quote_requests / jobs / drivers that uses
--      is_org_member(organization_id) evaluates to FALSE — so she sees
--      zero rows and effectively cannot use the dashboard.
--
--   2. Adds a list_org_members RPC so /api/team/members can return
--      member emails without needing raw SELECT on auth.users from
--      the frontend (which the anon key cannot do).
--
--   3. Locks the new RPC to service_role only — same pattern as
--      verify_api_key and the pool RPCs.
--
-- STEP 1: Run the block below and verify the output shows sheila@nokael.com
--         before proceeding to STEP 2.
-- ==========================================

-- ── STEP 1: Diagnose ────────────────────────────────────────────────────────
-- Run this SELECT first. If it returns 0 rows, Sheila has no org membership.
-- If it returns a row with role = 'operator' (or any role), she should be
-- able to see data — in that case the login issue is elsewhere (wrong password,
-- stale session) and you should reset her password via the Auth dashboard.

SELECT
    u.email,
    m.role,
    m.organization_id,
    o.slug AS org_slug,
    m.created_at AS member_since
FROM auth.users u
LEFT JOIN public.org_members m ON m.user_id = u.id
LEFT JOIN public.organizations o ON o.id = m.organization_id
WHERE u.email = 'sheila@nokael.com';


-- ── STEP 2: Fix — ensure Sheila is in org_members for tenant zero ──────────
-- Safe to run regardless of STEP 1 result — ON CONFLICT does nothing if the
-- row already exists with the correct role.
DO $$
DECLARE
    sheila_uid UUID;
    nokael_org UUID;
BEGIN
    -- Look up Sheila's auth.users row
    SELECT id INTO sheila_uid
    FROM auth.users
    WHERE email = 'sheila@nokael.com'
    LIMIT 1;

    IF sheila_uid IS NULL THEN
        RAISE NOTICE 'sheila@nokael.com does not exist in auth.users — she needs to be invited first via the Auth dashboard or /api/team/invite. Skipping org_members insert.';
        RETURN;
    END IF;

    -- Tenant zero
    SELECT id INTO nokael_org
    FROM public.organizations
    WHERE slug = 'nokael'
    LIMIT 1;

    IF nokael_org IS NULL THEN
        RAISE EXCEPTION 'organizations table has no "nokael" slug — run supabase-multitenant-corrected.sql first.';
    END IF;

    INSERT INTO public.org_members (organization_id, user_id, role)
    VALUES (nokael_org, sheila_uid, 'operator')
    ON CONFLICT (organization_id, user_id) DO UPDATE
        SET role = EXCLUDED.role;  -- keep operator; change to 'admin' here if needed

    RAISE NOTICE 'sheila@nokael.com (%) is now an operator in org % (%)', sheila_uid, 'nokael', nokael_org;
END $$;


-- ── STEP 3: Ensure EVERY existing auth user who should have access ───────────
-- has an org_members row. Without this any user invited via the Auth dashboard
-- directly (rather than through /api/team/invite) will have no membership and
-- will experience the same "sees nothing" symptom as Sheila.
-- This seeds all confirmed, non-anonymous users as 'operator' in tenant zero
-- if they don't already have a membership anywhere.
-- Adjust the WHERE clause if you want to whitelist by email domain instead.

DO $$
DECLARE
    nokael_org UUID;
BEGIN
    SELECT id INTO nokael_org FROM public.organizations WHERE slug = 'nokael';
    IF nokael_org IS NULL THEN RETURN; END IF;

    INSERT INTO public.org_members (organization_id, user_id, role)
    SELECT
        nokael_org,
        u.id,
        'operator'
    FROM auth.users u
    WHERE u.is_anonymous = false
      AND u.email_confirmed_at IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.org_members m WHERE m.user_id = u.id
      )
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RAISE NOTICE 'Backfill complete — any previously-missing confirmed users are now operators in nokael org.';
END $$;


-- ── STEP 4: RPC — list_org_members ─────────────────────────────────────────
-- Used by /api/team/members in the server (service-role key) to join
-- org_members with auth.users for email addresses.
-- SECURITY DEFINER so it can read auth.users; locked to service_role below.

CREATE OR REPLACE FUNCTION public.list_org_members(p_org_id UUID)
RETURNS TABLE (
    member_id    UUID,
    user_id      UUID,
    email        TEXT,
    role         TEXT,
    created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id           AS member_id,
        m.user_id,
        u.email::TEXT,
        m.role::TEXT,
        m.created_at
    FROM public.org_members m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.organization_id = p_org_id
    ORDER BY m.created_at ASC;
END;
$$;

-- Lock it down: only the service role (used by routes/team.ts) can call it.
REVOKE EXECUTE ON FUNCTION public.list_org_members(UUID)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_org_members(UUID) TO service_role;


-- ── STEP 5: Verify ──────────────────────────────────────────────────────────
-- Run this after all steps to confirm the state looks right.

SELECT
    u.email,
    m.role,
    o.slug AS org
FROM public.org_members m
JOIN auth.users u ON u.id = m.user_id
JOIN public.organizations o ON o.id = m.organization_id
ORDER BY m.created_at;
