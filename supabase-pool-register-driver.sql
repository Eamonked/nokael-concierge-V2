-- ==========================================
-- POOL: REGISTER DRIVER + LIST DRIVER JOBS
-- ==========================================
-- Adds the two RPCs backing the new POST /api/pool/drivers and
-- GET /api/pool/drivers/:id/jobs routes in routes/pool.ts, so the
-- standalone driver app (driverapp/) can push a fully-onboarded applicant
-- into this org's public.drivers pool and then fetch that driver's
-- assigned jobs -- mirroring create_job_for_org / match_driver_for_org
-- exactly (org_id trusted from the already-verified pool API key,
-- SECURITY DEFINER, no PUBLIC execute).
--
-- IMPORTANT -- VERIFY BEFORE RUNNING: public.drivers live has columns
-- (vehicle_plate, rating, jobs_completed, areas_covered, active, status)
-- that are NOT defined in any committed migration in this repo (see
-- supabase-multitenant-corrected.sql's note on this). Confirm the actual
-- live column list in the Supabase dashboard first -- this migration
-- assumes those columns exist as described there. If they don't, adjust
-- the INSERT/SELECT lists below before running.

-- ------------------------------------------
-- register_driver_for_org
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.register_driver_for_org(
    org_id UUID,
    p_full_name TEXT,
    p_phone TEXT,
    p_vehicle_type TEXT,
    p_vehicle_plate TEXT DEFAULT NULL,
    p_areas_covered TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_driver public.drivers;
BEGIN
    INSERT INTO public.drivers (
        organization_id, full_name, phone, whatsapp, base_location,
        vehicle_type, vehicle_plate, areas_covered, active, status,
        onboarding_status
    ) VALUES (
        org_id, p_full_name, p_phone, p_phone,
        COALESCE(p_areas_covered[1], 'Dubai'),
        p_vehicle_type, p_vehicle_plate, p_areas_covered, TRUE, 'available',
        'approved'
    )
    RETURNING * INTO new_driver;

    RETURN jsonb_build_object('success', true, 'driver_id', new_driver.id);
END;
$$;

REVOKE ALL ON FUNCTION public.register_driver_for_org(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_driver_for_org(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO service_role;

-- ------------------------------------------
-- list_driver_jobs_for_org
-- ------------------------------------------
-- Active/assigned jobs for one driver within the calling org, including
-- the driver-facing tokens the job-feed screen needs to hand off to
-- confirm_job_step. org_id is trusted the same way match_driver_for_org
-- trusts it (already verified upstream via the pool API key).
CREATE OR REPLACE FUNCTION public.list_driver_jobs_for_org(
    org_id UUID,
    p_driver_id UUID
)
RETURNS TABLE(
    job_ref TEXT,
    status job_status,
    pickup_location TEXT,
    delivery_location TEXT,
    token_driver_pickup UUID,
    token_driver_delivery UUID
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        j.job_ref::TEXT, j.status, j.pickup_location, j.delivery_location,
        j.token_driver_pickup, j.token_driver_delivery
    FROM public.jobs j
    WHERE j.organization_id = org_id
      AND j.driver_id = p_driver_id
      AND j.status IN ('pending', 'client_pickup', 'driver_pickup', 'driver_delivery')
    ORDER BY j.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_driver_jobs_for_org(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_driver_jobs_for_org(UUID, UUID) TO service_role;
