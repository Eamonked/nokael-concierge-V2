-- ==========================================================================
-- Business Accounts — real-data migration
-- ==========================================================================
-- Applied against hhgzxpuzsbqirmbsiltn ("dubai-concierge") on 2026-09-25.
-- Saved here for version-control history — this file documents what was run,
-- it does not need to be re-run. All additive, no drops, no data loss.
-- See: nokael-business-dashboard-real-data-plan.md
-- ==========================================================================

-- Link jobs to businesses
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.business_inquiries(id);
CREATE INDEX IF NOT EXISTS idx_jobs_business ON public.jobs(business_id);

-- No backfill. Every job that existed at migration time is treated as a
-- one-off and stays business_id = NULL permanently — no company_name
-- string-matching, no mis-link risk. Only jobs created from now on through
-- a business account get business_id set explicitly, at creation time
-- (see JobCreateModal.tsx's resolveBusinessId()).

-- Business-level fields the UI already displays
ALTER TABLE public.business_inquiries
  ADD COLUMN IF NOT EXISTS service_tier TEXT DEFAULT 'Standard'
    CHECK (service_tier IN ('Enterprise VIP','Same-Day Premium','Enterprise','Standard')),
  ADD COLUMN IF NOT EXISTS contract_expiry DATE,
  ADD COLUMN IF NOT EXISTS monthly_volume_target INT DEFAULT 200;

-- Per-job billing — reuses the existing jobs.price_aed instead of a
-- parallel invoices ledger that could drift from actual job records.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unbilled'
    CHECK (payment_status IN ('unbilled','due','overdue','paid')),
  ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- Contacts
CREATE TABLE IF NOT EXISTS public.business_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_inquiries(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  role TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.business_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_manage_business_contacts" ON public.business_contacts
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- NOT included: an eta_minutes column. ETA is a live derived value (depends
-- on the driver's current position, which changes constantly) — storing it
-- would just be another field that goes stale the moment it's written.
-- Computed on demand instead via src/lib/eta.ts (Mapbox Directions API).
