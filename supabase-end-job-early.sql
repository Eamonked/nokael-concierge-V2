-- End a multi-stop / round-trip job early, at the last stop handed over.
--
-- When the client decides the job stops at a certain stop, dispatch (only)
-- closes it there: every stop not yet handed over is marked "not visited"
-- (skipped_at, with who and why), and the job completes at the time of the
-- last real handover. Links, certificate and history show those stops as
-- not visited. Nothing already handed over changes.
--
-- Requires supabase-multi-stop.sql. Re-runnable.

alter table public.job_stops
  add column if not exists skipped_at  timestamptz,
  add column if not exists skipped_by  uuid,
  add column if not exists skip_reason text;

-- Mirror: a not-visited stop counts as done; the delivery time is the last
-- real handover.
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
  select * into sl from public.job_stops where job_id = p_job_id and handed_at is not null order by seq desc limit 1;
  select count(*), count(*) filter (where handed_at is not null or skipped_at is not null)
    into v_total, v_done from public.job_stops where job_id = p_job_id;

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

-- Client links / certificate: not-visited stops show as 'skipped', no code.
create or replace function public.job_stops_json(p_job_id uuid, p_viewer uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'seq', s.seq, 'kind', s.kind,
      'emirate', s.emirate, 'address', s.address, 'lat', s.lat, 'lng', s.lng,
      'building', s.building, 'company', s.company, 'item_note', s.item_note,
      'window_start', s.window_start, 'window_end', s.window_end,
      'arrived_at', s.arrived_at, 'handed_at', s.handed_at, 'method', s.method,
      'skipped_at', s.skipped_at,
      'status', case when s.handed_at is not null then 'handed'
                     when s.skipped_at is not null then 'skipped'
                     when s.arrived_at is not null then 'arrived' else 'pending' end,
      'mine', p_viewer is not null and s.token = p_viewer,
      'contact_name', case when p_viewer is not null and s.token = p_viewer then s.contact_name end,
      'otp', case when p_viewer is not null and s.token = p_viewer
                   and s.handed_at is null and s.skipped_at is null then s.otp end
    ) order by s.seq), '[]'::jsonb)
  from public.job_stops s
  where s.job_id = p_job_id;
$$;

-- Driver app: not-visited stops are left out, so Nokael Driver 1.1 (which
-- treats every listed stop that is not handed over as still to do) shows an
-- ended job as finished.
create or replace function public._driver_stops_json(p_job_id uuid, p_open boolean)
returns jsonb
language sql
stable security definer
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
      'otp_locked', s.otp_attempts >= 5,
      'status', case when s.handed_at is not null then 'handed'
                     when s.arrived_at is not null then 'arrived' else 'pending' end
    ) order by s.seq), '[]'::jsonb)
  from public.job_stops s
  where s.job_id = p_job_id and s.skipped_at is null;
$$;

-- Dispatch only: close the job at the last stop handed over.
create or replace function public.ops_end_job_early(p_job_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  j        public.jobs%rowtype;
  v_last   integer;
  v_n      integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
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
  if j.status <> 'driver_pickup' then
    -- Nothing collected yet: that is a cancellation, not an early finish.
    return jsonb_build_object('ok', false, 'error', 'nothing_collected');
  end if;
  if v_reason is null then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select max(seq) into v_last from public.job_stops where job_id = p_job_id and handed_at is not null;

  update public.job_stops
     set skipped_at = now(), skipped_by = auth.uid(), skip_reason = left(v_reason, 500), updated_at = now()
   where job_id = p_job_id and handed_at is null and skipped_at is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'error', 'nothing_left');
  end if;

  perform public._sync_job_from_stops(p_job_id);
  return jsonb_build_object('ok', true, 'ended_at_stop', v_last, 'skipped', v_n);
end;
$$;
revoke all on function public.ops_end_job_early(uuid, text) from public, anon;
grant execute on function public.ops_end_job_early(uuid, text) to authenticated;
