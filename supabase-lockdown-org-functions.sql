-- ==========================================
-- LOCK DOWN ORG-SCOPED RPCs + SEED API KEY
-- ==========================================
-- Run top-to-bottom in the Supabase SQL editor against hhgzxpuzsbqirmbsiltn.
-- Not destructive. Fixes a real hole: create_job_for_org and
-- match_driver_for_org are SECURITY DEFINER functions that trust whatever
-- org_id they're handed (by design -- the app layer is supposed to be the
-- gate). Postgres grants EXECUTE on new functions to PUBLIC by default,
-- and that default was never revoked, so right now anyone holding the
-- anon key (which ships in the frontend bundle) can call these directly
-- over PostgREST with any org UUID.

-- ==========================================
-- 1. CLOSE THE PUBLIC-EXECUTE HOLE
-- ==========================================
REVOKE EXECUTE ON FUNCTION public.create_job_for_org(
    uuid, text, text, text, text, text, text, text, text, item_type, urgency_level, text
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.match_driver_for_org(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_job_for_org(
    uuid, text, text, text, text, text, text, text, text, item_type, urgency_level, text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.match_driver_for_org(uuid, text) TO service_role;

-- Note (not fixed here, flagged only): get_available_drivers has the same
-- PUBLIC-execute exposure and leaks driver names/phones to anyone with the
-- anon key. Pre-existing, not introduced by this migration. It's used by
-- the live dashboard today (via getAvailableDrivers() in src/lib/supabase.ts)
-- so it isn't touched in this pass -- needs its own look at what currently
-- calls it before locking it down.

-- ==========================================
-- 2. API KEY VERIFICATION RPC
-- ==========================================
-- Same pattern already used for driver PIN auth (set_driver_pin /
-- verify_driver_pin / create_driver_session): hashing and comparison
-- happen inside Postgres via pgcrypto, the plaintext key never needs to
-- be compared in application code, and a Node bcrypt dependency isn't
-- needed. Returns the owning organization_id on a valid, non-revoked key,
-- or NULL. Stamps last_used_at on a successful match.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.verify_api_key(p_key TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    matched_org UUID;
    matched_id UUID;
BEGIN
    SELECT organization_id, id INTO matched_org, matched_id
    FROM public.api_keys
    WHERE revoked_at IS NULL
      AND crypt(p_key, key_hash) = key_hash
    LIMIT 1;

    IF matched_org IS NOT NULL THEN
        UPDATE public.api_keys SET last_used_at = NOW() WHERE id = matched_id;
    END IF;

    RETURN matched_org;
END;
$$;

-- Only the server (via the service role key) should ever be able to
-- attempt a key verification -- never the anon key, and not a merely
-- logged-in dashboard user either.
REVOKE EXECUTE ON FUNCTION public.verify_api_key(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_api_key(TEXT) TO service_role;

-- ==========================================
-- 3. SEED ONE REAL API KEY FOR NOKAEL (TENANT ZERO)
-- ==========================================
-- Raw secret (copy this into your server .env now as SUPABASE_POOL_API_KEY_NOKAEL
-- -- it is hashed with bcrypt below and cannot be recovered once this
-- statement runs):
--
--   a30f6347ff9364b36e4e0bfb812eb2d7b80323c5c682a973ee21b96ac83ca89d
--
-- This is the key nokael-concierge-V2's own routes/pool.ts will send as
-- the `x-nokael-pool-key` header -- Nokael acting as its own first
-- external-style tenant against the multi-tenant API surface.
INSERT INTO public.api_keys (organization_id, key_hash, label)
SELECT
    id,
    crypt('a30f6347ff9364b36e4e0bfb812eb2d7b80323c5c682a973ee21b96ac83ca89d', gen_salt('bf')),
    'nokael-concierge-v2 routes/pool.ts (self-integration, seeded 2026-08-30)'
FROM public.organizations
WHERE slug = 'nokael'
-- Idempotency guard: skip if a key with this exact label already exists,
-- so re-running this script by accident doesn't mint a second key.
AND NOT EXISTS (
    SELECT 1 FROM public.api_keys
    WHERE label = 'nokael-concierge-v2 routes/pool.ts (self-integration, seeded 2026-08-30)'
);
