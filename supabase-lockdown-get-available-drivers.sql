-- ==========================================
-- LOCK DOWN get_available_drivers
-- ==========================================
-- Run in the Supabase SQL editor against hhgzxpuzsbqirmbsiltn.
-- Not destructive.
--
-- Follow-up to supabase-lockdown-org-functions.sql, which flagged this
-- function but deliberately didn't touch it pending a look at what
-- currently calls it.
--
-- Findings from that look:
--   1. Nothing in either repo (nokael-concierge-V2 or
--      Nokael-Confirmation-Portal) calls this RPC. The dashboard's
--      getAvailableDrivers() in src/lib/supabase.ts is a same-named JS
--      function but does a direct `.from('drivers').select(...)` table
--      query as the authenticated user, already correctly scoped by the
--      org_members_manage_drivers RLS policy. It never calls this SQL
--      function. match_driver_for_org (locked down in the prior
--      migration) is the actual matching primitive in use today.
--   2. Two overloaded versions currently exist live --
--      get_available_drivers(text) and get_available_drivers(text, uuid)
--      -- because CREATE OR REPLACE with an added parameter creates a new
--      overload rather than replacing the original. Calling this RPC via
--      PostgREST right now returns a PGRST203 "ambiguous function"
--      error, for any role, since it can't pick between the two
--      candidates. This isn't a security control -- it's an accident --
--      but it means the function isn't reachable via RPC today regardless
--      of grants.
--   3. Even setting the ambiguity aside, this function is LANGUAGE
--      plpgsql with no SECURITY DEFINER, i.e. SECURITY INVOKER (the
--      default) -- it runs as the calling role. Since drivers only has an
--      anon INSERT policy and an authenticated-org-member policy (no anon
--      SELECT policy), RLS would already return zero rows to anon even if
--      the ambiguity were fixed.
--
-- Net: not an active PII leak today, contrary to how the prior migration
-- flagged it -- but PUBLIC/anon/authenticated still have the default
-- EXECUTE grant on unused, dead-code RPCs, which is worth closing anyway
-- rather than relying on RLS + an accidental overload conflict to keep it
-- safe. Locking down grants here, same pattern as the other two
-- functions. Not dropping the stale single-arg overload in this pass --
-- that's a code-hygiene cleanup, not a security fix, and dropping is
-- harder to undo than revoking.

REVOKE EXECUTE ON FUNCTION public.get_available_drivers(TEXT)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_available_drivers(TEXT, UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_available_drivers(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_available_drivers(TEXT, UUID) TO service_role;
