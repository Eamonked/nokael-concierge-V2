-- ==========================================
-- Add a "lost" status for quotes that never converted
-- ==========================================
-- Not destructive. Idempotent (safe to re-run).
--
-- What this does:
--   1. Widens the quote_requests_status_check constraint from
--      ('pending' | 'contacted' | 'completed') to also allow 'lost',
--      so operators can explicitly flag a quote as dead (customer never
--      responded, price too high, went with a competitor, etc.) without
--      it lingering forever as 'pending' in the active pipeline.
--   2. Adds lost_reason / lost_at columns so the "why" and "when" are
--      captured for reporting, rather than just a bare status flip.
--
-- Existing rows are untouched — this only widens what's allowed going
-- forward. Safe to run against production.

BEGIN;

ALTER TABLE public.quote_requests
  DROP CONSTRAINT IF EXISTS quote_requests_status_check;

ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_status_check
  CHECK (status IN ('pending', 'contacted', 'completed', 'lost'));

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

COMMIT;
