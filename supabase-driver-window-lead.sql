-- Driver window lead (2026-11-07)
--
-- Drivers see every pickup / delivery / stop window earlier than the client
-- does, by organizations.settings.driver_lead_min (default 15, 0 turns it off):
-- client 14:00–16:00 → driver 13:45–15:45. A few minutes' delay then still
-- lands inside the client's window.
--
-- Driver-facing (shifted): driver_jobs (Android app), _driver_stops_json,
-- _driver_instructions text, the "New job assigned" push, the leave-now /
-- be-there-by reminders, and get_job_by_token for driver links.
-- Client-facing (unchanged): tracking/confirmation links, client pushes,
-- certificate, dashboard alerts, and the waiting clock (still starts at the
-- client's window, so arriving at the driver time is never charged).
--
-- The big live functions (driver_jobs, _push_on_job, reminder_send,
-- get_job_by_token, update_org_profile) are patched in place with checked
-- text replacements so nothing else in them changes; each replacement must
-- match exactly once or the migration aborts.

begin;

create or replace function public._driver_lead(p_org uuid)
returns interval language sql stable security definer set search_path to 'public' as $$
  select make_interval(mins => least(greatest(coalesce(
    (select case when jsonb_typeof(o.settings -> 'driver_lead_min') = 'number'
                 then (o.settings ->> 'driver_lead_min')::numeric end
       from public.organizations o where o.id = p_org), 15), 0), 120)::integer);
$$;

-- Patch helper: replace exactly one occurrence of p_old in a function body.
create or replace function pg_temp._patch(p_fn regprocedure, p_old text, p_new text)
returns void language plpgsql as $$
declare
  v_def text := pg_get_functiondef(p_fn);
  v_n integer := (length(v_def) - length(replace(v_def, p_old, ''))) / greatest(length(p_old), 1);
begin
  if v_n <> 1 then
    raise exception 'patch % matched % times: %', p_fn, v_n, left(p_old, 80);
  end if;
  execute replace(v_def, p_old, p_new);
end $$;

-- ─── Android app: driver_jobs ──────────────────────────────────────────
select pg_temp._patch('public.driver_jobs(text,integer)'::regprocedure,
  $o$'window_start', s.pickup_window_start, 'window_end', s.pickup_window_end),$o$,
  $n$'window_start', s.pickup_window_start - public._driver_lead(s.organization_id), 'window_end', s.pickup_window_end - public._driver_lead(s.organization_id)),$n$);
select pg_temp._patch('public.driver_jobs(text,integer)'::regprocedure,
  $o$'window_start', s.scheduled_delivery_start, 'window_end', s.scheduled_delivery_end),$o$,
  $n$'window_start', s.scheduled_delivery_start - public._driver_lead(s.organization_id), 'window_end', s.scheduled_delivery_end - public._driver_lead(s.organization_id)),$n$);
select pg_temp._patch('public.driver_jobs(text,integer)'::regprocedure,
  $o$'scheduled_pickup_at', s.scheduled_pickup_at,$o$,
  $n$'scheduled_pickup_at', s.scheduled_pickup_at - public._driver_lead(s.organization_id),$n$);

-- ─── Multi-stop stops for the driver ───────────────────────────────────
create or replace function public._driver_stops_json(p_job_id uuid, p_open boolean)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'seq', s.seq, 'kind', s.kind,
      'contact_name', s.contact_name,
      'contact_phone', case when p_open then s.contact_phone end,
      'address', s.address, 'emirate', s.emirate, 'lat', s.lat, 'lng', s.lng,
      'building', s.building, 'company', s.company, 'notes', s.notes, 'item_note', s.item_note,
      'window_start', s.window_start - l.lead, 'window_end', s.window_end - l.lead,
      'arrived_at', s.arrived_at, 'arrived_lat', s.arrived_lat, 'arrived_lng', s.arrived_lng,
      'handed_at', s.handed_at,
      'otp_locked', s.otp_attempts >= 5,
      'status', case when s.handed_at is not null then 'handed'
                     when s.arrived_at is not null then 'arrived' else 'pending' end
    ) order by s.seq), '[]'::jsonb)
  from public.job_stops s
  cross join lateral (select public._driver_lead(j.organization_id) as lead
                        from public.jobs j where j.id = p_job_id) l
  where s.job_id = p_job_id and s.skipped_at is null;
$function$;

-- ─── Instructions text ("window 07 Nov 13:45–15:45") ───────────────────
select pg_temp._patch('public._driver_instructions(public.jobs)'::regprocedure,
  $o$to_char(j.pickup_window_start at time zone (select zone from tz), 'DD Mon HH24:MI'),$o$,
  $n$to_char((j.pickup_window_start - public._driver_lead(j.organization_id)) at time zone (select zone from tz), 'DD Mon HH24:MI'),$n$);
select pg_temp._patch('public._driver_instructions(public.jobs)'::regprocedure,
  $o$to_char(j.pickup_window_end   at time zone (select zone from tz), 'DD Mon HH24:MI'))$o$,
  $n$to_char((j.pickup_window_end - public._driver_lead(j.organization_id)) at time zone (select zone from tz), 'DD Mon HH24:MI'))$n$);

-- ─── "New job assigned" push to the driver ─────────────────────────────
select pg_temp._patch('public._push_on_job()'::regprocedure,
  $o$  v_when text := '';$o$,
  $n$  v_when text := '';
  v_dstart timestamptz := coalesce(new.pickup_window_start, new.scheduled_pickup_at) - public._driver_lead(new.organization_id);$n$);
select pg_temp._patch('public._push_on_job()'::regprocedure,
  $o$    if v_start > now() and v_start <= now() + interval '3 hours' then
      v_when := '. Pickup window starts ' || public._push_clock(new.organization_id, v_start) || ', '
        || case when v_start <= now() + interval '1 hour' then 'under an hour from now'
                else public._push_in(extract(epoch from v_start - now())) || ' from now' end || '.';
    elsif v_start > now() then
      v_when := '. Pickup ' || to_char(v_start at time zone coalesce(nullif(public.org_setting(new.organization_id, 'timezone'), ''), 'Asia/Dubai'), 'Dy DD Mon')
        || ', ' || public._push_clock(new.organization_id, v_start) || '.';
    end if;$o$,
  $n$    if v_dstart > now() and v_dstart <= now() + interval '3 hours' then
      v_when := '. Be at pickup from ' || public._push_clock(new.organization_id, v_dstart) || ', '
        || case when v_dstart <= now() + interval '1 hour' then 'under an hour from now'
                else public._push_in(extract(epoch from v_dstart - now())) || ' from now' end || '.';
    elsif v_dstart > now() then
      v_when := '. Pickup ' || to_char(v_dstart at time zone coalesce(nullif(public.org_setting(new.organization_id, 'timezone'), ''), 'Asia/Dubai'), 'Dy DD Mon')
        || ', ' || public._push_clock(new.organization_id, v_dstart) || '.';
    end if;$n$);

-- ─── Leave-now / be-there-by reminders: aim at the driver time ─────────
create or replace function public.reminder_candidates()
 returns table(job_id uuid, leg text, target timestamp with time zone, dest_lat double precision, dest_lng double precision, driver_lat double precision, driver_lng double precision, buffer_min integer, leave_sent boolean, late_sent boolean, eta_seconds integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with legs as (
    select j.id, j.organization_id, j.driver_id, j.status, 'pickup'::text as leg,
           coalesce(j.pickup_window_start, j.scheduled_pickup_at) - public._driver_lead(j.organization_id) as target,
           j.pickup_lat as dest_lat, j.pickup_lng as dest_lng
      from public.jobs j
     where j.job_kind = 'one_way'
       and j.driver_pickup_at is null and j.driver_arrived_pickup_at is null
    union all
    select j.id, j.organization_id, j.driver_id, j.status, 'delivery',
           j.scheduled_delivery_start - public._driver_lead(j.organization_id),
           j.delivery_lat, j.delivery_lng
      from public.jobs j
     where j.job_kind = 'one_way'
       and j.driver_pickup_at is not null
       and j.driver_arrived_delivery_at is null and j.driver_delivery_at is null
    union all
    select j.id, j.organization_id, j.driver_id, j.status, 'stop:' || s.seq,
           s.window_start - public._driver_lead(j.organization_id), s.lat, s.lng
      from public.jobs j
      join lateral (select * from public.job_stops x where x.job_id = j.id and x.handed_at is null
                     order by x.seq limit 1) s on true
     where j.job_kind <> 'one_way'
       and s.arrived_at is null
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
$function$;

-- Staff late alert: say both times so dispatch knows whether the client is affected.
select pg_temp._patch('public.reminder_send(uuid,text,text,timestamp with time zone,integer)'::regprocedure,
  $o$        || ', window opens ' || v_at || ' at ' || v_place || '.',$o$,
  $n$        || ', due ' || v_at || ' (client window ' || public._push_clock(j.organization_id, p_target + public._driver_lead(j.organization_id)) || ') at ' || v_place || '.',$n$);

-- ─── Driver links (portal driver-pickup / driver-delivery pages) ───────
select pg_temp._patch('public.get_job_by_token(text)'::regprocedure,
  $o$    v_job.sender_ready_at, v_job.scheduled_pickup_at,$o$,
  $n$    v_job.sender_ready_at,
    v_job.scheduled_pickup_at - CASE WHEN v_is_driver THEN public._driver_lead(v_job.organization_id) ELSE interval '0' END,$n$);
select pg_temp._patch('public.get_job_by_token(text)'::regprocedure,
  $o$    v_job.pickup_window_start, v_job.pickup_window_end,
    v_job.scheduled_delivery_start, v_job.scheduled_delivery_end,$o$,
  $n$    v_job.pickup_window_start - CASE WHEN v_is_driver THEN public._driver_lead(v_job.organization_id) ELSE interval '0' END,
    v_job.pickup_window_end - CASE WHEN v_is_driver THEN public._driver_lead(v_job.organization_id) ELSE interval '0' END,
    v_job.scheduled_delivery_start - CASE WHEN v_is_driver THEN public._driver_lead(v_job.organization_id) ELSE interval '0' END,
    v_job.scheduled_delivery_end - CASE WHEN v_is_driver THEN public._driver_lead(v_job.organization_id) ELSE interval '0' END,$n$);

-- ─── Company settings: allow driver_lead_min (whole minutes 0–120) ─────
select pg_temp._patch('public.update_org_profile(uuid,text,jsonb,jsonb)'::regprocedure,
  $o$'price_same_day','price_dedicated','coc','waiting'];$o$,
  $n$'price_same_day','price_dedicated','coc','waiting','driver_lead_min'];$n$);
select pg_temp._patch('public.update_org_profile(uuid,text,jsonb,jsonb)'::regprocedure,
  $o$  UPDATE public.organizations o$o$,
  $n$  IF v_settings ? 'driver_lead_min' AND (
       jsonb_typeof(v_settings -> 'driver_lead_min') IS DISTINCT FROM 'number'
       OR (v_settings ->> 'driver_lead_min')::numeric NOT BETWEEN 0 AND 120
       OR (v_settings ->> 'driver_lead_min')::numeric <> trunc((v_settings ->> 'driver_lead_min')::numeric)) THEN
    RAISE EXCEPTION 'Driver lead time: whole minutes from 0 to 120';
  END IF;

  UPDATE public.organizations o$n$);

commit;
