-- =============================================================================
-- Nokael — driver pickup/delivery window reminders (21 Oct 2026)
-- Project: hhgzxpuzsbqirmbsiltn
--
-- Replaces push_queue_pickup_reminders, which keyed on scheduled_pickup_at — a
-- field the job form never fills (it saves pickup_window_start), so reminders
-- never fired.
--
--   * "New job assigned" now says when the pickup window starts.
--   * Edge Function driver-reminders (pg_cron every 2 min) decides, per job leg:
--       - GPS fresh  → "Leave now" when traffic-aware drive time + buffer reaches
--                      the window start (Mapbox driving-traffic, cached 5 min).
--       - no GPS     → time-based "be there by" at start − buffer − 30 min.
--       - ETA past window start → one staff alert.
--   * Legs: pickup (target pickup_window_start, else scheduled_pickup_at) until
--     picked up; delivery (target scheduled_delivery_start) after pickup.
--   * *_sent_for columns hold the target time a message was sent for, so moving
--     a window re-arms it.
--   * Buffer: organizations.settings.reminder_buffer_min (default 15).
-- Safe to run more than once.
--
-- SUPERSEDED in part by supabase-driver-reminder-state.sql: the jobs columns
-- below and the reminder_* functions' storage moved to job_reminder_state.
-- Run that file after this one. The cron job and _push_on_job parts still stand.
-- =============================================================================

alter table public.jobs
  add column if not exists pickup_leave_sent_for   timestamptz,
  add column if not exists delivery_leave_sent_for timestamptz,
  add column if not exists pickup_late_alert_for   timestamptz,
  add column if not exists delivery_late_alert_for timestamptz,
  add column if not exists eta_leg        text,
  add column if not exists eta_seconds    integer,
  add column if not exists eta_checked_at timestamptz;

-- Local clock time for push text, e.g. "3:00 PM".
create or replace function public._push_clock(p_org uuid, p_at timestamptz)
returns text
language sql stable security definer
set search_path = public
as $$
  select to_char(p_at at time zone coalesce(nullif(public.org_setting(p_org, 'timezone'), ''), 'Asia/Dubai'), 'FMHH12:MI AM');
$$;

-- "in 35 min" / "in 1 h 20 min".
create or replace function public._push_in(p_seconds double precision)
returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_seconds < 60 then 'now'
    when p_seconds < 3600 then 'in ' || round(p_seconds / 60) || ' min'
    else 'in ' || floor(p_seconds / 3600) || ' h' ||
         coalesce(' ' || nullif(round((p_seconds - floor(p_seconds / 3600) * 3600) / 60), 0) || ' min', '')
  end;
$$;

-- ---------------------------------------------------------------------------
-- Candidates: one row per active job leg whose window starts in the next 3 h.
-- ---------------------------------------------------------------------------
create or replace function public.reminder_candidates()
returns table (
  job_id uuid,
  leg text,
  target timestamptz,
  dest_lat double precision,
  dest_lng double precision,
  driver_lat double precision,
  driver_lng double precision,
  buffer_min integer,
  leave_sent boolean,
  late_sent boolean,
  eta_seconds integer
)
language sql stable security definer
set search_path = public
as $$
  with legs as (
    select j.*, 'pickup'::text as leg,
           coalesce(j.pickup_window_start, j.scheduled_pickup_at) as target,
           j.pickup_lat as dest_lat, j.pickup_lng as dest_lng,
           j.pickup_leave_sent_for as leave_for, j.pickup_late_alert_for as late_for
      from public.jobs j
     where j.driver_pickup_at is null and j.driver_arrived_pickup_at is null
    union all
    select j.*, 'delivery', j.scheduled_delivery_start,
           j.delivery_lat, j.delivery_lng,
           j.delivery_leave_sent_for, j.delivery_late_alert_for
      from public.jobs j
     where j.driver_pickup_at is not null
       and j.driver_arrived_delivery_at is null and j.driver_delivery_at is null
  )
  select l.id, l.leg, l.target, l.dest_lat, l.dest_lng,
         case when t.is_tracking_active and t.last_location_update_at > now() - interval '5 minutes' then t.last_known_lat end,
         case when t.is_tracking_active and t.last_location_update_at > now() - interval '5 minutes' then t.last_known_lng end,
         coalesce(nullif(public.org_setting(l.organization_id, 'reminder_buffer_min'), '')::integer, 15),
         l.leave_for is not distinct from l.target,
         l.late_for is not distinct from l.target,
         case when l.eta_leg = l.leg and l.eta_checked_at > now() - interval '5 minutes' then l.eta_seconds end
    from legs l
    left join public.driver_location_tracking t on t.driver_id = l.driver_id
   where l.driver_id is not null
     and l.status not in ('completed', 'cancelled', 'returned')
     and l.target > now() and l.target <= now() + interval '3 hours';
$$;

create or replace function public.reminder_cache_eta(p_job uuid, p_leg text, p_seconds integer)
returns void
language sql security definer
set search_path = public
as $$
  update public.jobs set eta_leg = p_leg, eta_seconds = p_seconds, eta_checked_at = now() where id = p_job;
$$;

-- ---------------------------------------------------------------------------
-- Send one reminder. p_kind: 'leave' (GPS + ETA), 'fallback' (time only),
-- 'late' (staff). Marks before enqueueing; returns false if already sent for
-- this target, so concurrent runs can't double-send.
-- ---------------------------------------------------------------------------
create or replace function public.reminder_send(p_job uuid, p_leg text, p_kind text, p_target timestamptz, p_eta_seconds integer default null)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  j public.jobs;
  v_place text;
  v_ref text;
  v_at text;
  v_driver text;
  v_stop text := case p_leg when 'pickup' then 'pickup' else 'drop-off' end;
begin
  if p_leg not in ('pickup', 'delivery') or p_kind not in ('leave', 'fallback', 'late') then
    raise exception 'bad reminder %/%', p_leg, p_kind;
  end if;

  if p_kind = 'late' then
    update public.jobs set
      pickup_late_alert_for   = case when p_leg = 'pickup'   then p_target else pickup_late_alert_for end,
      delivery_late_alert_for = case when p_leg = 'delivery' then p_target else delivery_late_alert_for end
     where id = p_job
       and (case when p_leg = 'pickup' then pickup_late_alert_for else delivery_late_alert_for end) is distinct from p_target
    returning * into j;
  else
    update public.jobs set
      pickup_leave_sent_for   = case when p_leg = 'pickup'   then p_target else pickup_leave_sent_for end,
      delivery_leave_sent_for = case when p_leg = 'delivery' then p_target else delivery_leave_sent_for end
     where id = p_job
       and (case when p_leg = 'pickup' then pickup_leave_sent_for else delivery_leave_sent_for end) is distinct from p_target
    returning * into j;
  end if;
  if j.id is null then
    return false;
  end if;

  v_ref := coalesce(j.job_ref, left(j.id::text, 8));
  v_place := public._push_place(case p_leg when 'pickup' then j.pickup_location else j.delivery_location end);
  v_at := public._push_clock(j.organization_id, p_target);

  if p_kind = 'leave' then
    perform public.push_enqueue('driver', j.organization_id, j.driver_id, null, j.id,
      'Leave now for ' || v_stop,
      'Leave now to reach ' || v_place || ' by ' || v_at || ' (about ' || greatest(1, round(p_eta_seconds / 60.0)) || ' min away). ' || v_ref,
      '/driver-app/', 'job:' || j.id || ':reminder');
  elsif p_kind = 'fallback' then
    perform public.push_enqueue('driver', j.organization_id, j.driver_id, null, j.id,
      initcap(v_stop) || ' by ' || v_at,
      'You need to be at the ' || v_stop || ' location (' || v_place || ') by ' || v_at || '. ' || v_ref,
      '/driver-app/', 'job:' || j.id || ':reminder');
  else
    v_driver := (select coalesce(nullif(btrim(full_name), ''), 'Driver') from public.drivers where id = j.driver_id);
    perform public.push_enqueue('staff', j.organization_id, null, null, j.id,
      'Driver likely late for ' || v_stop,
      v_ref || ': ' || coalesce(v_driver, 'Driver') || ' ETA ' || public._push_clock(j.organization_id, now() + make_interval(secs => p_eta_seconds))
        || ', window opens ' || v_at || ' at ' || v_place || '.',
      '/dashboard', 'job:' || j.id || ':late');
  end if;
  return true;
end;
$$;

revoke execute on function public.reminder_candidates() from public, anon, authenticated;
revoke execute on function public.reminder_cache_eta(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.reminder_send(uuid, text, text, timestamptz, integer) from public, anon, authenticated;
grant  execute on function public.reminder_candidates() to service_role;
grant  execute on function public.reminder_cache_eta(uuid, text, integer) to service_role;
grant  execute on function public.reminder_send(uuid, text, text, timestamptz, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Cron: wake driver-reminders every 2 min (same shared secret as push-dispatch).
-- ---------------------------------------------------------------------------
create or replace function public._reminders_kick()
returns void
language plpgsql security definer
set search_path = public, extensions, vault
as $$
declare
  v_secret text;
begin
  -- Nothing due in the next 3 h → don't wake the function.
  if not exists (select 1 from public.reminder_candidates()) then
    return;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  perform net.http_post(
    url := 'https://hhgzxpuzsbqirmbsiltn.supabase.co/functions/v1/driver-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function public._reminders_kick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'push-pickup-reminders') then
    perform cron.unschedule('push-pickup-reminders');
  end if;
  if exists (select 1 from cron.job where jobname = 'driver-reminders') then
    perform cron.unschedule('driver-reminders');
  end if;
  perform cron.schedule('driver-reminders', '*/2 * * * *', 'select public._reminders_kick()');
end $$;

-- ---------------------------------------------------------------------------
-- "New job assigned" mentions the pickup window. Rest of _push_on_job unchanged.
-- ---------------------------------------------------------------------------
create or replace function public._push_on_job()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ref text := coalesce(new.job_ref, left(new.id::text, 8));
  v_pickup text := public._push_place(new.pickup_location);
  v_dropoff text := public._push_place(new.delivery_location);
  v_route text := v_pickup || ' → ' || v_dropoff;
  v_driver text := (select coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), 'Your driver') from public.drivers where id = new.driver_id);
  v_tag text := 'job:' || new.id;
  v_dist double precision;
  v_changes text[] := '{}';
  v_is_new boolean := tg_op = 'INSERT';
  v_start timestamptz := coalesce(new.pickup_window_start, new.scheduled_pickup_at);
  v_when text := '';
begin
  -- Assigned (new job with a driver, or a different driver).
  if new.driver_id is not null and (v_is_new or new.driver_id is distinct from old.driver_id)
     and new.status not in ('completed', 'cancelled', 'returned') then
    if v_start > now() and v_start <= now() + interval '3 hours' then
      v_when := '. Pickup window starts ' || public._push_clock(new.organization_id, v_start) || ', '
        || case when v_start <= now() + interval '1 hour' then 'under an hour from now'
                else public._push_in(extract(epoch from v_start - now())) || ' from now' end || '.';
    elsif v_start > now() then
      v_when := '. Pickup ' || to_char(v_start at time zone coalesce(nullif(public.org_setting(new.organization_id, 'timezone'), ''), 'Asia/Dubai'), 'Dy DD Mon')
        || ', ' || public._push_clock(new.organization_id, v_start) || '.';
    end if;
    perform public.push_enqueue('driver', new.organization_id, new.driver_id, null, new.id,
      'New job assigned', v_ref || ' · ' || v_route || v_when, '/driver-app/', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Driver assigned', v_ref || ': ' || coalesce(v_driver, 'A driver') || ' is on the way to ' || v_pickup || '.', '/portal/', v_tag);
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Driver assigned', coalesce(v_driver, 'Your driver') || ' is on the way to ' || v_pickup || '.', null, v_tag);
  end if;

  if v_is_new then
    return null;
  end if;

  -- Taken off the previous driver.
  if old.driver_id is not null and new.driver_id is distinct from old.driver_id
     and old.status not in ('completed', 'cancelled', 'returned') then
    perform public.push_enqueue('driver', new.organization_id, old.driver_id, null, new.id,
      'Job reassigned', v_ref || ' is no longer assigned to you.', '/driver-app/', v_tag);
  end if;

  -- Cancelled.
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.driver_id is not null then
    perform public.push_enqueue('driver', new.organization_id, new.driver_id, null, new.id,
      'Job cancelled', v_ref || ' · ' || v_route || coalesce(' — ' || nullif(btrim(new.cancellation_reason), ''), ''), '/driver-app/', v_tag);
  end if;

  -- Details changed while the same driver has it.
  if new.driver_id is not null and new.driver_id is not distinct from old.driver_id
     and new.status not in ('completed', 'cancelled', 'returned') then
    if new.pickup_location is distinct from old.pickup_location then v_changes := array_append(v_changes, 'pickup address'); end if;
    if new.delivery_location is distinct from old.delivery_location then v_changes := array_append(v_changes, 'drop-off address'); end if;
    if new.scheduled_pickup_at is distinct from old.scheduled_pickup_at then v_changes := array_append(v_changes, 'pickup time'); end if;
    if new.pickup_window_start is distinct from old.pickup_window_start
       or new.pickup_window_end is distinct from old.pickup_window_end then v_changes := array_append(v_changes, 'pickup window'); end if;
    if new.scheduled_delivery_start is distinct from old.scheduled_delivery_start
       or new.scheduled_delivery_end is distinct from old.scheduled_delivery_end then v_changes := array_append(v_changes, 'delivery window'); end if;
    if new.special_instructions is distinct from old.special_instructions then v_changes := array_append(v_changes, 'instructions'); end if;
    if cardinality(v_changes) > 0 then
      perform public.push_enqueue('driver', new.organization_id, new.driver_id, null, new.id,
        'Job updated', v_ref || ': ' || array_to_string(v_changes, ', ') || ' changed.', '/driver-app/', v_tag);
    end if;
  end if;

  -- Arrived at pickup.
  if new.driver_arrived_pickup_at is not null and old.driver_arrived_pickup_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Driver arrived at pickup', v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' at ' || v_pickup, '/dashboard', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Driver at pickup', v_ref || ': ' || coalesce(v_driver, 'Your driver') || ' has arrived at ' || v_pickup || '.', '/portal/', v_tag);
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Driver at pickup', coalesce(v_driver, 'Your driver') || ' has arrived at ' || v_pickup || '.', null, v_tag);
    v_dist := public._push_distance_m(new.driver_arrived_pickup_lat, new.driver_arrived_pickup_lng, new.pickup_lat, new.pickup_lng);
    if v_dist > 1000 then
      perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
        'Arrival far from pickup', v_ref || ': ' || coalesce(v_driver, 'Driver') || ' confirmed arrival ' || round((v_dist / 1000)::numeric, 1) || ' km from the pickup pin.', '/dashboard', v_tag || ':far');
    end if;
  end if;

  -- Arrived at drop-off (staff only).
  if new.driver_arrived_delivery_at is not null and old.driver_arrived_delivery_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Driver arrived at drop-off', v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' at ' || v_dropoff, '/dashboard', v_tag);
    v_dist := public._push_distance_m(new.driver_arrived_delivery_lat, new.driver_arrived_delivery_lng, new.delivery_lat, new.delivery_lng);
    if v_dist > 1000 then
      perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
        'Arrival far from drop-off', v_ref || ': ' || coalesce(v_driver, 'Driver') || ' confirmed arrival ' || round((v_dist / 1000)::numeric, 1) || ' km from the drop-off pin.', '/dashboard', v_tag || ':far');
    end if;
  end if;

  -- Picked up.
  if new.driver_pickup_at is not null and old.driver_pickup_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Picked up', v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' collected the package, heading to ' || v_dropoff, '/dashboard', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Picked up', v_ref || ': on its way to ' || v_dropoff || '.', '/portal/', v_tag);
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Picked up', 'Your package is on its way to ' || v_dropoff || '.', null, v_tag);
  end if;

  -- Delivered.
  if new.driver_delivery_at is not null and old.driver_delivery_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Delivered', v_ref || ' · delivered to ' || v_dropoff, '/dashboard', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Delivered', v_ref || ' was delivered to ' || v_dropoff || '.', '/portal/', v_tag);
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Delivered', 'Your package was delivered to ' || v_dropoff || '.', null, v_tag);
  end if;

  -- Returned (critical for dispatch).
  if new.status = 'returned' and old.status is distinct from 'returned' then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Package returned', v_ref || ' · ' || coalesce(v_driver, 'Driver') || coalesce(': ' || nullif(btrim(new.return_reason), ''), ''), '/dashboard', v_tag || ':returned');
  end if;

  return null;
end $function$;

-- ---------------------------------------------------------------------------
-- The update trigger only fires for listed columns; add the pickup window so
-- changing it sends the driver "Job updated".
-- ---------------------------------------------------------------------------
drop trigger if exists push_on_job_update on public.jobs;
create trigger push_on_job_update
  after update on public.jobs
  for each row
  when (old.driver_id is distinct from new.driver_id
     or old.status is distinct from new.status
     or old.pickup_location is distinct from new.pickup_location
     or old.delivery_location is distinct from new.delivery_location
     or old.scheduled_pickup_at is distinct from new.scheduled_pickup_at
     or old.pickup_window_start is distinct from new.pickup_window_start
     or old.pickup_window_end is distinct from new.pickup_window_end
     or old.scheduled_delivery_start is distinct from new.scheduled_delivery_start
     or old.scheduled_delivery_end is distinct from new.scheduled_delivery_end
     or old.special_instructions is distinct from new.special_instructions
     or old.driver_arrived_pickup_at is distinct from new.driver_arrived_pickup_at
     or old.driver_arrived_delivery_at is distinct from new.driver_arrived_delivery_at
     or old.driver_pickup_at is distinct from new.driver_pickup_at
     or old.driver_delivery_at is distinct from new.driver_delivery_at)
  execute function public._push_on_job();
