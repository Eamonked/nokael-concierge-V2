-- =====================================================================
-- Migration A — driver pool: real sessions, event log, token-based driver RPCs
-- Project: hhgzxpuzsbqirmbsiltn (dubai-concierge)
-- STATUS: DRAFT — not applied, not tested on a branch. Apply as ONE migration (atomic).
--
-- Additive, except section 5 (replaces the driver-status trigger function and
-- narrows when the trigger fires). Nothing here revokes or alters legacy RPCs.
--
-- Decisions baked in:
--   * Day close = midnight Asia/Dubai. Used only to group get_driver_history.
--     No state, no cron.
--   * A driver cannot go offline while holding an active job (set_driver_online).
--     Operator override = reassign or cancel the job; section 5 frees the driver.
--   * No org check on the driver side. Authorization is:
--       session token -> driver -> jobs.driver_id = that driver.
--     Which org owns pool drivers only affects registration/matching, not this file.
--   * drivers.email stays NOT NULL; pool signup must collect it.
--
-- Why driver_login returns jsonb instead of raising on a wrong PIN:
--   verify_driver_pin increments pin_failed_attempts, but if the caller then RAISEs,
--   the whole RPC transaction rolls back and the increment is lost. Legacy
--   create_driver_session does exactly that, so wrong PINs there never count
--   toward the lockout. driver_login returns normally so the counter commits.
--
-- Open item, not covered here: the driver app has no sender/recipient phone numbers
-- in driver_active_jobs. Add them deliberately if NDP1 needs click-to-call.
--
-- Rollback: see the bottom of the file.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Sessions
-- ---------------------------------------------------------------------

create table public.driver_sessions (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references public.drivers(id) on delete cascade,
  token_hash   text not null unique,          -- sha256 hex of the bearer token; plaintext never stored
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz,
  device_label text
);

create index driver_sessions_active_idx
  on public.driver_sessions (driver_id)
  where revoked_at is null;

alter table public.driver_sessions enable row level security;   -- no policies: definer functions only
revoke all on public.driver_sessions from anon, authenticated;

-- Internal: resolve a bearer token to a driver id, or raise. Sliding 7-day expiry,
-- hard cap 30 days from creation. Driver must be active and approved.
create or replace function public._driver_from_session(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sess public.driver_sessions%rowtype;
  v_hash text;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'invalid_session' using errcode = '28000';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select s.* into v_sess
  from public.driver_sessions s
  join public.drivers d on d.id = s.driver_id
  where s.token_hash = v_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and d.active is true
    and d.onboarding_status = 'approved';

  if not found then
    raise exception 'invalid_session' using errcode = '28000';
  end if;

  if v_sess.last_seen_at < now() - interval '1 minute' then
    update public.driver_sessions
    set last_seen_at = now(),
        expires_at   = least(v_sess.created_at + interval '30 days', now() + interval '7 days')
    where id = v_sess.id;
  end if;

  return v_sess.driver_id;
end;
$$;

create or replace function public.driver_login(
  p_driver_id    uuid,
  p_pin          text,
  p_device_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_locked timestamptz;
  v_token  text;
  v_exp    timestamptz;
begin
  select d.pin_locked_until into v_locked
  from public.drivers d
  where d.id = p_driver_id
    and d.active is true
    and d.onboarding_status = 'approved';

  if not found then
    -- same answer as a wrong PIN: do not reveal whether the id exists
    return jsonb_build_object('ok', false, 'error', 'incorrect_pin');
  end if;

  if v_locked is not null and v_locked > now() then
    return jsonb_build_object(
      'ok', false,
      'error', 'locked',
      'retry_after_seconds', ceil(extract(epoch from (v_locked - now())))::int
    );
  end if;

  if not public.verify_driver_pin(p_driver_id, p_pin) then
    return jsonb_build_object('ok', false, 'error', 'incorrect_pin');
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_exp   := now() + interval '7 days';

  insert into public.driver_sessions (driver_id, token_hash, expires_at, device_label)
  values (
    p_driver_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_exp,
    left(p_device_label, 80)
  );

  update public.drivers set last_active_at = now() where id = p_driver_id;

  return jsonb_build_object('ok', true, 'token', v_token, 'expires_at', v_exp);
end;
$$;

create or replace function public.driver_logout(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.driver_sessions
  set revoked_at = now()
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and revoked_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

-- Housekeeping (run occasionally, not scheduled here):
--   delete from public.driver_sessions where expires_at < now() - interval '30 days';


-- ---------------------------------------------------------------------
-- 2. Append-only job_events, populated by a trigger on jobs
--    so legacy paths (confirm_job_step, update_job_by_token, ops dashboard)
--    are captured too. RPCs in section 3 pass actor/GPS via app.event_ctx.
-- ---------------------------------------------------------------------

create table public.job_events (
  id                 bigint generated always as identity primary key,
  job_id             uuid not null references public.jobs(id),
  organization_id    uuid,
  driver_id          uuid references public.drivers(id),
  event_type         text not null check (event_type in (
                       'created', 'assigned', 'unassigned',
                       'sender_ready', 'arrived_pickup', 'client_pickup_confirmed', 'picked_up',
                       'arrived_delivery', 'delivered', 'client_delivery_confirmed',
                       'completed', 'cancelled', 'otp_failed')),
  occurred_at        timestamptz not null default now(),   -- server time, authoritative
  actor              text not null,                        -- 'driver:<uuid>' | 'user:<uuid>' | 'unattributed'
  lat                double precision,
  lng                double precision,
  client_reported_at timestamptz,                          -- device clock, informational only
  meta               jsonb not null default '{}'::jsonb
);

create index job_events_job_idx    on public.job_events (job_id, occurred_at);
create index job_events_driver_idx on public.job_events (driver_id, occurred_at);

alter table public.job_events enable row level security;
create policy job_events_org_read on public.job_events
  for select using (public.is_org_member(organization_id));

revoke all on public.job_events from anon, authenticated;
grant select on public.job_events to authenticated;

create or replace function public.fn_job_events_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'job_events is append-only';
end;
$$;

create trigger trg_job_events_no_update_delete
  before update or delete on public.job_events
  for each row execute function public.fn_job_events_immutable();

create trigger trg_job_events_no_truncate
  before truncate on public.job_events
  for each statement execute function public.fn_job_events_immutable();

-- Internal: attach actor/GPS/device-time to events emitted later in this transaction.
create or replace function public._set_event_ctx(
  p_driver      uuid,
  p_lat         double precision default null,
  p_lng         double precision default null,
  p_client_time timestamptz      default null
)
returns void
language sql
security definer
set search_path = public
as $$
  select set_config(
    'app.event_ctx',
    jsonb_build_object(
      'actor', 'driver:' || p_driver::text,
      'lat', p_lat,
      'lng', p_lng,
      'client_time', p_client_time
    )::text,
    true   -- transaction-local
  );
$$;

create or replace function public.fn_job_events_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx    jsonb := coalesce(nullif(current_setting('app.event_ctx', true), '')::jsonb, '{}'::jsonb);
  v_uid    uuid  := auth.uid();
  v_actor  text  := coalesce(
                      v_ctx->>'actor',
                      case when v_uid is not null then 'user:' || v_uid::text else 'unattributed' end
                    );
  v_lat    double precision := (v_ctx->>'lat')::double precision;
  v_lng    double precision := (v_ctx->>'lng')::double precision;
  v_client timestamptz      := (v_ctx->>'client_time')::timestamptz;
  v_driver uuid;
  v_types  text[] := '{}';
  v_t      text;
begin
  if tg_op = 'INSERT' then
    v_driver := NEW.driver_id;
    v_types := array_append(v_types, 'created'::text);
    if NEW.driver_id is not null then
      v_types := array_append(v_types, 'assigned'::text);
    end if;
  else
    v_driver := coalesce(NEW.driver_id, OLD.driver_id);

    if OLD.driver_id is distinct from NEW.driver_id then
      v_types := array_append(v_types,
        case when NEW.driver_id is null then 'unassigned' else 'assigned' end::text);
    end if;
    if OLD.sender_ready_at is null and NEW.sender_ready_at is not null then
      v_types := array_append(v_types, 'sender_ready'::text);
    end if;
    if OLD.driver_arrived_pickup_at is null and NEW.driver_arrived_pickup_at is not null then
      v_types := array_append(v_types, 'arrived_pickup'::text);
    end if;
    if OLD.client_pickup_at is null and NEW.client_pickup_at is not null then
      v_types := array_append(v_types, 'client_pickup_confirmed'::text);
    end if;
    if OLD.driver_pickup_at is null and NEW.driver_pickup_at is not null then
      v_types := array_append(v_types, 'picked_up'::text);
    end if;
    if OLD.driver_arrived_delivery_at is null and NEW.driver_arrived_delivery_at is not null then
      v_types := array_append(v_types, 'arrived_delivery'::text);
    end if;
    if OLD.driver_delivery_at is null and NEW.driver_delivery_at is not null then
      v_types := array_append(v_types, 'delivered'::text);
    end if;
    if OLD.client_delivery_at is null and NEW.client_delivery_at is not null then
      v_types := array_append(v_types, 'client_delivery_confirmed'::text);
    end if;
    if OLD.status is distinct from NEW.status and NEW.status = 'completed' then
      v_types := array_append(v_types, 'completed'::text);
    end if;
    if OLD.status is distinct from NEW.status and NEW.status = 'cancelled' then
      v_types := array_append(v_types, 'cancelled'::text);
    end if;
    if coalesce(NEW.otp_attempts, 0) > coalesce(OLD.otp_attempts, 0) then
      v_types := array_append(v_types, 'otp_failed'::text);
    end if;
  end if;

  foreach v_t in array v_types loop
    insert into public.job_events
      (job_id, organization_id, driver_id, event_type, actor, lat, lng, client_reported_at, meta)
    values
      (NEW.id, NEW.organization_id, v_driver, v_t, v_actor, v_lat, v_lng, v_client,
       jsonb_build_object('status', NEW.status::text, 'confirmation_mode', NEW.confirmation_mode));
  end loop;

  return NEW;
end;
$$;

create trigger trg_job_events_capture
  after insert or update on public.jobs
  for each row execute function public.fn_job_events_capture();

-- Existing 14 jobs are not backfilled. get_driver_history reads the jobs table
-- directly, so history does not depend on events existing for old jobs.


-- ---------------------------------------------------------------------
-- 3. Driver RPCs (bearer token only; driver_id is never a caller input)
-- ---------------------------------------------------------------------

create or replace function public.driver_active_jobs(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := public._driver_from_session(p_token);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'job_id', j.id,
           'job_ref', j.job_ref,
           'status', j.status::text,
           'confirmation_mode', j.confirmation_mode,
           'pickup_location', j.pickup_location,
           'pickup_emirate', j.pickup_emirate,
           'delivery_location', j.delivery_location,
           'delivery_emirate', j.delivery_emirate,
           'item_type', j.item_type::text,
           'urgency', j.urgency::text,
           'scheduled_pickup_at', j.scheduled_pickup_at,
           'special_instructions', j.special_instructions,
           'driver_arrived_pickup_at', j.driver_arrived_pickup_at,
           'driver_pickup_at', j.driver_pickup_at,
           'driver_arrived_delivery_at', j.driver_arrived_delivery_at,
           'driver_delivery_at', j.driver_delivery_at,
           'created_at', j.created_at
         ) order by j.created_at desc), '[]'::jsonb)
  into v_result
  from public.jobs j
  where j.driver_id = v_driver
    and j.status not in ('completed', 'cancelled');

  return v_result;
end;
$$;

create or replace function public.set_driver_online(p_token text, p_online boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := public._driver_from_session(p_token);
  v_active integer;
begin
  perform 1 from public.drivers where id = v_driver for update;   -- serialise with trigger updates

  select count(*) into v_active
  from public.jobs
  where driver_id = v_driver and status not in ('completed', 'cancelled');

  if p_online then
    update public.drivers
    set status = case when v_active > 0 then 'on_job' else 'available' end,
        last_active_at = now()
    where id = v_driver;
  else
    if v_active > 0 then
      return jsonb_build_object('ok', false, 'error', 'active_job');
    end if;

    update public.drivers set status = 'offline', last_active_at = now() where id = v_driver;
    update public.driver_location_tracking
    set is_tracking_active = false, updated_at = now()
    where driver_id = v_driver;
  end if;

  return jsonb_build_object('ok', true, 'status', (select status from public.drivers where id = v_driver));
end;
$$;

-- Arrival timestamps are server time. The device clock is stored only as event metadata.
create or replace function public.record_arrival(
  p_token       text,
  p_job_id      uuid,
  p_stage       text,                       -- 'pickup' | 'delivery'
  p_lat         double precision default null,
  p_lng         double precision default null,
  p_client_time timestamptz      default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := public._driver_from_session(p_token);
  v_job    public.jobs%rowtype;
begin
  if p_stage not in ('pickup', 'delivery') then
    raise exception 'invalid_stage';
  end if;
  if (p_lat is not null and p_lat not between -90 and 90)
     or (p_lng is not null and p_lng not between -180 and 180) then
    raise exception 'invalid_coordinates';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.driver_id is distinct from v_driver then
    return jsonb_build_object('ok', false, 'error', 'not_assigned');
  end if;
  if v_job.status in ('completed', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'job_closed');
  end if;

  perform public._set_event_ctx(v_driver, p_lat, p_lng, p_client_time);

  if p_stage = 'pickup' then
    if v_job.driver_arrived_pickup_at is not null then
      return jsonb_build_object('ok', true, 'already_recorded', true);
    end if;
    update public.jobs set driver_arrived_pickup_at = now() where id = v_job.id;
  else
    if v_job.driver_pickup_at is null then
      return jsonb_build_object('ok', false, 'error', 'not_picked_up');
    end if;
    if v_job.driver_arrived_delivery_at is not null then
      return jsonb_build_object('ok', true, 'already_recorded', true);
    end if;
    update public.jobs set driver_arrived_delivery_at = now() where id = v_job.id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Thin wrapper over legacy confirm_job_step: adds session + assigned-driver checks and
-- reuses its OTP, attempt-lock, sequencing and status-recompute logic unchanged.
-- Driver steps only; client steps stay on the token path until confirm.nokael.com retires.
-- Later refactor: move the core into an internal function so the legacy entry point can
-- refuse driver_* steps without breaking this wrapper.
create or replace function public.driver_confirm_step(
  p_token  text,
  p_job_id uuid,
  p_step   text,                            -- 'driver_pickup' | 'driver_delivery'
  p_otp    text,
  p_lat    double precision default null,
  p_lng    double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver     uuid := public._driver_from_session(p_token);
  v_job        public.jobs%rowtype;
  v_step_token text;
  v_result     jsonb;
begin
  if p_step not in ('driver_pickup', 'driver_delivery') then
    raise exception 'invalid_step';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if not found or v_job.driver_id is distinct from v_driver then
    return jsonb_build_object('ok', false, 'error', 'not_assigned');
  end if;

  v_step_token := case p_step
                    when 'driver_pickup' then v_job.token_driver_pickup::text
                    else v_job.token_driver_delivery::text
                  end;

  perform public._set_event_ctx(v_driver, p_lat, p_lng, null);

  begin
    v_result := public.confirm_job_step(v_step_token, p_step, p_otp, p_lat, p_lng);
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'step_rejected', 'detail', sqlerrm);
  end;

  if v_result ? 'error' then
    return jsonb_build_object('ok', false, 'error', v_result->>'error');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.driver_update_location(
  p_token           text,
  p_lat             double precision,
  p_lng             double precision,
  p_accuracy_meters double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := public._driver_from_session(p_token);
  v_status text;
begin
  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90
     or p_lng not between -180 and 180 then
    raise exception 'invalid_coordinates';
  end if;

  select status into v_status from public.drivers where id = v_driver;
  if v_status = 'offline' then
    return jsonb_build_object('ok', false, 'error', 'offline');
  end if;

  insert into public.driver_location_tracking
    (driver_id, last_known_lat, last_known_lng, last_location_update_at,
     accuracy_meters, is_tracking_active, updated_at)
  values
    (v_driver, p_lat, p_lng, now(), p_accuracy_meters, true, now())
  on conflict (driver_id) do update set
    last_known_lat          = excluded.last_known_lat,
    last_known_lng          = excluded.last_known_lng,
    last_location_update_at = excluded.last_location_update_at,
    accuracy_meters         = excluded.accuracy_meters,
    is_tracking_active      = true,
    updated_at              = excluded.updated_at;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.driver_stop_tracking(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := public._driver_from_session(p_token);
begin
  update public.driver_location_tracking
  set is_tracking_active = false, updated_at = now()
  where driver_id = v_driver;

  return jsonb_build_object('ok', true);
end;
$$;

-- Work history grouped by Asia/Dubai calendar day of the closing timestamp.
-- Completed: client_delivery_at, else driver_delivery_at, else updated_at.
-- Cancelled: cancelled_at. No prices/earnings in v1. Defaults to the last 30 days.
create or replace function public.get_driver_history(
  p_token text,
  p_from  date    default null,
  p_to    date    default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid    := public._driver_from_session(p_token);
  v_to     date    := coalesce(p_to, (now() at time zone 'Asia/Dubai')::date);
  v_from   date    := coalesce(p_from, coalesce(p_to, (now() at time zone 'Asia/Dubai')::date) - 29);
  v_limit  integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_days   jsonb;
begin
  with closed as (
    select j.id, j.job_ref, j.status::text as job_status,
           j.pickup_emirate, j.pickup_location, j.delivery_emirate, j.delivery_location,
           case when j.status = 'cancelled'
                then j.cancelled_at
                else coalesce(j.client_delivery_at, j.driver_delivery_at, j.updated_at)
           end as closed_at
    from public.jobs j
    where j.driver_id = v_driver
      and j.status in ('completed', 'cancelled')
  ),
  dated as (
    select c.*, (c.closed_at at time zone 'Asia/Dubai')::date as dubai_day
    from closed c
    where c.closed_at is not null
  ),
  page as (
    select * from dated
    where dubai_day between v_from and v_to
    order by closed_at desc
    limit v_limit
  )
  select coalesce(jsonb_agg(g.obj order by g.dubai_day desc), '[]'::jsonb) into v_days
  from (
    select p.dubai_day,
           jsonb_build_object(
             'day', p.dubai_day,
             'completed', count(*) filter (where p.job_status = 'completed'),
             'cancelled', count(*) filter (where p.job_status = 'cancelled'),
             'jobs', jsonb_agg(jsonb_build_object(
                       'job_id', p.id,
                       'job_ref', p.job_ref,
                       'status', p.job_status,
                       'pickup_emirate', p.pickup_emirate,
                       'pickup_location', p.pickup_location,
                       'delivery_emirate', p.delivery_emirate,
                       'delivery_location', p.delivery_location,
                       'closed_at', p.closed_at
                     ) order by p.closed_at desc)
           ) as obj
    from page p
    group by p.dubai_day
  ) g;

  return jsonb_build_object('timezone', 'Asia/Dubai', 'from', v_from, 'to', v_to, 'days', v_days);
end;
$$;


-- ---------------------------------------------------------------------
-- 4. (reserved)
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 5. Status trigger fix (the only non-additive change)
--
-- Before: fired AFTER INSERT OR UPDATE on every jobs write, and any write to an
--   active job (GPS push, arrival, OTP attempt) forced the driver back to on_job,
--   overriding offline/available. Completion/cancel forced 'available' even for a
--   driver who had gone offline.
-- After: acts only on assignment changes and on a job leaving the active set.
--   * assigned / reassigned-to / reopened  -> on_job  (explicit dispatch keeps the
--     legacy behaviour: assigning to an offline driver puts them on_job)
--   * completed / cancelled / reassigned-away -> 'available', but only if the driver
--     was on_job and has no other active job. offline stays offline.
-- ---------------------------------------------------------------------

create or replace function public.update_driver_status_on_job()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_new_active boolean := NEW.status not in ('completed', 'cancelled');
begin
  if tg_op = 'INSERT' then
    if NEW.driver_id is not null and v_new_active then
      update public.drivers set status = 'on_job'
      where id = NEW.driver_id and status is distinct from 'on_job';
    end if;
    return NEW;
  end if;

  -- UPDATE: newly assigned, reassigned to this driver, or reopened
  if NEW.driver_id is not null and v_new_active
     and (OLD.driver_id is distinct from NEW.driver_id
          or OLD.status in ('completed', 'cancelled')) then
    update public.drivers set status = 'on_job'
    where id = NEW.driver_id and status is distinct from 'on_job';
  end if;

  -- UPDATE: previous driver released (reassigned away, or job became terminal)
  if OLD.driver_id is not null
     and (OLD.driver_id is distinct from NEW.driver_id
          or (not v_new_active and OLD.status not in ('completed', 'cancelled'))) then
    update public.drivers d set status = 'available'
    where d.id = OLD.driver_id
      and d.status = 'on_job'
      and not exists (
        select 1 from public.jobs j
        where j.driver_id = d.id and j.status not in ('completed', 'cancelled')
      );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trigger_update_driver_status on public.jobs;
create trigger trigger_update_driver_status
  after insert or update of driver_id, status on public.jobs
  for each row execute function public.update_driver_status_on_job();


-- ---------------------------------------------------------------------
-- 6. Grants
--    Default privileges in Supabase hand EXECUTE to anon/authenticated, so revoke
--    explicitly, then grant only the public driver API.
-- ---------------------------------------------------------------------

revoke all on function public._driver_from_session(text)                                              from public, anon, authenticated;
revoke all on function public._set_event_ctx(uuid, double precision, double precision, timestamptz)   from public, anon, authenticated;
revoke all on function public.fn_job_events_capture()                                                 from public, anon, authenticated;
revoke all on function public.fn_job_events_immutable()                                               from public, anon, authenticated;

revoke all on function public.driver_login(uuid, text, text)                                                        from public, anon, authenticated;
revoke all on function public.driver_logout(text)                                                                   from public, anon, authenticated;
revoke all on function public.driver_active_jobs(text)                                                              from public, anon, authenticated;
revoke all on function public.set_driver_online(text, boolean)                                                      from public, anon, authenticated;
revoke all on function public.record_arrival(text, uuid, text, double precision, double precision, timestamptz)     from public, anon, authenticated;
revoke all on function public.driver_confirm_step(text, uuid, text, text, double precision, double precision)       from public, anon, authenticated;
revoke all on function public.driver_update_location(text, double precision, double precision, double precision)    from public, anon, authenticated;
revoke all on function public.driver_stop_tracking(text)                                                            from public, anon, authenticated;
revoke all on function public.get_driver_history(text, date, date, integer)                                         from public, anon, authenticated;

grant execute on function public.driver_login(uuid, text, text)                                                     to anon, authenticated;
grant execute on function public.driver_logout(text)                                                                to anon, authenticated;
grant execute on function public.driver_active_jobs(text)                                                           to anon, authenticated;
grant execute on function public.set_driver_online(text, boolean)                                                   to anon, authenticated;
grant execute on function public.record_arrival(text, uuid, text, double precision, double precision, timestamptz)  to anon, authenticated;
grant execute on function public.driver_confirm_step(text, uuid, text, text, double precision, double precision)    to anon, authenticated;
grant execute on function public.driver_update_location(text, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.driver_stop_tracking(text)                                                         to anon, authenticated;
grant execute on function public.get_driver_history(text, date, date, integer)                                      to anon, authenticated;


-- ---------------------------------------------------------------------
-- ROLLBACK (run as one transaction)
--
-- drop trigger if exists trg_job_events_capture on public.jobs;
-- drop trigger if exists trigger_update_driver_status on public.jobs;
-- drop function if exists public.get_driver_history(text, date, date, integer);
-- drop function if exists public.driver_stop_tracking(text);
-- drop function if exists public.driver_update_location(text, double precision, double precision, double precision);
-- drop function if exists public.driver_confirm_step(text, uuid, text, text, double precision, double precision);
-- drop function if exists public.record_arrival(text, uuid, text, double precision, double precision, timestamptz);
-- drop function if exists public.set_driver_online(text, boolean);
-- drop function if exists public.driver_active_jobs(text);
-- drop function if exists public.fn_job_events_capture();
-- drop function if exists public._set_event_ctx(uuid, double precision, double precision, timestamptz);
-- drop table if exists public.job_events;                 -- loses the event log
-- drop function if exists public.fn_job_events_immutable();
-- drop function if exists public.driver_logout(text);
-- drop function if exists public.driver_login(uuid, text, text);
-- drop function if exists public._driver_from_session(text);
-- drop table if exists public.driver_sessions;            -- logs out every NDP1 session
--
-- -- restore the original status trigger exactly as it was:
-- create or replace function public.update_driver_status_on_job()
-- returns trigger language plpgsql as $fn$
-- BEGIN
--   IF NEW.driver_id IS NOT NULL AND NEW.status NOT IN ('completed', 'cancelled') THEN
--     UPDATE drivers SET status = 'on_job' WHERE id = NEW.driver_id;
--   END IF;
--   IF NEW.status IN ('completed', 'cancelled') AND NEW.driver_id IS NOT NULL THEN
--     UPDATE drivers SET status = 'available'
--     WHERE id = NEW.driver_id
--       AND NOT EXISTS (SELECT 1 FROM jobs WHERE driver_id = NEW.driver_id
--                       AND id != NEW.id AND status NOT IN ('completed', 'cancelled'));
--   END IF;
--   RETURN NEW;
-- END;
-- $fn$;
-- create trigger trigger_update_driver_status
--   after insert or update on public.jobs
--   for each row execute function public.update_driver_status_on_job();
-- ---------------------------------------------------------------------
