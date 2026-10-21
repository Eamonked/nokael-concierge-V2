-- =============================================================================
-- Nokael — driver reminder state off the jobs table (21 Oct 2026)
-- Project: hhgzxpuzsbqirmbsiltn
--
-- supabase-driver-window-reminders.sql kept the reminder job's ETA cache and
-- "sent for" markers on public.jobs. Every write there bumped jobs.updated_at,
-- ran the driver-status trigger and (jobs is in the realtime publication) made
-- every open dashboard refetch all jobs — every few minutes per job near its
-- window. They now live in job_reminder_state, which nothing else watches.
--
-- reminder_candidates / reminder_cache_eta / reminder_send keep their names and
-- arguments, so the driver-reminders Edge Function is unchanged. The old jobs
-- columns were never written (no window was due yet) and are dropped.
-- Safe to run more than once.
-- =============================================================================

create table if not exists public.job_reminder_state (
  job_id         uuid not null references public.jobs (id) on delete cascade,
  leg            text not null check (leg in ('pickup', 'delivery')),
  leave_sent_for timestamptz,   -- window start a "leave now" / "be there by" was sent for
  late_alert_for timestamptz,   -- window start the staff late alert was sent for
  eta_seconds    integer,       -- last traffic-aware drive time (Mapbox)
  eta_checked_at timestamptz,
  primary key (job_id, leg)
);
-- Service role only (the Edge Function); no policies on purpose.
alter table public.job_reminder_state enable row level security;

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
    select j.id, j.organization_id, j.driver_id, j.status, 'pickup'::text as leg,
           coalesce(j.pickup_window_start, j.scheduled_pickup_at) as target,
           j.pickup_lat as dest_lat, j.pickup_lng as dest_lng
      from public.jobs j
     where j.driver_pickup_at is null and j.driver_arrived_pickup_at is null
    union all
    select j.id, j.organization_id, j.driver_id, j.status, 'delivery', j.scheduled_delivery_start,
           j.delivery_lat, j.delivery_lng
      from public.jobs j
     where j.driver_pickup_at is not null
       and j.driver_arrived_delivery_at is null and j.driver_delivery_at is null
  )
  select l.id, l.leg, l.target, l.dest_lat, l.dest_lng,
         case when t.is_tracking_active and t.last_location_update_at > now() - interval '5 minutes' then t.last_known_lat end,
         case when t.is_tracking_active and t.last_location_update_at > now() - interval '5 minutes' then t.last_known_lng end,
         coalesce(nullif(public.org_setting(l.organization_id, 'reminder_buffer_min'), '')::integer, 15),
         s.leave_sent_for is not distinct from l.target,
         s.late_alert_for is not distinct from l.target,
         case when s.eta_checked_at > now() - interval '5 minutes' then s.eta_seconds end
    from legs l
    left join public.job_reminder_state s on s.job_id = l.id and s.leg = l.leg
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
  insert into public.job_reminder_state (job_id, leg, eta_seconds, eta_checked_at)
  values (p_job, p_leg, p_seconds, now())
  on conflict (job_id, leg) do update
    set eta_seconds = excluded.eta_seconds, eta_checked_at = excluded.eta_checked_at;
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
  v_marked boolean;
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
    insert into public.job_reminder_state as s (job_id, leg, late_alert_for)
    values (p_job, p_leg, p_target)
    on conflict (job_id, leg) do update set late_alert_for = excluded.late_alert_for
      where s.late_alert_for is distinct from excluded.late_alert_for
    returning true into v_marked;
  else
    insert into public.job_reminder_state as s (job_id, leg, leave_sent_for)
    values (p_job, p_leg, p_target)
    on conflict (job_id, leg) do update set leave_sent_for = excluded.leave_sent_for
      where s.leave_sent_for is distinct from excluded.leave_sent_for
    returning true into v_marked;
  end if;
  if v_marked is not true then
    return false;
  end if;

  select * into j from public.jobs where id = p_job;
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

-- The old per-job columns (never written).
alter table public.jobs
  drop column if exists pickup_leave_sent_for,
  drop column if exists delivery_leave_sent_for,
  drop column if exists pickup_late_alert_for,
  drop column if exists delivery_late_alert_for,
  drop column if exists eta_leg,
  drop column if exists eta_seconds,
  drop column if exists eta_checked_at;
