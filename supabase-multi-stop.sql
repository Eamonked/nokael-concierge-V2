-- Multi-stop and round-trip jobs.
--
-- A job is one of: one_way (today's pickup → delivery, unchanged), multi_stop
-- (ordered pickups/drops) or round_trip (multi-stop that ends back at stop 1).
-- Stops live in job_stops. For multi-stop jobs the flat jobs columns are a
-- mirror written by _sync_job_from_stops:
--   stop 1        → sender_*, pickup_*, pickup_window_*, token_client_pickup, otp_sender,
--                   driver_arrived_pickup_at, driver_pickup_at
--   first drop    → recipient_*, delivery_*, scheduled_delivery_*, token_client_delivery, otp_recipient
--   last stop     → driver_delivery_at (only once every stop is handed over)
--   status        → pending → driver_pickup → completed (driver_only; fits fn_enforce_job_sequence)
-- so lists, search, link expiry, tracking-opens and the existing pushes keep
-- working. Logic that would misread the mirror (pod log, geofence, reminders,
-- delivery pushes, old driver RPCs, confirm_job_step) skips multi-stop jobs and
-- the stop-aware code below runs instead. one_way jobs take exactly the same
-- path as before.
--
-- Functions patched in place (pg_get_functiondef + replace, asserted) where we
-- only add a guard, so we never retype long live bodies. Functions whose
-- return type changes are dropped and recreated with the same grants.
--
-- Apply: once, in the Supabase SQL editor (project hhgzxpuzsbqirmbsiltn).
-- Re-runnable: yes (IF NOT EXISTS / CREATE OR REPLACE / guarded patches).

begin;

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public._try_uuid(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Replace exactly one known snippet in a live function, or fail the migration.
create or replace function public._patch_function(p_sig regprocedure, p_find text, p_replace text, p_marker text)
returns void
language plpgsql
as $$
declare
  v_def text := pg_get_functiondef(p_sig);
begin
  if position(p_marker in v_def) > 0 then
    return; -- already patched
  end if;
  if position(p_find in v_def) = 0 then
    raise exception 'patch target not found in %: %', p_sig, left(p_find, 80);
  end if;
  execute replace(v_def, p_find, p_replace);
end;
$$;

-- ─── Schema ─────────────────────────────────────────────────────────────────

alter table public.jobs add column if not exists job_kind text not null default 'one_way';
alter table public.jobs drop constraint if exists jobs_job_kind_check;
alter table public.jobs add constraint jobs_job_kind_check
  check (job_kind in ('one_way', 'multi_stop', 'round_trip'));

create table if not exists public.job_stops (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  seq             integer not null check (seq >= 1),
  kind            text not null check (kind in ('pickup', 'drop')),
  contact_name    text,
  contact_phone   text,
  emirate         text,
  address         text not null,
  lat             double precision,
  lng             double precision,
  building        text,
  company         text,
  notes           text,
  item_note       text,
  window_start    timestamptz,
  window_end      timestamptz,
  otp             character(6) not null default lpad((floor(random() * 1000000))::int::text, 6, '0'),
  otp_attempts    integer not null default 0,
  token           uuid not null default gen_random_uuid(),
  arrived_at      timestamptz,
  arrived_lat     double precision,
  arrived_lng     double precision,
  near_at         timestamptz,
  handed_at       timestamptz,
  handed_lat      double precision,
  handed_lng      double precision,
  method          text check (method in ('otp', 'ops_override')),
  last_seen_at    timestamptz,
  visits          integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint job_stops_job_seq_key unique (job_id, seq) deferrable initially deferred,
  constraint job_stops_window_valid check (window_end is null or window_start is null or window_end >= window_start)
);

create index if not exists job_stops_job_idx on public.job_stops (job_id, seq);
create index if not exists job_stops_token_idx on public.job_stops (token);

alter table public.job_stops enable row level security;
drop policy if exists job_stops_select_members on public.job_stops;
create policy job_stops_select_members on public.job_stops
  for select using (public.is_org_member(organization_id));
-- Writes go through the RPCs below only (they keep the mirror and order intact).
revoke insert, update, delete on public.job_stops from anon, authenticated;
grant select on public.job_stops to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and tablename = 'job_stops') then
    alter publication supabase_realtime add table public.job_stops;
  end if;
end $$;

alter table public.job_pod_log add column if not exists stop_id uuid references public.job_stops(id) on delete set null;
alter table public.job_pod_log drop constraint if exists job_pod_log_step_check;
alter table public.job_pod_log add constraint job_pod_log_step_check
  check (step in ('client_pickup', 'driver_pickup', 'driver_delivery', 'client_delivery', 'stop_handover'));

alter table public.job_events add column if not exists stop_id uuid references public.job_stops(id) on delete set null;
alter table public.job_events drop constraint if exists job_events_type_check;
alter table public.job_events add constraint job_events_type_check
  check (type in ('geofence_pickup', 'geofence_delivery', 'geofence_stop'));

alter table public.job_reminder_state drop constraint if exists job_reminder_state_leg_check;
alter table public.job_reminder_state add constraint job_reminder_state_leg_check
  check (leg in ('pickup', 'delivery') or leg ~ '^stop:[0-9]+$');

-- ─── Mirror ─────────────────────────────────────────────────────────────────

create or replace function public._sync_job_from_stops(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  j       public.jobs%rowtype;
  s1      public.job_stops%rowtype;
  d1      public.job_stops%rowtype;
  sl      public.job_stops%rowtype;
  v_total integer;
  v_done  integer;
  v_status public.job_status;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found or j.job_kind = 'one_way' then
    return;
  end if;

  select * into s1 from public.job_stops where job_id = p_job_id order by seq limit 1;
  if not found then
    return;
  end if;
  select * into d1 from public.job_stops where job_id = p_job_id and kind = 'drop' order by seq limit 1;
  select * into sl from public.job_stops where job_id = p_job_id order by seq desc limit 1;
  select count(*), count(handed_at) into v_total, v_done from public.job_stops where job_id = p_job_id;

  v_status := case
    when j.status in ('cancelled', 'returned') then j.status
    when v_done = v_total and j.status = 'driver_pickup' then 'completed'
    when j.status = 'completed' then 'completed'
    when s1.handed_at is not null then 'driver_pickup'
    else 'pending'
  end;

  update public.jobs set
    confirmation_mode        = 'driver_only',
    sender_name              = coalesce(nullif(btrim(s1.contact_name), ''), sender_name),
    sender_phone             = coalesce(nullif(btrim(s1.contact_phone), ''), sender_phone),
    pickup_emirate           = coalesce(nullif(s1.emirate, ''), pickup_emirate),
    pickup_location          = s1.address,
    pickup_lat               = s1.lat,
    pickup_lng               = s1.lng,
    pickup_building          = s1.building,
    pickup_company           = s1.company,
    pickup_notes             = s1.notes,
    pickup_window_start      = s1.window_start,
    pickup_window_end        = s1.window_end,
    token_client_pickup      = s1.token,
    otp_sender               = s1.otp,
    recipient_name           = coalesce(nullif(btrim(d1.contact_name), ''), recipient_name),
    recipient_phone          = coalesce(nullif(btrim(d1.contact_phone), ''), recipient_phone),
    delivery_emirate         = coalesce(nullif(d1.emirate, ''), delivery_emirate),
    delivery_location        = coalesce(d1.address, delivery_location),
    delivery_lat             = d1.lat,
    delivery_lng             = d1.lng,
    delivery_building        = d1.building,
    delivery_company         = d1.company,
    delivery_notes           = d1.notes,
    scheduled_delivery_start = d1.window_start,
    scheduled_delivery_end   = d1.window_end,
    token_client_delivery    = coalesce(d1.token, token_client_delivery),
    otp_recipient            = coalesce(d1.otp, otp_recipient),
    driver_arrived_pickup_at  = s1.arrived_at,
    driver_arrived_pickup_lat = s1.arrived_lat,
    driver_arrived_pickup_lng = s1.arrived_lng,
    driver_pickup_at         = s1.handed_at,
    driver_delivery_at       = case when v_done = v_total then sl.handed_at end,
    status                   = v_status,
    updated_at               = now()
  where id = p_job_id;
end;
$$;
revoke all on function public._sync_job_from_stops(uuid) from public, anon, authenticated;

-- Stops as JSON for client links: codes only for the viewer's own stops,
-- other people's names and phones never.
create or replace function public.job_stops_json(p_job_id uuid, p_viewer uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'seq', s.seq, 'kind', s.kind,
      'emirate', s.emirate, 'address', s.address, 'lat', s.lat, 'lng', s.lng,
      'building', s.building, 'company', s.company, 'item_note', s.item_note,
      'window_start', s.window_start, 'window_end', s.window_end,
      'arrived_at', s.arrived_at, 'handed_at', s.handed_at, 'method', s.method,
      'status', case when s.handed_at is not null then 'handed'
                     when s.arrived_at is not null then 'arrived' else 'pending' end,
      'mine', p_viewer is not null and s.token = p_viewer,
      'contact_name', case when p_viewer is not null and s.token = p_viewer then s.contact_name end,
      'otp', case when p_viewer is not null and s.token = p_viewer and s.handed_at is null then s.otp end
    ) order by s.seq), '[]'::jsonb)
  from public.job_stops s
  where s.job_id = p_job_id;
$$;
revoke all on function public.job_stops_json(uuid, uuid) from public, anon, authenticated;

-- Stops as JSON for the assigned driver: contacts while open, never codes.
create or replace function public._driver_stops_json(p_job_id uuid, p_open boolean)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'seq', s.seq, 'kind', s.kind,
      'contact_name', s.contact_name,
      'contact_phone', case when p_open then s.contact_phone end,
      'address', s.address, 'emirate', s.emirate, 'lat', s.lat, 'lng', s.lng,
      'building', s.building, 'company', s.company, 'notes', s.notes, 'item_note', s.item_note,
      'window_start', s.window_start, 'window_end', s.window_end,
      'arrived_at', s.arrived_at, 'arrived_lat', s.arrived_lat, 'arrived_lng', s.arrived_lng,
      'handed_at', s.handed_at,
      -- Mirrors driver_stop_handoff's max-attempts constant (5). Keep in sync.
      'otp_locked', s.otp_attempts >= 5,
      'status', case when s.handed_at is not null then 'handed'
                     when s.arrived_at is not null then 'arrived' else 'pending' end
    ) order by s.seq), '[]'::jsonb)
  from public.job_stops s
  where s.job_id = p_job_id;
$$;
revoke all on function public._driver_stops_json(uuid, boolean) from public, anon, authenticated;

-- Job id for a stop link that is not one of the job's own token columns.
create or replace function public._stop_link_job(p_token text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.job_id from public.job_stops s
   where s.token = public._try_uuid(p_token)
   limit 1;
$$;
revoke all on function public._stop_link_job(text) from public, anon, authenticated;

-- ─── Driver app version gate ────────────────────────────────────────────────

create or replace function public._driver_multi_stop_ready(p_driver uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.driver_sessions s
     where s.driver_id = p_driver
       and s.revoked_at is null and s.expires_at > now()
       and s.app_platform = 'android'
       and s.app_version ~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$'
       and string_to_array(s.app_version, '.')::int[] >= array[1, 1, 0]
  );
$$;
revoke all on function public._driver_multi_stop_ready(uuid) from public, anon, authenticated;

-- Dashboard: which of these drivers can take a multi-stop job.
create or replace function public.drivers_multi_stop_ready(p_driver_ids uuid[])
returns table(driver_id uuid, ready boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.id, public._driver_multi_stop_ready(d.id)
    from public.drivers d
   where d.id = any(p_driver_ids)
     and public.is_org_member(d.organization_id);
$$;
grant execute on function public.drivers_multi_stop_ready(uuid[]) to authenticated;

create or replace function public._guard_multi_stop_driver()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.job_kind <> 'one_way' and new.driver_id is not null
     and (tg_op = 'INSERT' or new.driver_id is distinct from old.driver_id)
     and not public._driver_multi_stop_ready(new.driver_id) then
    raise exception 'needs_driver_app_1_1'
      using hint = 'This driver needs Nokael Driver 1.1 or newer for multi-stop jobs.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_multi_stop_driver on public.jobs;
create trigger trg_guard_multi_stop_driver
  before insert or update of driver_id, job_kind on public.jobs
  for each row execute function public._guard_multi_stop_driver();

-- ─── Stop pushes ────────────────────────────────────────────────────────────
-- Stop 1's arrival and collection are announced by _push_on_job through the
-- mirror; every later stop is announced here.
create or replace function public._push_stop_event(p_stop_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
        || case when v_last then '. All stops are done.' else ' (' || v_label || ').' end, null, v_tag);
  end if;
end;
$$;
revoke all on function public._push_stop_event(uuid, text) from public, anon, authenticated;

-- ─── Dispatcher RPCs ────────────────────────────────────────────────────────

-- Replace a multi-stop job's stop list (create or edit). Handed-over stops are
-- frozen: they must stay first, in order, and their details are not changed.
create or replace function public.save_job_stops(p_job_id uuid, p_stops jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  j        public.jobs%rowtype;
  v_n      integer;
  v_i      integer;
  v_s      jsonb;
  v_id     uuid;
  v_old    public.job_stops%rowtype;
  v_token  uuid;
  v_otp    character(6);
  v_kind   text;
  v_first  boolean;
  v_keep   uuid[] := '{}';
  v_frozen integer;
  v_had_stops boolean;
  v_first_drop_done boolean := false;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'job_not_found');
  end if;
  if j.organization_id is null or not public.can_write_org(j.organization_id) then
    raise exception 'Not authorized';
  end if;
  if j.job_kind = 'one_way' then
    return jsonb_build_object('ok', false, 'error', 'not_multi_stop');
  end if;
  if j.status in ('completed', 'cancelled', 'returned') then
    return jsonb_build_object('ok', false, 'error', 'job_closed');
  end if;
  if jsonb_typeof(p_stops) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_stops');
  end if;

  v_n := jsonb_array_length(p_stops);
  if v_n < 2 or (j.job_kind = 'round_trip' and v_n < 3) then
    return jsonb_build_object('ok', false, 'error', 'too_few_stops');
  end if;
  if v_n > 30 then
    return jsonb_build_object('ok', false, 'error', 'too_many_stops');
  end if;
  if p_stops -> 0 ->> 'kind' <> 'pickup' then
    return jsonb_build_object('ok', false, 'error', 'first_stop_must_be_pickup');
  end if;
  if p_stops -> (v_n - 1) ->> 'kind' <> 'drop' then
    return jsonb_build_object('ok', false, 'error', 'last_stop_must_be_drop');
  end if;

  -- Handed-over stops must be the first stops, in their current order.
  select count(*) into v_frozen from public.job_stops where job_id = p_job_id and handed_at is not null;
  for v_i in 0 .. v_frozen - 1 loop
    if v_i >= v_n or public._try_uuid(p_stops -> v_i ->> 'id') is distinct from
       (select id from public.job_stops where job_id = p_job_id and handed_at is not null order by seq offset v_i limit 1) then
      return jsonb_build_object('ok', false, 'error', 'handed_stops_locked');
    end if;
  end loop;

  select exists (select 1 from public.job_stops where job_id = p_job_id) into v_had_stops;

  for v_i in 0 .. v_n - 1 loop
    v_s := p_stops -> v_i;
    v_kind := v_s ->> 'kind';
    if v_kind not in ('pickup', 'drop') or nullif(btrim(v_s ->> 'address'), '') is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_stop', 'index', v_i);
    end if;
    v_id := public._try_uuid(v_s ->> 'id');
    v_old := null;
    if v_id is not null then
      select * into v_old from public.job_stops where id = v_id and job_id = p_job_id;
      if not found then
        v_id := null;
      end if;
    end if;

    if v_id is not null and v_old.handed_at is not null then
      update public.job_stops set seq = v_i + 1 where id = v_id;
    elsif v_id is not null then
      update public.job_stops set
        seq = v_i + 1,
        kind = v_kind,
        contact_name = nullif(btrim(v_s ->> 'contact_name'), ''),
        contact_phone = nullif(btrim(v_s ->> 'contact_phone'), ''),
        emirate = nullif(btrim(v_s ->> 'emirate'), ''),
        address = btrim(v_s ->> 'address'),
        lat = (v_s ->> 'lat')::double precision,
        lng = (v_s ->> 'lng')::double precision,
        building = nullif(btrim(v_s ->> 'building'), ''),
        company = nullif(btrim(v_s ->> 'company'), ''),
        notes = nullif(btrim(v_s ->> 'notes'), ''),
        item_note = nullif(btrim(v_s ->> 'item_note'), ''),
        window_start = nullif(v_s ->> 'window_start', '')::timestamptz,
        window_end = nullif(v_s ->> 'window_end', '')::timestamptz,
        updated_at = now()
      where id = v_id;
    else
      -- New stop: the first save hands the job's existing sender/recipient
      -- links and codes to stop 1 and the first drop; a contact who already
      -- has a stop on this job keeps one link for all their stops.
      v_token := null;
      v_otp := null;
      v_first := v_i = 0;
      if not v_had_stops and v_first then
        v_token := j.token_client_pickup;
        v_otp := j.otp_sender;
      elsif not v_had_stops and v_kind = 'drop' and not v_first_drop_done then
        v_token := j.token_client_delivery;
        v_otp := j.otp_recipient;
      end if;
      if v_token is null and public._phone_key(v_s ->> 'contact_phone') is not null then
        select s.token into v_token from public.job_stops s
         where s.job_id = p_job_id
           and public._phone_key(s.contact_phone) = public._phone_key(v_s ->> 'contact_phone')
         order by s.seq limit 1;
      end if;

      insert into public.job_stops (organization_id, job_id, seq, kind, contact_name, contact_phone,
        emirate, address, lat, lng, building, company, notes, item_note, window_start, window_end, token, otp)
      values (j.organization_id, p_job_id, v_i + 1, v_kind,
        nullif(btrim(v_s ->> 'contact_name'), ''), nullif(btrim(v_s ->> 'contact_phone'), ''),
        nullif(btrim(v_s ->> 'emirate'), ''), btrim(v_s ->> 'address'),
        (v_s ->> 'lat')::double precision, (v_s ->> 'lng')::double precision,
        nullif(btrim(v_s ->> 'building'), ''), nullif(btrim(v_s ->> 'company'), ''),
        nullif(btrim(v_s ->> 'notes'), ''), nullif(btrim(v_s ->> 'item_note'), ''),
        nullif(v_s ->> 'window_start', '')::timestamptz, nullif(v_s ->> 'window_end', '')::timestamptz,
        coalesce(v_token, gen_random_uuid()),
        coalesce(v_otp, lpad((floor(random() * 1000000))::int::text, 6, '0')))
      returning id into v_id;
    end if;
    if v_kind = 'drop' then
      v_first_drop_done := true;
    end if;
    v_keep := v_keep || v_id;
  end loop;

  delete from public.job_stops
   where job_id = p_job_id and handed_at is null and not (id = any(v_keep));

  set constraints public.job_stops_job_seq_key immediate;
  perform public._sync_job_from_stops(p_job_id);

  return jsonb_build_object('ok', true, 'stops', (
    select jsonb_agg(jsonb_build_object('id', s.id, 'seq', s.seq, 'token', s.token, 'otp', s.otp) order by s.seq)
      from public.job_stops s where s.job_id = p_job_id));
end;
$$;
revoke all on function public.save_job_stops(uuid, jsonb) from public, anon;
grant execute on function public.save_job_stops(uuid, jsonb) to authenticated;

-- Dispatcher manual arrival / handover for the next stop.
create or replace function public.ops_stop_override(p_job_id uuid, p_stop_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  j      public.jobs%rowtype;
  v_next public.job_stops%rowtype;
  v_loc  record;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'job_not_found');
  end if;
  if j.organization_id is null or not public.can_write_org(j.organization_id) then
    raise exception 'Not authorized';
  end if;
  if j.job_kind = 'one_way' then
    return jsonb_build_object('ok', false, 'error', 'not_multi_stop');
  end if;
  if j.status in ('completed', 'cancelled', 'returned') then
    return jsonb_build_object('ok', false, 'error', 'job_closed');
  end if;
  if p_action not in ('arrive', 'handover') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action');
  end if;

  select * into v_next from public.job_stops
   where job_id = p_job_id and handed_at is null order by seq limit 1 for update;
  if not found or v_next.id <> p_stop_id then
    return jsonb_build_object('ok', false, 'error', 'out_of_order');
  end if;

  if p_action = 'arrive' then
    if v_next.arrived_at is null then
      update public.job_stops set arrived_at = now(), updated_at = now() where id = v_next.id;
      perform public._push_stop_event(v_next.id, 'arrived');
    end if;
  else
    select last_known_lat, last_known_lng, accuracy_meters,
           extract(epoch from (now() - last_location_update_at))::int as age
      into v_loc
      from public.driver_location_tracking
     where driver_id = j.driver_id
       and last_location_update_at > now() - interval '5 minutes';

    update public.job_stops set
      arrived_at = coalesce(arrived_at, now()),
      handed_at = now(), handed_lat = v_loc.last_known_lat, handed_lng = v_loc.last_known_lng,
      method = 'ops_override', otp_attempts = 0, updated_at = now()
     where id = v_next.id;

    insert into public.job_pod_log (organization_id, job_id, step, action, method, actor_user_id,
                                    driver_id, driver_lat, driver_lng, accuracy_m, fix_age_s, stop_id)
    values (j.organization_id, j.id, 'stop_handover', 'confirmed', 'ops_override', auth.uid(),
            j.driver_id, v_loc.last_known_lat, v_loc.last_known_lng, v_loc.accuracy_meters, v_loc.age, v_next.id);
    perform public._push_stop_event(v_next.id, 'handed');
  end if;

  perform public._sync_job_from_stops(p_job_id);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.ops_stop_override(uuid, uuid, text) from public, anon;
grant execute on function public.ops_stop_override(uuid, uuid, text) to authenticated;

-- ─── Driver RPCs ────────────────────────────────────────────────────────────

create or replace function public.driver_stop_arrive(p_token text, p_job_id uuid, p_stop_id uuid,
                                                     p_lat double precision default null,
                                                     p_lng double precision default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver uuid := public._driver_from_session(p_token);
  j        public.jobs%rowtype;
  v_next   public.job_stops%rowtype;
begin
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180)) then
    return jsonb_build_object('ok', false, 'error', 'invalid_coordinates');
  end if;

  select * into j from public.jobs where id = p_job_id and driver_id = v_driver for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_assigned');
  end if;
  if j.status in ('completed', 'cancelled', 'returned') then
    return jsonb_build_object('ok', false, 'error', 'job_closed');
  end if;
  if j.job_kind = 'one_way' then
    return jsonb_build_object('ok', false, 'error', 'not_multi_stop');
  end if;

  select * into v_next from public.job_stops
   where job_id = p_job_id and handed_at is null order by seq limit 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'job_closed');
  end if;
  if v_next.id <> p_stop_id then
    if exists (select 1 from public.job_stops where id = p_stop_id and job_id = p_job_id and handed_at is not null) then
      return jsonb_build_object('ok', false, 'error', 'already_handed');
    end if;
    return jsonb_build_object('ok', false, 'error', 'out_of_order');
  end if;
  if v_next.arrived_at is not null then
    return jsonb_build_object('ok', true, 'already_recorded', true, 'at', v_next.arrived_at);
  end if;

  update public.job_stops
     set arrived_at = now(), arrived_lat = p_lat, arrived_lng = p_lng, updated_at = now()
   where id = v_next.id;
  perform public._push_stop_event(v_next.id, 'arrived');
  perform public._sync_job_from_stops(p_job_id);

  return jsonb_build_object('ok', true, 'at', now());
end;
$$;
revoke all on function public.driver_stop_arrive(text, uuid, uuid, double precision, double precision) from public;
grant execute on function public.driver_stop_arrive(text, uuid, uuid, double precision, double precision) to anon, authenticated;

create or replace function public.driver_stop_handoff(p_token text, p_job_id uuid, p_stop_id uuid, p_code text,
                                                      p_lat double precision default null,
                                                      p_lng double precision default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver uuid := public._driver_from_session(p_token);
  v_max    constant integer := 5;
  j        public.jobs%rowtype;
  v_next   public.job_stops%rowtype;
  v_loc    record;
  v_lat    double precision;
  v_lng    double precision;
  v_acc    double precision;
  v_age    integer;
  v_left   integer;
begin
  select * into j from public.jobs where id = p_job_id and driver_id = v_driver for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_assigned');
  end if;
  if j.status in ('completed', 'cancelled', 'returned') then
    return jsonb_build_object('ok', false, 'error', 'job_closed');
  end if;
  if j.job_kind = 'one_way' then
    return jsonb_build_object('ok', false, 'error', 'not_multi_stop');
  end if;

  select * into v_next from public.job_stops
   where job_id = p_job_id and handed_at is null order by seq limit 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'job_closed');
  end if;
  if v_next.id <> p_stop_id then
    if exists (select 1 from public.job_stops where id = p_stop_id and job_id = p_job_id and handed_at is not null) then
      return jsonb_build_object('ok', false, 'error', 'already_confirmed');
    end if;
    return jsonb_build_object('ok', false, 'error', 'out_of_order');
  end if;
  if v_next.otp_attempts >= v_max then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  if p_code is null or btrim(p_code) <> v_next.otp then
    update public.job_stops set otp_attempts = otp_attempts + 1, updated_at = now() where id = v_next.id;
    if v_next.otp_attempts + 1 >= v_max then
      return jsonb_build_object('ok', false, 'error', 'locked');
    end if;
    return jsonb_build_object('ok', false, 'error', 'invalid_otp');
  end if;

  -- GPS: the phone's fix at the handover, else the driver's last fix (≤ 5 min).
  if p_lat is not null and p_lng is not null
     and p_lat between -90 and 90 and p_lng between -180 and 180 then
    v_lat := p_lat; v_lng := p_lng; v_age := 0;
  else
    select last_known_lat, last_known_lng, accuracy_meters,
           extract(epoch from (now() - last_location_update_at))::int as age
      into v_loc
      from public.driver_location_tracking
     where driver_id = v_driver
       and last_location_update_at > now() - interval '5 minutes';
    v_lat := v_loc.last_known_lat; v_lng := v_loc.last_known_lng;
    v_acc := v_loc.accuracy_meters; v_age := v_loc.age;
  end if;

  update public.job_stops set
    handed_at = now(), handed_lat = v_lat, handed_lng = v_lng,
    method = 'otp', otp_attempts = 0, updated_at = now()
   where id = v_next.id;

  insert into public.job_pod_log (organization_id, job_id, step, action, method,
                                  driver_id, driver_lat, driver_lng, accuracy_m, fix_age_s, stop_id)
  values (j.organization_id, j.id, 'stop_handover', 'confirmed', 'otp',
          v_driver, v_lat, v_lng, v_acc, v_age, v_next.id);

  perform public._push_stop_event(v_next.id, 'handed');
  perform public._sync_job_from_stops(p_job_id);

  select count(*) into v_left from public.job_stops where job_id = p_job_id and handed_at is null;
  return jsonb_build_object('ok', true, 'completed', v_left = 0);
end;
$$;
revoke all on function public.driver_stop_handoff(text, uuid, uuid, text, double precision, double precision) from public;
grant execute on function public.driver_stop_handoff(text, uuid, uuid, text, double precision, double precision) to anon, authenticated;

-- ─── Guards on the one-way paths (one_way unchanged) ────────────────────────

select public._patch_function('public.confirm_job_step(text, text, text, double precision, double precision)'::regprocedure,
  E'  IF v_job.status = ''cancelled'' THEN',
  E'  IF v_job.job_kind <> ''one_way'' THEN -- multi-stop guard\n    RETURN jsonb_build_object(''error'', ''use_stop_handover'');\n  END IF;\n\n  IF v_job.status = ''cancelled'' THEN',
  'multi-stop guard');

select public._patch_function('public.driver_arrive(text, uuid, text, double precision, double precision)'::regprocedure,
  E'  if v_job.status in (''completed'', ''cancelled'', ''returned'') then',
  E'  if v_job.job_kind <> ''one_way'' then -- multi-stop guard\n    return jsonb_build_object(''ok'', false, ''error'', ''needs_app_update'');\n  end if;\n\n  if v_job.status in (''completed'', ''cancelled'', ''returned'') then',
  'multi-stop guard');

select public._patch_function('public.driver_confirm_handoff(text, uuid, text, text)'::regprocedure,
  E'  if v_job.status in (''completed'', ''cancelled'', ''returned'') then',
  E'  if v_job.job_kind <> ''one_way'' then -- multi-stop guard\n    return jsonb_build_object(''ok'', false, ''error'', ''needs_app_update'');\n  end if;\n\n  if v_job.status in (''completed'', ''cancelled'', ''returned'') then',
  'multi-stop guard');

select public._patch_function('public.update_job_by_token(text, jsonb)'::regprocedure,
  E'  IF p_updates ? ''driver_arrived_pickup_at'' THEN',
  E'  IF v_job.job_kind <> ''one_way'' THEN -- multi-stop guard\n    p_updates := p_updates - ''driver_arrived_pickup_at'' - ''driver_arrived_delivery_at'';\n  END IF;\n\n  IF p_updates ? ''driver_arrived_pickup_at'' THEN',
  'multi-stop guard');

-- Pod log: multi-stop handovers are written by the stop RPCs, not the mirror.
select public._patch_function('public.fn_log_pod_steps()'::regprocedure,
  E'begin\n  select last_known_lat, last_known_lng, accuracy_meters,',
  E'begin\n  if new.job_kind <> ''one_way'' then -- multi-stop guard\n    return new;\n  end if;\n\n  select last_known_lat, last_known_lng, accuracy_meters,',
  'multi-stop guard');

-- Delivery pushes: for multi-stop jobs these come from _push_stop_event.
select public._patch_function('public._push_on_job()'::regprocedure,
  E'  if new.driver_arrived_delivery_at is not null and old.driver_arrived_delivery_at is null then',
  E'  if new.job_kind = ''one_way'' -- multi-stop guard\n     and new.driver_arrived_delivery_at is not null and old.driver_arrived_delivery_at is null then',
  'multi-stop guard');
select public._patch_function('public._push_on_job()'::regprocedure,
  E'  if new.driver_delivery_at is not null and old.driver_delivery_at is null then',
  E'  if new.job_kind = ''one_way'' -- multi-stop guard 2\n     and new.driver_delivery_at is not null and old.driver_delivery_at is null then',
  'multi-stop guard 2');

-- Geofence: one-way jobs as before; multi-stop jobs watch their next stop.
select public._patch_function('public.driver_publish_location(text, double precision, double precision, double precision)'::regprocedure,
  E'       and j.organization_id is not null\n  loop',
  E'       and j.organization_id is not null\n       and j.job_kind = ''one_way'' -- multi-stop guard\n  loop',
  'multi-stop guard');
select public._patch_function('public.driver_publish_location(text, double precision, double precision, double precision)'::regprocedure,
  E'  v_stage  text;\nbegin',
  E'  v_stage  text;\n  v_stop   record; -- multi-stop geofence\nbegin',
  'multi-stop geofence');
select public._patch_function('public.driver_publish_location(text, double precision, double precision, double precision)'::regprocedure,
  E'  end loop;\n\n  return jsonb_build_object(''ok'', true);\nend;',
  E'  end loop;\n\n'
  || E'  -- multi-stop stop geofence\n'
  || E'  for v_stop in\n'
  || E'    select s.id, s.job_id, s.organization_id, s.lat, s.lng, s.kind\n'
  || E'      from public.jobs j\n'
  || E'      join lateral (select * from public.job_stops x where x.job_id = j.id and x.handed_at is null\n'
  || E'                     order by x.seq limit 1) s on true\n'
  || E'     where j.driver_id = v_driver\n'
  || E'       and j.job_kind <> ''one_way''\n'
  || E'       and j.status not in (''completed'', ''cancelled'', ''returned'')\n'
  || E'       and s.near_at is null and s.arrived_at is null\n'
  || E'       and s.lat is not null and s.lng is not null\n'
  || E'  loop\n'
  || E'    select coalesce(o.settings -> ''geofence'', ''{}''::jsonb) into v_cfg\n'
  || E'      from public.organizations o where o.id = v_stop.organization_id;\n'
  || E'    v_cfg := coalesce(v_cfg, ''{}''::jsonb);\n'
  || E'    continue when v_acc is not null\n'
  || E'              and v_acc > coalesce((v_cfg ->> ''max_accuracy_m'')::double precision, 150);\n'
  || E'    v_radius := coalesce((v_cfg ->> case when v_stop.kind = ''pickup'' then ''pickup_m'' else ''delivery_m'' end)::integer, 300);\n'
  || E'    v_dist   := public._distance_m(p_lat, p_lng, v_stop.lat, v_stop.lng);\n'
  || E'    continue when v_dist > v_radius;\n'
  || E'    update public.job_stops set near_at = now() where id = v_stop.id and near_at is null;\n'
  || E'    if found then\n'
  || E'      insert into public.job_events (organization_id, job_id, driver_id, type, distance_m, radius_m, stop_id)\n'
  || E'      values (v_stop.organization_id, v_stop.job_id, v_driver, ''geofence_stop'', round(v_dist)::integer, v_radius, v_stop.id);\n'
  || E'    end if;\n'
  || E'  end loop;\n\n'
  || E'  return jsonb_build_object(''ok'', true);\nend;',
  'multi-stop stop geofence');

-- Reminders: stop legs.
select public._patch_function('public.reminder_send(uuid, text, text, timestamp with time zone, integer)'::regprocedure,
  E'  if p_leg not in (''pickup'', ''delivery'') or',
  E'  if (p_leg not in (''pickup'', ''delivery'') and p_leg !~ ''^stop:[0-9]+$'') /* multi-stop legs */ or',
  'multi-stop legs');
select public._patch_function('public.reminder_send(uuid, text, text, timestamp with time zone, integer)'::regprocedure,
  E'  v_stop text := case p_leg when ''pickup'' then ''pickup'' else ''drop-off'' end;',
  E'  v_stop text := case when p_leg = ''pickup'' then ''pickup'' when p_leg like ''stop:%'' then ''stop '' || substr(p_leg, 6) else ''drop-off'' end; -- multi-stop label',
  'multi-stop label');
select public._patch_function('public.reminder_send(uuid, text, text, timestamp with time zone, integer)'::regprocedure,
  E'  v_place := public._push_place(case p_leg when ''pickup'' then j.pickup_location else j.delivery_location end);',
  E'  v_place := public._push_place(coalesce( -- multi-stop place\n    (select s.address from public.job_stops s where s.job_id = j.id and p_leg = ''stop:'' || s.seq),\n    case p_leg when ''pickup'' then j.pickup_location else j.delivery_location end));',
  'multi-stop place');

select public._patch_function('public.reset_job_otp_attempts(uuid)'::regprocedure,
  E'  update public.jobs set otp_attempts = 0 where id = p_job_id;',
  E'  update public.jobs set otp_attempts = 0 where id = p_job_id;\n  update public.job_stops set otp_attempts = 0 where job_id = p_job_id; -- multi-stop reset',
  'multi-stop reset');

create or replace function public.reminder_candidates()
returns table(job_id uuid, leg text, target timestamp with time zone, dest_lat double precision, dest_lng double precision,
              driver_lat double precision, driver_lng double precision, buffer_min integer,
              leave_sent boolean, late_sent boolean, eta_seconds integer)
language sql
stable security definer
set search_path to 'public'
as $$
  with legs as (
    select j.id, j.organization_id, j.driver_id, j.status, 'pickup'::text as leg,
           coalesce(j.pickup_window_start, j.scheduled_pickup_at) as target,
           j.pickup_lat as dest_lat, j.pickup_lng as dest_lng
      from public.jobs j
     where j.job_kind = 'one_way'
       and j.driver_pickup_at is null and j.driver_arrived_pickup_at is null
    union all
    select j.id, j.organization_id, j.driver_id, j.status, 'delivery', j.scheduled_delivery_start,
           j.delivery_lat, j.delivery_lng
      from public.jobs j
     where j.job_kind = 'one_way'
       and j.driver_pickup_at is not null
       and j.driver_arrived_delivery_at is null and j.driver_delivery_at is null
    union all
    select j.id, j.organization_id, j.driver_id, j.status, 'stop:' || s.seq, s.window_start, s.lat, s.lng
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
$$;

-- ─── Driver feed ────────────────────────────────────────────────────────────

create or replace function public._driver_instructions(j jobs)
returns text
language sql
stable
set search_path to 'public'
as $function$
  with tz as (
    select coalesce((select o.settings->>'timezone' from public.organizations o where o.id = j.organization_id), 'Asia/Dubai') as zone
  ),
  parts as (
    select
      nullif(btrim(j.special_instructions), '') as general,
      -- Multi-stop jobs carry their stops as structured data (app 1.1+).
      case when j.job_kind = 'one_way' then
      nullif(concat_ws(' · ',
        nullif(btrim(j.pickup_building), ''),
        nullif(btrim(j.pickup_company), ''),
        case when j.pickup_window_start is not null or j.pickup_window_end is not null then
          'window ' || concat_ws('–',
            to_char(j.pickup_window_start at time zone (select zone from tz), 'DD Mon HH24:MI'),
            to_char(j.pickup_window_end   at time zone (select zone from tz), 'DD Mon HH24:MI'))
        end,
        nullif(btrim(j.pickup_notes), '')), '') end as pickup,
      case when j.job_kind = 'one_way' then
      nullif(concat_ws(' · ',
        nullif(btrim(j.delivery_building), ''),
        nullif(btrim(j.delivery_company), ''),
        nullif(btrim(j.delivery_notes), '')), '') end as dropoff,
      nullif(concat_ws(' · ',
        case when coalesce(j.quantity, 1) > 1 then j.quantity || ' pieces' end,
        case when j.weight_kg > 0 then j.weight_kg::float8 || ' kg' end,
        case when coalesce(j.length_cm, 0) > 0 or coalesce(j.width_cm, 0) > 0 or coalesce(j.height_cm, 0) > 0 then
          concat_ws('×', coalesce(j.length_cm, 0)::float8, coalesce(j.width_cm, 0)::float8, coalesce(j.height_cm, 0)::float8) || ' cm'
        end,
        case j.vehicle_required
          when 'motorbike'    then 'motorbike'
          when 'cargo_van'    then 'cargo van needed'
          when 'flatbed_3t'   then '3-ton flatbed needed'
          when 'refrigerated' then 'refrigerated vehicle needed'
          else nullif(j.vehicle_required, '')
        end,
        (select string_agg(case f
                  when 'fragile'      then 'FRAGILE'
                  when 'refrigerated' then 'KEEP COLD'
                  when 'two_person'   then 'TWO-PERSON LIFT'
                  when 'hazmat'       then 'HAZARDOUS'
                  else upper(f) end, ', ')
           from unnest(j.handling_flags) f)), '') as cargo,
      case j.payment_mode when 'cod' then 'Cash on delivery — collect payment from the recipient' end as payment
  )
  select nullif(concat_ws(E'\n\n',
           general,
           'PICKUP — '   || pickup,
           'DROP-OFF — ' || dropoff,
           'CARGO — '    || cargo,
           'PAYMENT — '  || payment), '')
  from parts;
$function$;

create or replace function public.driver_jobs(p_token text, p_recent_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_driver uuid := public._driver_from_session(p_token);
  v_hours  integer := least(greatest(coalesce(p_recent_hours, 24), 1), 168);
  v_jobs   jsonb;
begin
  with base as (
    select j.*,
      case
        when j.status = 'returned'  then 'returned'
        when j.status = 'cancelled' then 'cancelled'
        when j.status = 'completed' or j.driver_delivery_at is not null then 'completed'
        else 'open'
      end as bucket,
      case
        when j.status = 'returned'  then coalesce(j.returned_at, j.updated_at)
        when j.status = 'cancelled' then coalesce(j.cancelled_at, j.updated_at)
        when j.status = 'completed' or j.driver_delivery_at is not null
          then coalesce(j.client_delivery_at, j.driver_delivery_at, j.updated_at)
      end as closed_at,
      public._driver_instructions(j) as driver_instructions,
      (select x from public.job_stops x
        where x.job_id = j.id and x.handed_at is null order by x.seq limit 1) as cur_stop
    from public.jobs j
    where j.driver_id = v_driver
      and (j.job_kind = 'one_way' or exists (select 1 from public.job_stops x where x.job_id = j.id))
  ),
  scoped as (
    select b.*,
      case when b.bucket = 'open' then
        row_number() over (
          partition by b.bucket
          order by (b.driver_arrived_pickup_at is null and b.driver_pickup_at is null),
                   coalesce(b.pickup_window_start, b.scheduled_pickup_at, b.created_at),
                   b.created_at
        )
      end as queue_pos
    from base b
    where b.bucket = 'open'
       or b.closed_at >= now() - make_interval(hours => v_hours)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'job_ref', s.job_ref,
      'job_kind', s.job_kind,
      'list_status',
        case when s.bucket = 'open'
             then case when s.queue_pos = 1 then 'active' else 'upcoming' end
             else s.bucket end,
      'stage',
        case
          when s.driver_delivery_at        is not null then 'dropped_off'
          when s.driver_arrived_delivery_at is not null then 'at_dropoff'
          when s.driver_pickup_at          is not null then 'picked_up'
          when s.driver_arrived_pickup_at  is not null then 'at_pickup'
          else 'heading_to_pickup'
        end,
      'status', s.status,
      'confirmation_mode', s.confirmation_mode,
      'item_type', s.item_type,
      'urgency', s.urgency,
      'service_tier', s.service_tier,
      'company_name', s.company_name,
      'sender_name', s.sender_name,
      'sender_phone', case when s.bucket = 'open' then s.sender_phone end,
      'recipient_name', s.recipient_name,
      'recipient_phone', case when s.bucket = 'open' then s.recipient_phone end,
      'pickup', jsonb_build_object(
        'address', s.pickup_location, 'emirate', s.pickup_emirate,
        'lat', s.pickup_lat, 'lng', s.pickup_lng,
        'building', s.pickup_building, 'company', s.pickup_company, 'notes', s.pickup_notes,
        'window_start', s.pickup_window_start, 'window_end', s.pickup_window_end),
      'dropoff', jsonb_build_object(
        'address', s.delivery_location, 'emirate', s.delivery_emirate,
        'lat', s.delivery_lat, 'lng', s.delivery_lng,
        'building', s.delivery_building, 'company', s.delivery_company, 'notes', s.delivery_notes,
        'window_start', s.scheduled_delivery_start, 'window_end', s.scheduled_delivery_end),
      'stops', case when s.job_kind <> 'one_way' then public._driver_stops_json(s.id, s.bucket = 'open') end,
      'current_stop_id', (s.cur_stop).id,
      'cargo', jsonb_build_object(
        'vehicle_required', s.vehicle_required, 'quantity', s.quantity, 'weight_kg', s.weight_kg,
        'length_cm', s.length_cm, 'width_cm', s.width_cm, 'height_cm', s.height_cm,
        'handling', to_jsonb(s.handling_flags)),
      'payment_mode', s.payment_mode,
      'scheduled_pickup_at', s.scheduled_pickup_at,
      'special_instructions', s.driver_instructions,
      'driver_payout_aed', s.driver_payout_aed,
      'driver_remark', s.driver_remark,
      -- Mirrors confirm_job_step's / driver_stop_handoff's max-attempts constant (5). Keep in sync.
      'otp_locked', case when s.job_kind = 'one_way' then coalesce(s.otp_attempts, 0) >= 5
                         else coalesce((s.cur_stop).otp_attempts, 0) >= 5 end,
      'arrivals',
          coalesce(case when s.driver_arrived_pickup_at is not null then
            jsonb_build_array(jsonb_build_object(
              'kind', 'pickup', 'at', s.driver_arrived_pickup_at,
              'lat', s.driver_arrived_pickup_lat, 'lng', s.driver_arrived_pickup_lng)) end,
            '[]'::jsonb)
       || coalesce(case when s.driver_arrived_delivery_at is not null then
            jsonb_build_array(jsonb_build_object(
              'kind', 'dropoff', 'at', s.driver_arrived_delivery_at,
              'lat', s.driver_arrived_delivery_lat, 'lng', s.driver_arrived_delivery_lng)) end,
            '[]'::jsonb),
      'returned_at', s.returned_at,
      'return_reason', s.return_reason,
      'cancellation_reason', s.cancellation_reason,
      'created_at', s.created_at
    )
    order by (s.bucket <> 'open'), s.queue_pos, s.closed_at desc
  ), '[]'::jsonb)
  into v_jobs
  from scoped s;

  return jsonb_build_object('ok', true, 'server_time', now(), 'jobs', v_jobs);
end;
$function$;

-- ─── Client links ───────────────────────────────────────────────────────────

drop function if exists public.get_job_by_token(text);
create function public.get_job_by_token(p_token text)
returns table(id uuid, job_ref text, status job_status, confirmation_mode text, sender_name text, sender_phone text,
  recipient_name text, recipient_phone text, pickup_emirate text, pickup_location text, delivery_emirate text,
  delivery_location text, pickup_lat double precision, pickup_lng double precision, delivery_lat double precision,
  delivery_lng double precision, item_type item_type, urgency urgency_level, company_name text, driver_id uuid,
  driver_lat double precision, driver_lng double precision, driver_updated_at timestamp with time zone, locked boolean,
  cancellation_reason text, cancelled_at timestamp with time zone, created_at timestamp with time zone,
  updated_at timestamp with time zone, client_pickup_at timestamp with time zone, driver_pickup_at timestamp with time zone,
  driver_delivery_at timestamp with time zone, client_delivery_at timestamp with time zone,
  client_pickup_confirmed_at timestamp with time zone, driver_pickup_confirmed_at timestamp with time zone,
  driver_delivery_confirmed_at timestamp with time zone, client_delivery_confirmed_at timestamp with time zone,
  driver_arrived_pickup_at timestamp with time zone, driver_arrived_delivery_at timestamp with time zone,
  sender_ready_at timestamp with time zone, scheduled_pickup_at timestamp with time zone, otp_own character,
  token_driver_pickup uuid, token_driver_delivery uuid, pickup_window_start timestamp with time zone,
  pickup_window_end timestamp with time zone, delivery_window_start timestamp with time zone,
  delivery_window_end timestamp with time zone, tracking_opens_at timestamp with time zone,
  job_kind text, stops jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_is_driver boolean := false;
  v_open boolean;
  v_viewer uuid;
  v_otp character(6);
BEGIN
  SELECT * INTO v_job FROM public.jobs j
  WHERE j.token_client_pickup::text = p_token
     OR j.token_driver_pickup::text = p_token
     OR j.token_driver_delivery::text = p_token
     OR j.token_client_delivery::text = p_token
     OR j.tracking_token = p_token;

  IF NOT FOUND THEN
    -- A middle stop's own link.
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

  -- Client links see the driver's position only once tracking opens.
  v_open := v_is_driver OR public.is_org_member(v_job.organization_id) OR public.job_tracking_open(v_job);

  IF v_job.job_kind <> 'one_way' AND NOT v_is_driver THEN
    v_viewer := public._try_uuid(p_token);
    -- The viewer's code: their next stop still to be handed over.
    SELECT s.otp INTO v_otp FROM public.job_stops s
     WHERE s.job_id = v_job.id AND s.token = v_viewer AND s.handed_at IS NULL
     ORDER BY s.seq LIMIT 1;
  END IF;

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
    CASE WHEN v_job.job_kind <> 'one_way' THEN public.job_stops_json(v_job.id, v_viewer) END;
END;
$function$;
grant execute on function public.get_job_by_token(text) to anon, authenticated, service_role;

create or replace function public.get_job_driver_by_token(p_token text)
returns table(full_name text, phone text, vehicle_type text, vehicle_make text, vehicle_model text, vehicle_plate text)
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_job public.jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.jobs j
  WHERE j.token_client_pickup::text = p_token
     OR j.token_client_delivery::text = p_token
     OR j.tracking_token = p_token;

  IF NOT FOUND THEN
    SELECT * INTO v_job FROM public.jobs j WHERE j.id = public._stop_link_job(p_token) AND j.job_kind <> 'one_way';
  END IF;

  IF NOT FOUND OR v_job.driver_id IS NULL THEN
    RETURN;
  END IF;

  IF public.job_link_expired(v_job) AND NOT public.is_org_member(v_job.organization_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT d.full_name,
         CASE WHEN v_job.status::text IN ('completed', 'cancelled', 'returned')
              THEN NULL
              WHEN NOT (public.job_tracking_open(v_job) OR public.is_org_member(v_job.organization_id)) THEN NULL
              ELSE coalesce(nullif(d.phone, ''), d.whatsapp) END,
         d.vehicle_type, d.vehicle_make, d.vehicle_model, d.vehicle_plate
    FROM public.drivers d
   WHERE d.id = v_job.driver_id;
END;
$function$;

drop function if exists public.get_job_pod_by_token(text);
create function public.get_job_pod_by_token(p_token text)
returns table(step text, method text, driver_lat double precision, driver_lng double precision, accuracy_m double precision,
              fix_age_s integer, confirmed_at timestamp with time zone, stop_id uuid)
language sql
stable security definer
set search_path to 'public'
as $function$
  with job as (
    select j.id from public.jobs j
     where (j.token_client_pickup::text = p_token
        or j.token_driver_pickup::text = p_token
        or j.token_driver_delivery::text = p_token
        or j.token_client_delivery::text = p_token
        or j.tracking_token = p_token
        or j.id = public._stop_link_job(p_token))
       and not (public.job_link_expired(j) and not public.is_org_member(j.organization_id))
     limit 1
  ),
  latest as (
    select distinct on (l.step, l.stop_id) l.*
      from public.job_pod_log l
      join job on job.id = l.job_id
     order by l.step, l.stop_id, l.created_at desc
  )
  select step, method, driver_lat, driver_lng, accuracy_m::double precision, fix_age_s, created_at, stop_id
    from latest
   where action = 'confirmed';
$function$;
revoke all on function public.get_job_pod_by_token(text) from public;
grant execute on function public.get_job_pod_by_token(text) to anon, authenticated, service_role;

-- Middle-stop link views are kept on the stop (job_link_views stays sender/recipient).
select public._patch_function('public.track_link_seen(text, boolean)'::regprocedure,
  E'  if not found then\n    return;\n  end if;\n\n  v_party :=',
  E'  if not found then\n'
  || E'    -- multi-stop link views\n'
  || E'    update public.job_stops s\n'
  || E'       set last_seen_at = now(),\n'
  || E'           visits = s.visits + case when p_new_visit then 1 else 0 end\n'
  || E'     where s.token = public._try_uuid(p_token)\n'
  || E'       and (p_new_visit or s.last_seen_at is null or s.last_seen_at < now() - interval ''50 seconds'');\n'
  || E'    return;\n  end if;\n\n  v_party :=',
  'multi-stop link views');

drop function public._patch_function(regprocedure, text, text, text);

commit;
