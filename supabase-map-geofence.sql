-- ============================================================================
-- Geofencing: tell dispatch when a driver gets close to the stop they're
-- heading to (pickup before collection, drop-off after).
--
-- Runs inside driver_publish_location, the RPC the Android app calls with every
-- GPS fix, so no extra client work and no cron. Each job fires each geofence
-- once:
--   jobs.driver_near_pickup_at / driver_near_delivery_at  first time inside
--   job_events                                            one row per entry, which
--                                                          the dashboard receives live
-- Radius per organisation, in organizations.settings -> 'geofence':
--   {"pickup_m": 300, "delivery_m": 300, "max_accuracy_m": 150}
-- Fixes less accurate than max_accuracy_m are ignored so a bad GPS reading
-- can't trigger an arrival.
--
-- Also adds get_dispatch_driver_positions(), used by the dashboard map's
-- "Online drivers" view (active, approved drivers with their last fix).
-- ============================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS driver_near_pickup_at   timestamptz,
  ADD COLUMN IF NOT EXISTS driver_near_delivery_at timestamptz;

CREATE TABLE IF NOT EXISTS public.job_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id       uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  type            text NOT NULL CHECK (type IN ('geofence_pickup', 'geofence_delivery')),
  distance_m      integer,
  radius_m        integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid
);
CREATE INDEX IF NOT EXISTS job_events_org_created_idx ON public.job_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_events_job_idx ON public.job_events (job_id);

ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_events FROM anon;
GRANT SELECT ON public.job_events TO authenticated;
GRANT UPDATE (acknowledged_at, acknowledged_by) ON public.job_events TO authenticated;

DROP POLICY IF EXISTS job_events_select_members ON public.job_events;
CREATE POLICY job_events_select_members ON public.job_events
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS job_events_ack_writers ON public.job_events;
CREATE POLICY job_events_ack_writers ON public.job_events
  FOR UPDATE TO authenticated
  USING (public.can_write_org(organization_id))
  WITH CHECK (public.can_write_org(organization_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'job_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_events;
  END IF;
END $$;

-- Great-circle distance in metres.
CREATE OR REPLACE FUNCTION public._distance_m(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 2 * 6371000 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2) +
           cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
         ));
$$;

-- Same body as before, plus the geofence block at the end.
CREATE OR REPLACE FUNCTION public.driver_publish_location(p_token text, p_lat double precision, p_lng double precision, p_accuracy_meters double precision DEFAULT NULL::double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_driver uuid := public._driver_from_session(p_token);
  v_acc    double precision;
  v_job    record;
  v_cfg    jsonb;
  v_radius integer;
  v_dist   double precision;
  v_stage  text;
begin
  -- Null-safe; NaN sorts above every number in Postgres so it fails the > checks.
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return jsonb_build_object('ok', false, 'error', 'invalid_coordinates');
  end if;

  v_acc := case
             when p_accuracy_meters is null or p_accuracy_meters < 0 or p_accuracy_meters > 100000
               then null
             else p_accuracy_meters
           end;

  insert into public.driver_location_tracking (
    driver_id, last_known_lat, last_known_lng,
    last_location_update_at, accuracy_meters, is_tracking_active, updated_at
  ) values (
    v_driver, p_lat, p_lng, now(), v_acc, true, now()
  )
  on conflict (driver_id) do update set
    last_known_lat          = excluded.last_known_lat,
    last_known_lng          = excluded.last_known_lng,
    last_location_update_at = excluded.last_location_update_at,
    accuracy_meters         = excluded.accuracy_meters,
    is_tracking_active      = true,
    updated_at              = excluded.updated_at;

  -- Feed the maps that read the job row (dashboard, tracking page).
  update public.jobs j
     set driver_lat        = p_lat,
         driver_lng        = p_lng,
         driver_updated_at = now()
   where j.driver_id = v_driver
     and j.status not in ('completed', 'cancelled', 'returned')
     and (j.driver_updated_at is null or j.driver_updated_at < now() - interval '10 seconds');

  -- Geofence: first fix inside the radius of the stop this job is heading to.
  for v_job in
    select j.id, j.organization_id, j.driver_pickup_at,
           j.pickup_lat, j.pickup_lng, j.delivery_lat, j.delivery_lng,
           j.driver_near_pickup_at, j.driver_near_delivery_at
      from public.jobs j
     where j.driver_id = v_driver
       and j.status not in ('completed', 'cancelled', 'returned')
       and j.organization_id is not null
  loop
    select coalesce(o.settings -> 'geofence', '{}'::jsonb) into v_cfg
      from public.organizations o where o.id = v_job.organization_id;
    v_cfg := coalesce(v_cfg, '{}'::jsonb);

    continue when v_acc is not null
              and v_acc > coalesce((v_cfg ->> 'max_accuracy_m')::double precision, 150);

    v_stage := null;
    if v_job.driver_pickup_at is null then
      if v_job.driver_near_pickup_at is null and v_job.pickup_lat is not null and v_job.pickup_lng is not null then
        v_stage  := 'pickup';
        v_radius := coalesce((v_cfg ->> 'pickup_m')::integer, 300);
        v_dist   := public._distance_m(p_lat, p_lng, v_job.pickup_lat, v_job.pickup_lng);
      end if;
    elsif v_job.driver_near_delivery_at is null and v_job.delivery_lat is not null and v_job.delivery_lng is not null then
      v_stage  := 'delivery';
      v_radius := coalesce((v_cfg ->> 'delivery_m')::integer, 300);
      v_dist   := public._distance_m(p_lat, p_lng, v_job.delivery_lat, v_job.delivery_lng);
    end if;

    continue when v_stage is null or v_dist > v_radius;

    -- The "is null" guard makes this fire once even if two fixes race.
    if v_stage = 'pickup' then
      update public.jobs set driver_near_pickup_at = now()
       where id = v_job.id and driver_near_pickup_at is null;
    else
      update public.jobs set driver_near_delivery_at = now()
       where id = v_job.id and driver_near_delivery_at is null;
    end if;

    if found then
      insert into public.job_events (organization_id, job_id, driver_id, type, distance_m, radius_m)
      values (v_job.organization_id, v_job.id, v_driver, 'geofence_' || v_stage, round(v_dist)::integer, v_radius);
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$function$;

-- Positions for the dashboard map's "Online drivers" view. Returns every active,
-- approved driver in the org with their last fix (or none); the dashboard decides
-- what counts as "online" from last_update so it can also show recently-seen drivers.
CREATE OR REPLACE FUNCTION public.get_dispatch_driver_positions(p_organization_id uuid)
RETURNS TABLE(driver_id uuid, latitude double precision, longitude double precision,
              last_update timestamptz, accuracy_meters double precision, is_tracking_active boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'Not authorized for this organization';
  END IF;

  RETURN QUERY
  SELECT d.id, t.last_known_lat, t.last_known_lng, t.last_location_update_at,
         t.accuracy_meters, t.is_tracking_active
    FROM public.drivers d
    JOIN public.driver_location_tracking t ON t.driver_id = d.id
   WHERE d.organization_id = p_organization_id
     AND d.active IS TRUE
     AND d.onboarding_status = 'approved';
END;
$$;

REVOKE ALL ON FUNCTION public.get_dispatch_driver_positions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dispatch_driver_positions(uuid) TO authenticated;
