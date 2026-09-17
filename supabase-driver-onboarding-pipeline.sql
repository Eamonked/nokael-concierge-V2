-- ==========================================
-- DRIVER ONBOARDING PIPELINE — bring `drivers` up to parity with the
-- Nokael_Driver_Onboarding_Tracker.xlsx tracker it's replacing.
-- ==========================================
-- Run top-to-bottom in the Supabase SQL editor. Purely additive
-- (ADD COLUMN IF NOT EXISTS / CREATE ... IF NOT EXISTS throughout) —
-- safe to re-run, does not touch jobs, drivers RLS, or any existing
-- approve/reject code path in the dashboard.
--
-- Column -> Excel tracker column mapping:
--   emirate              <- City (Dubai / Abu Dhabi)
--   source_channel       <- Source Channel
--   screening_call_date  <- Screening Call Date
--   mohre_permit_status  <- MOHRE Permit Status
--   mohre_permit_expiry  <- MOHRE Permit Expiry
--   pcc_status           <- PCC Status
--   pcc_expiry           <- PCC Expiry
--   eid_verified         <- Emirates ID Verified   (column already existed)
--   license_verified     <- License Verified
--   vehicle_reg_verified <- Vehicle Reg. Verified
--   trial_job_date       <- Trial Job Date
--   trial_outcome        <- Trial Outcome
--   pin_generated        <- PIN Generated
--   pipeline_status      <- Active Status (the 6-stage pipeline)
--   onboarded_date       <- Onboarded Date
--   internal_notes       <- Notes                  (column already existed)

BEGIN;

-- ==========================================
-- 1. NEW COLUMNS ON public.drivers
-- ==========================================

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS emirate text,
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS screening_call_date date,
  ADD COLUMN IF NOT EXISTS mohre_permit_status text DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS mohre_permit_expiry date,
  ADD COLUMN IF NOT EXISTS pcc_status text DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS pcc_expiry date,
  ADD COLUMN IF NOT EXISTS license_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_reg_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_job_date date,
  ADD COLUMN IF NOT EXISTS trial_outcome text DEFAULT 'Not Yet Run',
  ADD COLUMN IF NOT EXISTS pin_generated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pipeline_status text DEFAULT 'Sourced',
  ADD COLUMN IF NOT EXISTS onboarded_date date;

-- eid_verified already exists on this table (see supabase-schema.sql /
-- supabase.sql) and is reused as-is for "Emirates ID Verified" — not
-- re-added here.

-- ==========================================
-- 2. CHECK CONSTRAINTS matching the Excel dropdown lists exactly
-- ==========================================
-- Added as separate NOT VALID + VALIDATE steps so an existing row with an
-- out-of-list value (unlikely, but possible from ad hoc manual edits)
-- fails loudly instead of silently blocking the whole migration.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_emirate_check'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_emirate_check
      CHECK (emirate IS NULL OR emirate IN ('Dubai', 'Abu Dhabi')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_mohre_permit_status_check'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_mohre_permit_status_check
      CHECK (mohre_permit_status IN ('Pending', 'Received', 'Verified', 'Failed')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_pcc_status_check'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_pcc_status_check
      CHECK (pcc_status IN ('Pending', 'Received', 'Verified', 'Failed')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_trial_outcome_check'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_trial_outcome_check
      CHECK (trial_outcome IN ('Pass', 'Fail', 'Not Yet Run')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_pipeline_status_check'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_pipeline_status_check
      CHECK (pipeline_status IN ('Sourced', 'Screening', 'Docs Pending', 'Trial Scheduled', 'Active', 'Rejected')) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.drivers VALIDATE CONSTRAINT drivers_emirate_check;
ALTER TABLE public.drivers VALIDATE CONSTRAINT drivers_mohre_permit_status_check;
ALTER TABLE public.drivers VALIDATE CONSTRAINT drivers_pcc_status_check;
ALTER TABLE public.drivers VALIDATE CONSTRAINT drivers_trial_outcome_check;
ALTER TABLE public.drivers VALIDATE CONSTRAINT drivers_pipeline_status_check;

-- ==========================================
-- 3. BACKFILL pipeline_status FROM THE EXISTING onboarding_status
-- ==========================================
-- onboarding_status stays in the table (nothing currently reading it
-- breaks), but pipeline_status becomes the real source of truth going
-- forward. One-time backfill only — approved -> Active, rejected ->
-- Rejected, pending -> Sourced (safest default for anything not yet
-- reviewed at all).
UPDATE public.drivers
SET pipeline_status = CASE onboarding_status
  WHEN 'approved' THEN 'Active'
  WHEN 'rejected' THEN 'Rejected'
  ELSE 'Sourced'
END
WHERE pipeline_status = 'Sourced'; -- only touch rows still at the column default

-- ==========================================
-- 4. KEEP onboarding_status IN SYNC GOING FORWARD (trigger)
-- ==========================================
-- Any existing code still reading/filtering on onboarding_status (e.g.
-- stats.pendingDrivers) keeps working without edits: Active -> approved,
-- Rejected -> rejected, everything else (Sourced/Screening/Docs
-- Pending/Trial Scheduled) -> pending.
CREATE OR REPLACE FUNCTION public.sync_driver_onboarding_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.onboarding_status := CASE NEW.pipeline_status
    WHEN 'Active' THEN 'approved'
    WHEN 'Rejected' THEN 'rejected'
    ELSE 'pending'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_driver_onboarding_status ON public.drivers;
CREATE TRIGGER trg_sync_driver_onboarding_status
  BEFORE INSERT OR UPDATE OF pipeline_status ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_driver_onboarding_status();

-- ==========================================
-- 5. ONBOARDED DATE — auto-stamp the first time a driver reaches Active
-- ==========================================
CREATE OR REPLACE FUNCTION public.stamp_driver_onboarded_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pipeline_status = 'Active' AND NEW.onboarded_date IS NULL THEN
    NEW.onboarded_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_driver_onboarded_date ON public.drivers;
CREATE TRIGGER trg_stamp_driver_onboarded_date
  BEFORE INSERT OR UPDATE OF pipeline_status ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_driver_onboarded_date();

COMMIT;

-- ==========================================
-- Verification query — run after the above to sanity-check the migration
-- ==========================================
-- SELECT full_name, emirate, pipeline_status, onboarding_status,
--        mohre_permit_status, pcc_status, eid_verified, license_verified,
--        vehicle_reg_verified, pin_generated, onboarded_date
-- FROM public.drivers ORDER BY created_at DESC;
