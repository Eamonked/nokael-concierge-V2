-- Waiting time (2026-11-07)
--
-- Times how long the driver waits for the client at pickup and at every drop,
-- tells the client, and charges it after the free minutes.
--
--   * job_waits: one row per waiting point (one-way pickup / drop-off, or a
--     job_stops row). Opened when the driver arrives, closed at handover
--     (or skip / cancel / return / completion).
--   * Clock starts at max(arrival, window start): arriving early doesn't
--     start the client's clock.
--   * Policy in organizations.settings.waiting = {enabled, free_min,
--     block_min, block_aed}; defaults 15 free, then 25 per started 15 min.
--     It is copied onto the row when the wait opens, so changing the policy
--     never re-prices waits already running.
--   * Charge = ceil(max(0, whole minutes - free) / block) * block amount.
--     Closed waits add up into jobs.waiting_charge_aed (dispatch can adjust
--     a wait with ops_wait_adjust, reason required, logged in operator_notes).
--   * Pushes: arrival with the free time and rate to that point's client
--     link; waits_tick (pg_cron, every minute) warns client + staff once the
--     free time is over.
--   * push_outbox.party_token targets one client link (sender, recipient
--     or a stop) instead of every tracking subscriber of the job.
--   * get_job_by_token ends with waits + waiting_policy.
--   * Delivered tracking push asks for a rating and opens the review popup
--     (?review=1).
--
-- Driver/ops RPCs are not changed: everything hangs off triggers on the
-- columns they already write.

begin;

-- ─── Policy ─────────────────────────────────────────────────────────────
create or replace function public._wait_policy(p_org uuid)
returns jsonb
language sql stable security definer
set search_path to 'public'
as $$
  select jsonb_build_object('enabled', true, 'free_min', 15, 'block_min', 15, 'block_aed', 25)
         || coalesce((select case when jsonb_typeof(o.settings -> 'waiting') = 'object' then o.settings -> 'waiting' end
                        from public.organizations o where o.id = p_org), '{}'::jsonb)
         || jsonb_build_object('currency',
              coalesce((select nullif(o.settings ->> 'currency', '') from public.organizations o where o.id = p_org), 'AED'));
$$;

-- ─── Table ──────────────────────────────────────────────────────────────
create table if not exists public.job_waits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  stop_id uuid references public.job_stops(id) on delete cascade,
  leg text not null check (leg in ('pickup', 'dropoff', 'stop')),
  seq integer not null default 1,
  arrived_at timestamptz not null,
  clock_start timestamptz not null,
  ended_at timestamptz,
  end_reason text check (end_reason in ('handover', 'skipped', 'cancelled', 'returned', 'completed')),
  arrived_lat double precision,
  arrived_lng double precision,
  distance_m double precision,
  free_min integer not null,
  block_min integer not null check (block_min >= 1),
  block_aed numeric not null,
  currency text not null default 'AED',
  wait_min integer,
  charge_aed numeric,
  warned_at timestamptz,
  adjusted_charge_aed numeric check (adjusted_charge_aed >= 0),
  adjusted_by uuid,
  adjusted_at timestamptz,
  adjust_reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists job_waits_leg_uq on public.job_waits (job_id, leg) where stop_id is null;
create unique index if not exists job_waits_stop_uq on public.job_waits (stop_id) where stop_id is not null;
create index if not exists job_waits_open_idx on public.job_waits (clock_start) where ended_at is null;

alter table public.job_waits enable row level security;
drop policy if exists job_waits_member_read on public.job_waits;
create policy job_waits_member_read on public.job_waits
  for select to authenticated using (public.is_org_member(organization_id));
grant select on public.job_waits to authenticated;

alter table public.jobs add column if not exists waiting_charge_aed numeric not null default 0;

-- ─── Maths ──────────────────────────────────────────────────────────────
-- Whole minutes waited (rounded down: 15 min 40 s is still free).
create or replace function public._wait_minutes(p_start timestamptz, p_end timestamptz)
returns integer language sql immutable as $$
  select greatest(0, floor(extract(epoch from (p_end - p_start)) / 60))::integer;
$$;

create or replace function public._wait_charge(p_min integer, p_free integer, p_block integer, p_amount numeric)
returns numeric language sql immutable as $$
  select (ceil(greatest(0, p_min - p_free)::numeric / greatest(p_block, 1)) * p_amount)::numeric;
$$;

-- Sum of closed waits (dispatch's adjusted amount wins) onto the job.
create or replace function public._wait_total(p_job uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v numeric;
begin
  select coalesce(sum(coalesce(adjusted_charge_aed, charge_aed)), 0) into v
    from public.job_waits where job_id = p_job and ended_at is not null;
  update public.jobs set waiting_charge_aed = v
   where id = p_job and waiting_charge_aed is distinct from v;
end $$;

-- ─── Party targeting for tracking pushes ───────────────────────────────
alter table public.push_outbox add column if not exists party_token text;

create or replace function public.push_enqueue_party(p_org uuid, p_job uuid, p_party_token text,
  p_title text, p_body text, p_url text default null, p_tag text default null)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.push_outbox (audience, organization_id, job_id, title, body, url, tag, party_token)
  select 'tracking', p_org, p_job, left(p_title, 120), left(p_body, 300), p_url, p_tag, p_party_token
   where p_job is not null;
$$;

-- Tracking links: party_token limits the push to that client's link (plus the
-- job's shared tracking token); the URL keeps ?for=recipient for the
-- recipient's link and appends a '?…' outbox url (e.g. ?review=1).
create or replace function public.push_targets(p_outbox bigint)
returns table(subscription_id uuid, channel text, endpoint text, p256dh text, auth text, url text)
language sql security definer set search_path to 'public'
as $$
  select s.id, s.channel, s.endpoint, s.p256dh, s.auth,
         case when s.audience = 'tracking' then
           '/' || s.link_token || '/track' || coalesce('?' || nullif(concat_ws('&',
             case when j.token_client_delivery::text = s.link_token then 'for=recipient' end,
             case when o.url like '?%' then nullif(substr(o.url, 2), '') end), ''), '')
         else o.url end
    from public.push_outbox o
    join public.push_subscriptions s on s.audience = o.audience
    left join public.jobs j on j.id = o.job_id
   where o.id = p_outbox
     and case o.audience
       when 'driver' then s.driver_id = o.driver_id
       when 'staff' then s.organization_id = o.organization_id
         and exists (select 1 from public.org_members m where m.user_id = s.user_id and m.organization_id = o.organization_id)
       when 'client' then s.business_id = o.business_id
         and exists (select 1 from public.client_members m where m.user_id = s.user_id and m.business_id = o.business_id)
       when 'tracking' then s.job_id = o.job_id
         and (o.party_token is null or s.link_token = o.party_token or s.link_token = j.tracking_token)
     end;
$$;

-- ─── Open / close ───────────────────────────────────────────────────────
-- 25 → '25', 12.5 → '12.50'
create or replace function public._fmt_amount(p numeric)
returns text language sql immutable as $$
  select case when p = trunc(p) then trunc(p)::bigint::text else to_char(p, 'FM999999990.00') end;
$$;

create or replace function public._wait_rate_text(p jsonb)
returns text language sql immutable as $$
  select (p ->> 'free_min') || ' min free waiting, then ' || (p ->> 'currency') || ' '
         || public._fmt_amount((p ->> 'block_aed')::numeric)
         || ' per ' || (p ->> 'block_min') || ' min';
$$;

create or replace function public._wait_open(p_job public.jobs, p_stop public.job_stops, p_leg text,
  p_arrived timestamptz, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_pol jsonb := public._wait_policy(p_job.organization_id);
  v_window timestamptz;
  v_pin_lat double precision;
  v_pin_lng double precision;
  v_token text;
  v_place text;
  v_seq integer := 1;
  v_driver text := (select coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), 'Your driver') from public.drivers where id = p_job.driver_id);
  v_body text;
begin
  if p_leg = 'pickup' then
    v_window := coalesce(p_job.pickup_window_start, p_job.scheduled_pickup_at);
    v_pin_lat := p_job.pickup_lat; v_pin_lng := p_job.pickup_lng;
    v_token := p_job.token_client_pickup::text;
    v_place := public._push_place(p_job.pickup_location);
  elsif p_leg = 'dropoff' then
    v_window := p_job.scheduled_delivery_start;
    v_pin_lat := p_job.delivery_lat; v_pin_lng := p_job.delivery_lng;
    v_token := p_job.token_client_delivery::text;
    v_place := public._push_place(p_job.delivery_location);
  else
    v_window := p_stop.window_start;
    v_pin_lat := p_stop.lat; v_pin_lng := p_stop.lng;
    v_token := p_stop.token::text;
    v_place := public._push_place(p_stop.address);
    v_seq := p_stop.seq;
  end if;

  v_body := coalesce(v_driver, 'Your driver') || ' has arrived at ' || v_place || '.';

  if coalesce((v_pol ->> 'enabled')::boolean, true) then
    insert into public.job_waits (organization_id, job_id, stop_id, leg, seq, arrived_at, clock_start,
      arrived_lat, arrived_lng, distance_m, free_min, block_min, block_aed, currency)
    values (p_job.organization_id, p_job.id, p_stop.id, p_leg, v_seq, p_arrived,
      greatest(p_arrived, coalesce(v_window, p_arrived)),
      p_lat, p_lng, public._push_distance_m(p_lat, p_lng, v_pin_lat, v_pin_lng),
      (v_pol ->> 'free_min')::integer, (v_pol ->> 'block_min')::integer,
      (v_pol ->> 'block_aed')::numeric, coalesce(nullif(p_job.currency, ''), v_pol ->> 'currency'))
    on conflict do nothing;
    v_body := v_body || ' ' || public._wait_rate_text(v_pol) || '.';
    if v_window > p_arrived then
      v_body := v_body || ' Waiting time counts from ' || public._push_clock(p_job.organization_id, v_window) || '.';
    end if;
  end if;

  perform public.push_enqueue_party(p_job.organization_id, p_job.id, v_token,
    case when p_leg = 'pickup' then 'Driver at pickup' when p_leg = 'dropoff' then 'Driver has arrived' else 'Driver at stop ' || v_seq end,
    v_body, null, 'job:' || p_job.id || ':wait');
end $$;

create or replace function public._wait_close(p_wait uuid, p_at timestamptz, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare w public.job_waits%rowtype;
begin
  select * into w from public.job_waits where id = p_wait and ended_at is null for update;
  if not found then return; end if;
  update public.job_waits
     set ended_at = p_at,
         end_reason = p_reason,
         wait_min = public._wait_minutes(w.clock_start, p_at),
         charge_aed = public._wait_charge(public._wait_minutes(w.clock_start, p_at), w.free_min, w.block_min, w.block_aed)
   where id = p_wait;
  perform public._wait_total(w.job_id);
end $$;

-- ─── Triggers ───────────────────────────────────────────────────────────
create or replace function public._waits_on_job()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  -- Multi-stop jobs: the flat columns are a mirror; job_stops drives waits.
  if new.job_kind = 'one_way' then
    perform public._waits_one_way(old, new);
  end if;

  -- Then cancel / return / completion closes whatever is still open (stops
  -- too). Handover closes run first, so a delivery that also completes the
  -- job closes its wait as a handover at the handover time.
  if new.status is distinct from old.status and new.status in ('cancelled', 'returned', 'completed') then
    for r in select id from public.job_waits where job_id = new.id and ended_at is null loop
      perform public._wait_close(r.id, now(), new.status::text);
    end loop;
  end if;
  return null;
end $$;

create or replace function public._waits_one_way(o public.jobs, n public.jobs)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  -- Arrival undone (dispatch cleared it): drop the open wait for that leg.
  if o.driver_arrived_pickup_at is not null and n.driver_arrived_pickup_at is null then
    delete from public.job_waits where job_id = n.id and leg = 'pickup' and ended_at is null;
  end if;
  if o.driver_arrived_delivery_at is not null and n.driver_arrived_delivery_at is null then
    delete from public.job_waits where job_id = n.id and leg = 'dropoff' and ended_at is null;
  end if;

  if n.driver_arrived_pickup_at is not null and o.driver_arrived_pickup_at is null
     and o.driver_pickup_at is null and o.client_pickup_at is null then
    perform public._wait_open(n, null, 'pickup', n.driver_arrived_pickup_at,
      n.driver_arrived_pickup_lat, n.driver_arrived_pickup_lng);
  end if;
  if (n.driver_pickup_at is not null and o.driver_pickup_at is null)
     or (n.client_pickup_at is not null and o.client_pickup_at is null) then
    for r in select id from public.job_waits where job_id = n.id and leg = 'pickup' and ended_at is null loop
      perform public._wait_close(r.id, coalesce(least(n.driver_pickup_at, n.client_pickup_at), now()), 'handover');
    end loop;
  end if;

  if n.driver_arrived_delivery_at is not null and o.driver_arrived_delivery_at is null
     and o.driver_delivery_at is null and o.client_delivery_at is null then
    perform public._wait_open(n, null, 'dropoff', n.driver_arrived_delivery_at,
      n.driver_arrived_delivery_lat, n.driver_arrived_delivery_lng);
  end if;
  if (n.driver_delivery_at is not null and o.driver_delivery_at is null)
     or (n.client_delivery_at is not null and o.client_delivery_at is null) then
    for r in select id from public.job_waits where job_id = n.id and leg = 'dropoff' and ended_at is null loop
      perform public._wait_close(r.id, coalesce(least(n.driver_delivery_at, n.client_delivery_at), now()), 'handover');
    end loop;
  end if;
end $$;

drop trigger if exists trg_waits_on_job on public.jobs;
create trigger trg_waits_on_job
  after update of status, driver_arrived_pickup_at, driver_arrived_delivery_at,
    driver_pickup_at, client_pickup_at, driver_delivery_at, client_delivery_at
  on public.jobs for each row execute function public._waits_on_job();

create or replace function public._waits_on_stop()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  j public.jobs%rowtype;
  r record;
begin
  if old.arrived_at is not null and new.arrived_at is null then
    delete from public.job_waits where stop_id = new.id and ended_at is null;
  end if;
  if new.arrived_at is not null and old.arrived_at is null and old.handed_at is null and old.skipped_at is null then
    select * into j from public.jobs where id = new.job_id;
    if j.status not in ('completed', 'cancelled', 'returned') then
      perform public._wait_open(j, new, 'stop', new.arrived_at, new.arrived_lat, new.arrived_lng);
    end if;
  end if;
  if (new.handed_at is not null and old.handed_at is null) or (new.skipped_at is not null and old.skipped_at is null) then
    for r in select id from public.job_waits where stop_id = new.id and ended_at is null loop
      perform public._wait_close(r.id, coalesce(new.handed_at, new.skipped_at, now()),
        case when new.handed_at is not null then 'handover' else 'skipped' end);
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists trg_waits_on_stop on public.job_stops;
create trigger trg_waits_on_stop
  after update of arrived_at, handed_at, skipped_at
  on public.job_stops for each row execute function public._waits_on_stop();

-- ─── Free time over: warn once (pg_cron, every minute) ─────────────────
create or replace function public.waits_tick()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  w record;
  n integer := 0;
  v_place text;
  v_token text;
  v_rate text;
begin
  for w in
    select jw.*, j.job_ref, j.organization_id as org, j.pickup_location, j.delivery_location,
           j.token_client_pickup, j.token_client_delivery, s.token as stop_token, s.address as stop_address
      from public.job_waits jw
      join public.jobs j on j.id = jw.job_id
      left join public.job_stops s on s.id = jw.stop_id
     where jw.ended_at is null and jw.warned_at is null
       and jw.clock_start + make_interval(mins => jw.free_min) <= now()
       and j.status not in ('completed', 'cancelled', 'returned')
     for update of jw skip locked
  loop
    v_place := public._push_place(case w.leg when 'pickup' then w.pickup_location when 'dropoff' then w.delivery_location else w.stop_address end);
    v_token := case w.leg when 'pickup' then w.token_client_pickup::text when 'dropoff' then w.token_client_delivery::text else w.stop_token::text end;
    v_rate := w.currency || ' ' || public._fmt_amount(w.block_aed) || ' per ' || w.block_min || ' min';
    update public.job_waits set warned_at = now() where id = w.id;
    perform public.push_enqueue_party(w.org, w.job_id, v_token,
      'Free waiting time is over',
      'The driver is still waiting at ' || v_place || '. Waiting is now charged at ' || v_rate || '.',
      null, 'job:' || w.job_id || ':wait');
    perform public.push_enqueue('staff', w.org, null, null, w.job_id,
      'Driver waiting',
      coalesce(w.job_ref, left(w.job_id::text, 8)) || ' · waiting ' || public._wait_minutes(w.clock_start, now())
        || ' min at ' || case w.leg when 'pickup' then 'pickup' when 'dropoff' then 'drop-off' else 'stop ' || w.seq end
        || ' (' || v_place || '). Charged waiting has started.',
      '/dashboard', 'job:' || w.job_id || ':wait');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.waits_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'waits-tick') then
    perform cron.unschedule('waits-tick');
  end if;
  perform cron.schedule('waits-tick', '* * * * *', 'select public.waits_tick()');
end $$;

-- ─── Dispatch: waive / adjust ───────────────────────────────────────────
create or replace function public.ops_wait_adjust(p_job uuid, p_wait uuid, p_charge numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  j public.jobs%rowtype;
  w public.job_waits%rowtype;
  v_tz text;
  v_label text;
begin
  select * into j from public.jobs where id = p_job;
  if not found or not public.is_org_member(j.organization_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into w from public.job_waits where id = p_wait and job_id = p_job for update;
  if not found then raise exception 'wait_not_found'; end if;
  if w.ended_at is null then raise exception 'wait_still_running'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;
  if p_charge is null or p_charge < 0 then raise exception 'charge_invalid'; end if;

  update public.job_waits
     set adjusted_charge_aed = case when p_charge = charge_aed then null else p_charge end,
         adjusted_by = auth.uid(), adjusted_at = now(), adjust_reason = btrim(p_reason)
   where id = p_wait;
  perform public._wait_total(p_job);

  v_tz := coalesce(nullif(public.org_setting(j.organization_id, 'timezone'), ''), 'Asia/Dubai');
  v_label := case w.leg when 'pickup' then 'Pickup' when 'dropoff' then 'Drop-off' else 'Stop ' || w.seq end;
  update public.jobs
     set operator_notes = nullif(concat_ws(E'\n', nullif(operator_notes, ''),
           '[' || to_char(now() at time zone v_tz, 'HH24:MI') || '] ' || v_label || ' waiting '
           || case when p_charge = 0 then 'waived' else 'set to ' || w.currency || ' ' || public._fmt_amount(p_charge) end
           || ' (was ' || w.currency || ' ' || public._fmt_amount(coalesce(w.adjusted_charge_aed, w.charge_aed)) || ') — ' || btrim(p_reason)), '')
   where id = p_job;

  return (select to_jsonb(x) from public.job_waits x where x.id = p_wait);
end $$;

grant execute on function public.ops_wait_adjust(uuid, uuid, numeric, text) to authenticated;

-- ─── Client view ────────────────────────────────────────────────────────
-- No GPS, no adjuster: what the client needs to see the clock and the charge.
create or replace function public.job_waits_json(p_job uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', w.id, 'leg', w.leg, 'seq', w.seq, 'stop_id', w.stop_id,
      'arrived_at', w.arrived_at, 'clock_start', w.clock_start,
      'ended_at', w.ended_at, 'end_reason', w.end_reason,
      'free_min', w.free_min, 'block_min', w.block_min, 'block_aed', w.block_aed, 'currency', w.currency,
      'wait_min', w.wait_min,
      'charge_aed', case when w.ended_at is not null then coalesce(w.adjusted_charge_aed, w.charge_aed) end,
      'waived', w.ended_at is not null and w.adjusted_charge_aed = 0 and w.charge_aed > 0
    ) order by w.seq, w.arrived_at), '[]'::jsonb)
  from public.job_waits w where w.job_id = p_job;
$$;

drop function if exists public.get_job_by_token(text);
create function public.get_job_by_token(p_token text)
 RETURNS TABLE(id uuid, job_ref text, status job_status, confirmation_mode text, sender_name text, sender_phone text, recipient_name text, recipient_phone text, pickup_emirate text, pickup_location text, delivery_emirate text, delivery_location text, pickup_lat double precision, pickup_lng double precision, delivery_lat double precision, delivery_lng double precision, item_type item_type, urgency urgency_level, company_name text, driver_id uuid, driver_lat double precision, driver_lng double precision, driver_updated_at timestamp with time zone, locked boolean, cancellation_reason text, cancelled_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, client_pickup_at timestamp with time zone, driver_pickup_at timestamp with time zone, driver_delivery_at timestamp with time zone, client_delivery_at timestamp with time zone, client_pickup_confirmed_at timestamp with time zone, driver_pickup_confirmed_at timestamp with time zone, driver_delivery_confirmed_at timestamp with time zone, client_delivery_confirmed_at timestamp with time zone, driver_arrived_pickup_at timestamp with time zone, driver_arrived_delivery_at timestamp with time zone, sender_ready_at timestamp with time zone, scheduled_pickup_at timestamp with time zone, otp_own character, token_driver_pickup uuid, token_driver_delivery uuid, pickup_window_start timestamp with time zone, pickup_window_end timestamp with time zone, delivery_window_start timestamp with time zone, delivery_window_end timestamp with time zone, tracking_opens_at timestamp with time zone, job_kind text, stops jsonb, waits jsonb, waiting_policy jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_is_driver boolean := false;
  v_open boolean;
  v_viewer uuid;
  v_otp character(6);
  v_pol jsonb;
BEGIN
  SELECT * INTO v_job FROM public.jobs j
  WHERE j.token_client_pickup::text = p_token
     OR j.token_driver_pickup::text = p_token
     OR j.token_driver_delivery::text = p_token
     OR j.token_client_delivery::text = p_token
     OR j.tracking_token = p_token;

  IF NOT FOUND THEN
    SELECT * INTO v_job FROM public.jobs j WHERE j.id = public._stop_link_job(p_token);
    IF NOT FOUND OR v_job.job_kind = 'one_way' THEN
      RETURN;
    END IF;
  END IF;

  v_is_driver := v_job.token_driver_pickup::text = p_token
              OR v_job.token_driver_delivery::text = p_token;

  IF NOT v_is_driver AND public.job_link_expired(v_job) AND NOT public.is_org_member(v_job.organization_id) THEN
    RAISE EXCEPTION 'link_expired';
  END IF;

  v_open := v_is_driver OR public.is_org_member(v_job.organization_id) OR public.job_tracking_open(v_job);

  IF v_job.job_kind <> 'one_way' AND NOT v_is_driver THEN
    v_viewer := public._try_uuid(p_token);
    SELECT s.otp INTO v_otp FROM public.job_stops s
     WHERE s.job_id = v_job.id AND s.token = v_viewer AND s.handed_at IS NULL
     ORDER BY s.seq LIMIT 1;
  END IF;

  v_pol := public._wait_policy(v_job.organization_id);

  RETURN QUERY SELECT
    v_job.id, v_job.job_ref, v_job.status, v_job.confirmation_mode,
    v_job.sender_name, v_job.sender_phone, v_job.recipient_name, v_job.recipient_phone,
    v_job.pickup_emirate, v_job.pickup_location,
    v_job.delivery_emirate, v_job.delivery_location,
    v_job.pickup_lat, v_job.pickup_lng, v_job.delivery_lat, v_job.delivery_lng,
    v_job.item_type, v_job.urgency, v_job.company_name,
    v_job.driver_id,
    CASE WHEN v_open THEN v_job.driver_lat END,
    CASE WHEN v_open THEN v_job.driver_lng END,
    CASE WHEN v_open THEN v_job.driver_updated_at END,
    v_job.locked, v_job.cancellation_reason, v_job.cancelled_at, v_job.created_at, v_job.updated_at,
    v_job.client_pickup_at, v_job.driver_pickup_at, v_job.driver_delivery_at, v_job.client_delivery_at,
    v_job.client_pickup_confirmed_at, v_job.driver_pickup_confirmed_at,
    v_job.driver_delivery_confirmed_at, v_job.client_delivery_confirmed_at,
    v_job.driver_arrived_pickup_at, v_job.driver_arrived_delivery_at,
    v_job.sender_ready_at, v_job.scheduled_pickup_at,
    CASE
      WHEN v_job.job_kind <> 'one_way' AND NOT v_is_driver THEN v_otp
      WHEN v_job.token_client_pickup::text = p_token THEN v_job.otp_sender
      WHEN v_job.token_driver_pickup::text = p_token THEN v_job.otp_driver_pickup
      WHEN v_job.token_driver_delivery::text = p_token THEN v_job.otp_driver_delivery
      WHEN v_job.token_client_delivery::text = p_token THEN v_job.otp_recipient
      ELSE NULL
    END,
    CASE WHEN v_is_driver THEN v_job.token_driver_pickup ELSE NULL END,
    CASE WHEN v_is_driver THEN v_job.token_driver_delivery ELSE NULL END,
    v_job.pickup_window_start, v_job.pickup_window_end,
    v_job.scheduled_delivery_start, v_job.scheduled_delivery_end,
    public.job_tracking_opens_at(v_job),
    v_job.job_kind,
    CASE WHEN v_job.job_kind <> 'one_way' THEN public.job_stops_json(v_job.id, v_viewer) END,
    public.job_waits_json(v_job.id),
    jsonb_build_object('enabled', coalesce((v_pol ->> 'enabled')::boolean, true),
      'free_min', (v_pol ->> 'free_min')::integer, 'block_min', (v_pol ->> 'block_min')::integer,
      'block_aed', (v_pol ->> 'block_aed')::numeric,
      'currency', coalesce(nullif(v_job.currency, ''), v_pol ->> 'currency'));
END;
$function$;

grant execute on function public.get_job_by_token(text) to anon, authenticated, service_role;

-- ─── Company settings: allow `waiting` ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_org_profile(p_org uuid, p_name text DEFAULT NULL::text, p_settings jsonb DEFAULT NULL::jsonb, p_branding jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed_settings text[] := ARRAY['country','currency','timezone','locale','dial_code','region_label',
    'regions','tax_label','tax_rate','job_ref_prefix','map_center','languages','geofence','onboarding',
    'price_same_day','price_dedicated','coc','waiting'];
  v_allowed_branding text[] := ARRAY['display_name','logo_url','primary_color','support_phone','whatsapp',
    'support_email','website'];
  v_settings jsonb;
  v_branding jsonb;
  v_w jsonb;
BEGIN
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only owners and admins can edit the company profile' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_settings
  FROM jsonb_each(coalesce(p_settings, '{}'::jsonb)) WHERE key = ANY (v_allowed_settings);
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_branding
  FROM jsonb_each(coalesce(p_branding, '{}'::jsonb)) WHERE key = ANY (v_allowed_branding);

  IF v_settings ? 'job_ref_prefix'
     AND (v_settings ->> 'job_ref_prefix') !~ '^[A-Z0-9]{2,5}$' THEN
    RAISE EXCEPTION 'Job reference prefix must be 2–5 capital letters or digits';
  END IF;

  IF v_settings ? 'coc' AND (
       jsonb_typeof(v_settings -> 'coc') <> 'object'
       OR length((v_settings -> 'coc')::text) > 8000) THEN
    RAISE EXCEPTION 'COC template must be an object under 8 KB';
  END IF;

  IF v_settings ? 'waiting' THEN
    v_w := v_settings -> 'waiting';
    IF jsonb_typeof(v_w) <> 'object'
       OR jsonb_typeof(v_w -> 'enabled') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(v_w -> 'free_min') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_w -> 'block_min') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_w -> 'block_aed') IS DISTINCT FROM 'number'
       OR (v_w ->> 'free_min')::numeric NOT BETWEEN 0 AND 600
       OR (v_w ->> 'block_min')::numeric NOT BETWEEN 1 AND 600
       OR (v_w ->> 'block_aed')::numeric NOT BETWEEN 0 AND 100000
       OR (v_w ->> 'free_min')::numeric <> trunc((v_w ->> 'free_min')::numeric)
       OR (v_w ->> 'block_min')::numeric <> trunc((v_w ->> 'block_min')::numeric) THEN
      RAISE EXCEPTION 'Waiting time: whole minutes (free 0–600, block 1–600) and a charge of 0 or more';
    END IF;
    v_settings := v_settings || jsonb_build_object('waiting', jsonb_build_object(
      'enabled', v_w -> 'enabled', 'free_min', v_w -> 'free_min',
      'block_min', v_w -> 'block_min', 'block_aed', v_w -> 'block_aed'));
  END IF;

  UPDATE public.organizations o
  SET name = coalesce(nullif(btrim(p_name), ''), o.name),
      settings = coalesce(o.settings, '{}'::jsonb)
        || (v_settings - 'onboarding')
        || CASE WHEN v_settings ? 'onboarding'
             THEN jsonb_build_object('onboarding',
                    coalesce(o.settings -> 'onboarding', '{}'::jsonb) || (v_settings -> 'onboarding'))
             ELSE '{}'::jsonb END,
      branding = coalesce(o.branding, '{}'::jsonb) || v_branding
  WHERE o.id = p_org;

  RETURN (SELECT jsonb_build_object('id', id, 'name', name, 'slug', slug, 'settings', settings, 'branding', branding)
          FROM public.organizations WHERE id = p_org);
END;
$function$;

-- ─── Pushes: arrival moves to _wait_open; Delivered asks for a rating ──
-- (Same as live, with two changes marked "waiting-time".)
CREATE OR REPLACE FUNCTION public._push_on_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'Driver assigned',
      case when v_start - interval '60 minutes' > now() then
        coalesce(v_driver, 'Your driver') || ' will collect your package. Live tracking starts '
        || case when v_start - interval '60 minutes' > now() + interval '12 hours'
             then to_char((v_start - interval '60 minutes') at time zone coalesce(nullif(public.org_setting(new.organization_id, 'timezone'), ''), 'Asia/Dubai'), 'Dy DD Mon') || ', '
             else '' end
        || public._push_clock(new.organization_id, v_start - interval '60 minutes') || '.'
      else coalesce(v_driver, 'Your driver') || ' is on the way to ' || v_pickup || '.' end,
      null, v_tag);
  end if;

  if v_is_new then
    return null;
  end if;

  if old.driver_id is not null and new.driver_id is distinct from old.driver_id
     and old.status not in ('completed', 'cancelled', 'returned') then
    perform public.push_enqueue('driver', new.organization_id, old.driver_id, null, new.id,
      'Job reassigned', v_ref || ' is no longer assigned to you.', '/driver-app/', v_tag);
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.driver_id is not null then
    perform public.push_enqueue('driver', new.organization_id, new.driver_id, null, new.id,
      'Job cancelled', v_ref || ' · ' || v_route || coalesce(' — ' || nullif(btrim(new.cancellation_reason), ''), ''), '/driver-app/', v_tag);
  end if;

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

  if new.driver_arrived_pickup_at is not null and old.driver_arrived_pickup_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Driver arrived at pickup', v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' at ' || v_pickup, '/dashboard', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Driver at pickup', v_ref || ': ' || coalesce(v_driver, 'Your driver') || ' has arrived at ' || v_pickup || '.', '/portal/', v_tag);
    -- waiting-time: the tracking-link arrival push (with the free waiting
    -- time and rate) is sent by _wait_open, to the sender's link only.
    v_dist := public._push_distance_m(new.driver_arrived_pickup_lat, new.driver_arrived_pickup_lng, new.pickup_lat, new.pickup_lng);
    if v_dist > 1000 then
      perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
        'Arrival far from pickup', v_ref || ': ' || coalesce(v_driver, 'Driver') || ' confirmed arrival ' || round((v_dist / 1000)::numeric, 1) || ' km from the pickup pin.', '/dashboard', v_tag || ':far');
    end if;
  end if;

  if new.job_kind = 'one_way' -- multi-stop guard
     and new.driver_arrived_delivery_at is not null and old.driver_arrived_delivery_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Driver arrived at drop-off', v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' at ' || v_dropoff, '/dashboard', v_tag);
    v_dist := public._push_distance_m(new.driver_arrived_delivery_lat, new.driver_arrived_delivery_lng, new.delivery_lat, new.delivery_lng);
    if v_dist > 1000 then
      perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
        'Arrival far from drop-off', v_ref || ': ' || coalesce(v_driver, 'Driver') || ' confirmed arrival ' || round((v_dist / 1000)::numeric, 1) || ' km from the drop-off pin.', '/dashboard', v_tag || ':far');
    end if;
  end if;

  if new.driver_pickup_at is not null and old.driver_pickup_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Picked up', v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' collected the package, heading to ' || v_dropoff, '/dashboard', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Picked up', v_ref || ': on its way to ' || v_dropoff || '.', '/portal/', v_tag);
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Picked up', 'Your package is on its way to ' || v_dropoff || '.', null, v_tag);
  end if;

  if new.job_kind = 'one_way' -- multi-stop guard 2
     and new.driver_delivery_at is not null and old.driver_delivery_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Delivered', v_ref || ' · delivered to ' || v_dropoff, '/dashboard', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Delivered', v_ref || ' was delivered to ' || v_dropoff || '.', '/portal/', v_tag);
    -- waiting-time: ask for a rating; ?review=1 opens the review popup.
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Delivered', 'Your package was delivered to ' || v_dropoff || '. Tap to rate your delivery.', '?review=1', v_tag);
  end if;

  if new.status = 'returned' and old.status is distinct from 'returned' then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Package returned', v_ref || ' · ' || coalesce(v_driver, 'Driver') || coalesce(': ' || nullif(btrim(new.return_reason), ''), ''), '/dashboard', v_tag || ':returned');
  end if;

  return null;
end $function$;

-- Multi-stop: stop 1 arrival used to reach tracking links via the jobs mirror
-- (now removed above); _wait_open sends every stop's arrival to its own link.
CREATE OR REPLACE FUNCTION public._push_stop_event(p_stop_id uuid, p_event text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s       public.job_stops%rowtype;
  j       public.jobs%rowtype;
  v_total integer;
  v_ref   text;
  v_place text;
  v_label text;
  v_driver text;
  v_tag   text;
  v_last  boolean;
begin
  select * into s from public.job_stops where id = p_stop_id;
  select * into j from public.jobs where id = s.job_id;
  if s.seq = 1 then
    return;
  end if;
  select count(*) into v_total from public.job_stops where job_id = s.job_id;
  v_ref := coalesce(j.job_ref, left(j.id::text, 8));
  v_place := public._push_place(s.address);
  v_label := 'stop ' || s.seq || ' of ' || v_total;
  v_driver := (select coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), 'Driver') from public.drivers where id = j.driver_id);
  v_tag := 'job:' || j.id;
  v_last := s.seq = v_total;

  if p_event = 'arrived' then
    perform public.push_enqueue('staff', j.organization_id, null, null, j.id,
      'Driver at ' || v_label, v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' at ' || v_place, '/dashboard', v_tag);
  elsif p_event = 'handed' then
    perform public.push_enqueue('staff', j.organization_id, null, null, j.id,
      case when v_last then 'Job complete' when s.kind = 'pickup' then 'Collected at ' || v_label else 'Delivered at ' || v_label end,
      v_ref || ' · ' || case when s.kind = 'pickup' then 'collected at ' else 'delivered to ' end || v_place, '/dashboard', v_tag);
    perform public.push_enqueue('client', j.organization_id, null, j.business_id, j.id,
      case when v_last then 'Delivered' when s.kind = 'pickup' then 'Collected' else 'Delivered' end,
      v_ref || ': ' || case when s.kind = 'pickup' then 'collected at ' else 'delivered to ' end || v_place
        || case when v_last then '. All stops done.' else ' (' || v_label || ').' end, '/portal/', v_tag);
    perform public.push_enqueue('tracking', j.organization_id, null, null, j.id,
      case when s.kind = 'pickup' then 'Collected' else 'Delivered' end,
      case when s.kind = 'pickup' then 'Collected at ' else 'Delivered to ' end || v_place
        || case when v_last then '. All stops are done. Tap to rate your delivery.' else ' (' || v_label || ').' end,
      case when v_last then '?review=1' end, v_tag);  -- waiting-time: rating prompt
  end if;
end;
$function$;

commit;
