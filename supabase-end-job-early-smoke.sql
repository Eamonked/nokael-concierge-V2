-- Smoke test for supabase-end-job-early.sql. Never commits (final RAISE).
-- Dry run: paste the migration body, then this file, and run both together.

do $smoke$
declare
  v_org   uuid := '89412cf2-dd3a-447c-906a-e59aaa64926d';
  v_user  uuid := 'fb81c0b6-1797-4ce4-8107-efa8bed76b90';
  v_drv   uuid;
  v_tok   text := 'smoke-' || md5(random()::text) || md5(random()::text);
  v_job   uuid;
  v_job2  uuid;
  j       public.jobs%rowtype;
  r       jsonb;
  s       record;
  v_log   text[] := '{}';
  v_n     integer;
  v_t2    timestamptz;
begin
  alter table public.jobs disable trigger trg_set_job_ref;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.drivers (full_name, phone, whatsapp, email, base_location, vehicle_type, active, onboarding_status, organization_id)
  values ('Smoke Driver', '+971500000001', '+971500000001', 'smoke1@example.invalid', 'Dubai', 'car', true, 'approved', v_org) returning id into v_drv;
  insert into public.driver_sessions (driver_id, token_hash, device_label, expires_at, app_platform, app_version)
  values (v_drv, public._driver_hash_token(v_tok), 'smoke', now() + interval '1 day', 'android', '1.1.0');

  -- Round trip A → B, collect at B → back to A; driver on 1.1.
  insert into public.jobs (job_ref, organization_id, job_kind, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status,
    confirmation_mode, token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery, driver_id)
  values ('SMOKE-EE', v_org, 'round_trip', 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Dubai', 'A street', 'Abu Dhabi', 'B street', 'document', 'today', 'pending', 'driver_only',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '111111', '222222', '333333', '333333', v_drv)
  returning id into v_job;
  r := public.save_job_stops(v_job, jsonb_build_array(
    jsonb_build_object('kind', 'pickup', 'contact_name', 'Alice', 'contact_phone', '+971501111111', 'address', 'A street', 'lat', 25.2, 'lng', 55.27),
    jsonb_build_object('kind', 'drop',   'contact_name', 'Bob',   'contact_phone', '+971502222222', 'address', 'B street', 'lat', 24.45, 'lng', 54.38),
    jsonb_build_object('kind', 'pickup', 'contact_name', 'Bob',   'contact_phone', '+971502222222', 'address', 'B street', 'lat', 24.45, 'lng', 54.38),
    jsonb_build_object('kind', 'drop',   'contact_name', 'Alice', 'contact_phone', '+971501111111', 'address', 'A street', 'lat', 25.2, 'lng', 55.27)));
  if not (r->>'ok')::boolean then raise exception 'FAIL save: %', r; end if;

  -- Not collected yet: refused (that is a cancellation).
  r := public.ops_end_job_early(v_job, 'Client changed plan');
  if r->>'error' is distinct from 'nothing_collected' then raise exception 'FAIL pending end: %', r; end if;

  -- Driver does stops 1 and 2.
  for s in select * from public.job_stops where job_id = v_job and seq <= 2 order by seq loop
    r := public.driver_stop_arrive(v_tok, v_job, s.id, s.lat, s.lng);
    if not coalesce((r->>'ok')::boolean, false) then raise exception 'FAIL arrive %: %', s.seq, r; end if;
    r := public.driver_stop_handoff(v_tok, v_job, s.id, s.otp, s.lat, s.lng);
    if not coalesce((r->>'ok')::boolean, false) then raise exception 'FAIL handoff %: %', s.seq, r; end if;
  end loop;
  select handed_at into v_t2 from public.job_stops where job_id = v_job and seq = 2;
  -- Driver already at stop 3 when the client calls it off.
  select * into s from public.job_stops where job_id = v_job and seq = 3;
  r := public.driver_stop_arrive(v_tok, v_job, s.id, s.lat, s.lng);

  r := public.ops_end_job_early(v_job, '   ');
  if r->>'error' is distinct from 'reason_required' then raise exception 'FAIL blank reason: %', r; end if;

  r := public.ops_end_job_early(v_job, 'Client: no return needed');
  if not (r->>'ok')::boolean or (r->>'ended_at_stop')::int <> 2 or (r->>'skipped')::int <> 2 then
    raise exception 'FAIL end early: %', r;
  end if;
  select * into j from public.jobs where id = v_job;
  if j.status <> 'completed' or j.driver_delivery_at is distinct from v_t2 then
    raise exception 'FAIL job after end: % %', j.status, j.driver_delivery_at;
  end if;
  select count(*) into v_n from public.job_stops
   where job_id = v_job and skipped_at is not null and skip_reason = 'Client: no return needed' and skipped_by = v_user;
  if v_n <> 2 then raise exception 'FAIL skipped rows %', v_n; end if;
  select count(*) into v_n from public.job_stops where job_id = v_job and seq = 3 and arrived_at is not null and handed_at is null;
  if v_n <> 1 then raise exception 'FAIL stop 3 arrival kept'; end if;
  v_log := v_log || 'ended at stop 2: completed at stop 2 handover, stops 3-4 not visited'::text;

  -- Links: skipped status, no code; driver list leaves them out.
  select count(*) into v_n from jsonb_array_elements(public.job_stops_json(v_job, j.token_client_pickup)) e
   where e->>'status' = 'skipped' and e->>'otp' is null;
  if v_n <> 2 then raise exception 'FAIL link json %', public.job_stops_json(v_job, j.token_client_pickup); end if;
  if jsonb_array_length(public._driver_stops_json(v_job, false)) <> 2 then raise exception 'FAIL driver json'; end if;
  v_log := v_log || 'links show not visited (no code), driver list has 2 stops'::text;

  -- Closed job: refused; driver can no longer act on stop 3.
  r := public.ops_end_job_early(v_job, 'again');
  if r->>'error' is distinct from 'job_closed' then raise exception 'FAIL re-end: %', r; end if;
  r := public.driver_stop_handoff(v_tok, v_job, s.id, s.otp, s.lat, s.lng);
  if r->>'error' is distinct from 'job_closed' then raise exception 'FAIL driver after end: %', r; end if;
  v_log := v_log || 'closed: re-end and driver handoff refused'::text;

  -- A normal round trip still completes on the last handover.
  insert into public.jobs (job_ref, organization_id, job_kind, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status,
    confirmation_mode, token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery, driver_id)
  values ('SMOKE-EE2', v_org, 'multi_stop', 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Dubai', 'A street', 'Abu Dhabi', 'B street', 'document', 'today', 'pending', 'driver_only',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '111111', '222222', '333333', '333333', v_drv)
  returning id into v_job2;
  r := public.save_job_stops(v_job2, jsonb_build_array(
    jsonb_build_object('kind', 'pickup', 'contact_name', 'Alice', 'contact_phone', '+971501111111', 'address', 'A street'),
    jsonb_build_object('kind', 'drop',   'contact_name', 'Bob',   'contact_phone', '+971502222222', 'address', 'B street')));
  for s in select * from public.job_stops where job_id = v_job2 order by seq loop
    r := public.driver_stop_handoff(v_tok, v_job2, s.id, s.otp, null, null);
    if not coalesce((r->>'ok')::boolean, false) then raise exception 'FAIL normal handoff %: %', s.seq, r; end if;
  end loop;
  select * into j from public.jobs where id = v_job2;
  if j.status <> 'completed' or j.driver_delivery_at is null then raise exception 'FAIL normal completion %', j.status; end if;
  v_log := v_log || 'normal multi-stop still completes'::text;

  raise exception 'SMOKE PASSED (rolled back): %', array_to_string(v_log, ' | ');
end;
$smoke$;
