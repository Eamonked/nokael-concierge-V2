-- =============================================================================
-- Nokael — operational readiness (25 Sep 2026)
-- Project: hhgzxpuzsbqirmbsiltn ("dubai-concierge")
--
-- Applied as four separate migrations (names in the section headers). Every
-- statement is idempotent. No table is dropped, no row is deleted, and no
-- function an app currently calls loses the grant it relies on.
--
-- Callers verified by grepping nokael-concierge-V2, Nokael-Confirmation-Portal
-- and the Nokael Driver Android app before writing this.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. close_public_view_leak
--
-- active_jobs_board and driver_performance were SECURITY DEFINER views with
-- SELECT granted to anon: anyone holding the public anon key (it ships in the
-- web bundle) could read every open job's customer names, phones, addresses,
-- prices and the driver's live position. No app uses either view. Make them
-- respect the caller's RLS and take them away from anon.
-- -----------------------------------------------------------------------------
alter view public.active_jobs_board  set (security_invoker = true);
alter view public.driver_performance set (security_invoker = true);
revoke all on public.active_jobs_board  from anon, public;
revoke all on public.driver_performance from anon, public;


-- -----------------------------------------------------------------------------
-- 2. lock_down_unauthenticated_rpcs
--
-- Functions that act on a raw driver/org id. The first group has no caller in
-- any app and either no auth check at all (stop_driver_location_tracking) or
-- only a check an attacker can satisfy by knowing a driver's UUID, which
-- get_driver_id_by_phone hands out for any phone number. The Android app uses
-- driver_publish_location / driver_stop_location instead.
--
-- Kept public on purpose (the legacy web hub in Nokael-Confirmation-Portal
-- still calls them; retire together with the hub):
--   create_driver_session, get_driver_session_status,
--   get_driver_active_jobs_session, update_driver_status_session
-- -----------------------------------------------------------------------------
revoke execute on function public.stop_driver_location_tracking(uuid)
  from public, anon, authenticated;
revoke execute on function public.update_driver_location_session(uuid, double precision, double precision, double precision)
  from public, anon, authenticated;
revoke execute on function public.get_driver_id_by_phone(text)
  from public, anon, authenticated;
-- Only ever called from inside driver_login / create_driver_session (which run
-- as owner). Exposed directly it lets anyone lock a driver out with 5 guesses.
revoke execute on function public.verify_driver_pin(uuid, text)
  from public, anon, authenticated;

-- Ops-only functions that already check org membership: anon can never pass
-- the check, so remove the anon surface. Signed-in ops keep access.
revoke execute on function public.get_active_driver_locations(uuid) from public, anon;
revoke execute on function public.list_org_jobs(uuid, public.job_status, integer, integer) from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
grant  execute on function public.get_active_driver_locations(uuid) to authenticated;
grant  execute on function public.list_org_jobs(uuid, public.job_status, integer, integer) to authenticated;
grant  execute on function public.is_org_member(uuid) to authenticated;

-- Drop the two policies that key on user_metadata (user-editable). Both are
-- permissive and strictly narrower than the org_members_manage_* policy on the
-- same table, so effective access is unchanged.
drop policy if exists drivers_operators_org_scoped     on public.drivers;
drop policy if exists job_ratings_operators_org_scoped on public.job_ratings;

-- Pin search_path on the functions the linter flagged.
alter function public.fn_set_job_ref()                      set search_path = public, extensions;
alter function public.update_driver_rating()                set search_path = public, extensions;
alter function public.update_driver_jobs_completed()        set search_path = public, extensions;
alter function public.update_driver_status_on_job()         set search_path = public, extensions;
alter function public.fn_set_updated_at()                   set search_path = public, extensions;
alter function public.fn_cleanup_stale_location_tracking()  set search_path = public, extensions;
alter function public.generate_job_ref()                    set search_path = public, extensions;
alter function public.fn_enforce_job_sequence()             set search_path = public, extensions;
alter function public.is_org_member(uuid)                   set search_path = public, extensions;
alter function public.verify_api_key(text)                  set search_path = public, extensions;
alter function public.list_org_members(uuid)                set search_path = public, extensions;
alter function public.list_org_jobs(uuid, public.job_status, integer, integer) set search_path = public, extensions;
alter function public.match_driver_for_org(uuid, text)      set search_path = public, extensions;
alter function public.get_available_drivers(text)           set search_path = public, extensions;
alter function public.get_available_drivers(text, uuid)     set search_path = public, extensions;
alter function public.driver_request_otp(text, text)        set search_path = public, extensions;
alter function public.driver_login_otp(text, text, text)    set search_path = public, extensions;
alter function public.create_job_for_org(uuid, text, text, text, text, text, text, text, text, public.item_type, public.urgency_level, text, text)
  set search_path = public, extensions;


-- -----------------------------------------------------------------------------
-- 3. enable_realtime_for_dispatch
--
-- The ops dashboard subscribes to postgres_changes on public.jobs
-- (subscribeToJobs), but jobs/drivers were only in a custom "dispatch_realtime"
-- publication, which Supabase Realtime does not read. So the dashboard never
-- received a live update. Realtime applies RLS, so only org members get rows.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs') then
    alter publication supabase_realtime add table public.jobs;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'drivers') then
    alter publication supabase_realtime add table public.drivers;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 4. mirror_app_location_onto_jobs
--
-- The dashboard live map, the Jobs view and the customer tracking page all read
-- jobs.driver_lat / driver_lng / driver_updated_at (written by the legacy
-- portal). The Android app publishes to driver_location_tracking only, so app
-- drivers never appeared on any map. Mirror each fix onto the driver's open
-- jobs, throttled to one job write per 10 s per driver so the 5 s-ish GPS
-- cadence doesn't turn into a jobs-table write storm.
-- Contract unchanged: same params, same {ok:true} / {ok:false,error} results.
-- -----------------------------------------------------------------------------
create or replace function public.driver_publish_location(
  p_token text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_meters double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_driver uuid := public._driver_from_session(p_token);
  v_acc    double precision;
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

  return jsonb_build_object('ok', true);
end;
$function$;
