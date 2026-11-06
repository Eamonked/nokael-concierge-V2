-- Smoke test for supabase-multi-stop.sql. Never commits.
--
-- Dry run: paste the migration body WITHOUT its begin;/commit; lines, then this
-- file, and run both together. The final RAISE aborts the transaction, so
-- nothing is kept; the error message is the test report. job_ref_seq is not
-- touched (trg_set_job_ref is disabled inside the transaction).
--
-- After the migration is applied it can also be run on its own.

do $smoke$
declare
  v_org   uuid := '89412cf2-dd3a-447c-906a-e59aaa64926d';
  v_user  uuid := 'fb81c0b6-1797-4ce4-8107-efa8bed76b90';
  v_drv   uuid;
  v_old_drv uuid;
  v_tok   text := 'smoke-' || md5(random()::text) || md5(random()::text);
  v_old_tok text := 'smoke-' || md5(random()::text) || md5(random()::text);
  v_job   uuid;
  v_one   uuid;
  r       jsonb;
  v_stops jsonb;
  s       record;
  j       public.jobs%rowtype;
  v_log   text[] := '{}';
  v_n     integer;
  v_otp   text;
  v_ok    boolean;
  v_row   record;
  v_err   text;
begin
  alter table public.jobs disable trigger trg_set_job_ref;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.drivers (full_name, phone, whatsapp, email, base_location, vehicle_type, active, onboarding_status, organization_id)
  values ('Smoke Driver', '+971500000001', '+971500000001', 'smoke1@example.invalid', 'Dubai', 'car', true, 'approved', v_org) returning id into v_drv;
  insert into public.driver_sessions (driver_id, token_hash, device_label, expires_at, app_platform, app_version)
  values (v_drv, public._driver_hash_token(v_tok), 'smoke', now() + interval '1 day', 'android', '1.1.0');
  insert into public.drivers (full_name, phone, whatsapp, email, base_location, vehicle_type, active, onboarding_status, organization_id)
  values ('Old App Driver', '+971500000002', '+971500000002', 'smoke2@example.invalid', 'Dubai', 'car', true, 'approved', v_org) returning id into v_old_drv;
  insert into public.driver_sessions (driver_id, token_hash, device_label, expires_at, app_platform, app_version)
  values (v_old_drv, public._driver_hash_token(v_old_tok), 'smoke', now() + interval '1 day', 'android', '1.0.6');

  -- ── Round trip: A → B, collect at B, back to A ──
  insert into public.jobs (job_ref, organization_id, job_kind, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status,
    confirmation_mode, token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery)
  values ('SMOKE-RT', v_org, 'round_trip', 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Dubai', 'A street', 'Abu Dhabi', 'B street', 'document', 'today', 'pending', 'four_step',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '111111', '222222', '333333', '333333')
  returning id into v_job;

  r := public.save_job_stops(v_job, jsonb_build_array(
    jsonb_build_object('kind', 'pickup', 'contact_name', 'Alice', 'contact_phone', '+971501111111', 'emirate', 'Dubai', 'address', 'A street', 'lat', 25.2, 'lng', 55.27),
    jsonb_build_object('kind', 'drop',   'contact_name', 'Bob',   'contact_phone', '+971502222222', 'emirate', 'Abu Dhabi', 'address', 'B street', 'lat', 24.45, 'lng', 54.38,
                       'window_start', now() - interval '2 hours', 'window_end', now() - interval '1 hour'),
    jsonb_build_object('kind', 'pickup', 'contact_name', 'Bob',   'contact_phone', '0502222222', 'emirate', 'Abu Dhabi', 'address', 'B street', 'lat', 24.45, 'lng', 54.38, 'item_note', 'Signed copy'),
    jsonb_build_object('kind', 'drop',   'contact_name', 'Alice', 'contact_phone', '+971501111111', 'emirate', 'Dubai', 'address', 'A street', 'lat', 25.2, 'lng', 55.27)));
  if not (r->>'ok')::boolean then raise exception 'FAIL save_job_stops: %', r; end if;
  v_stops := r->'stops';
  v_log := v_log || ('save ok, ' || jsonb_array_length(v_stops) || ' stops');

  select * into j from public.jobs where id = v_job;
  if j.confirmation_mode <> 'driver_only' or j.recipient_name <> 'Bob' or j.otp_sender <> '111111'
     or j.otp_recipient <> '222222' or j.token_client_pickup::text <> (v_stops->0->>'token')
     or j.token_client_delivery::text <> (v_stops->1->>'token') then
    raise exception 'FAIL mirror after save: % % % %', j.confirmation_mode, j.recipient_name, j.otp_sender, j.otp_recipient;
  end if;
  if (v_stops->0->>'token') <> (v_stops->3->>'token') or (v_stops->1->>'token') <> (v_stops->2->>'token') then
    raise exception 'FAIL same contact should share one link';
  end if;
  v_log := v_log || 'mirror + shared links ok'::text;

  -- Validation
  r := public.save_job_stops(v_job, jsonb_build_array(
    jsonb_build_object('kind', 'drop', 'address', 'x'), jsonb_build_object('kind', 'drop', 'address', 'y'), jsonb_build_object('kind', 'drop', 'address', 'z')));
  if r->>'error' <> 'first_stop_must_be_pickup' then raise exception 'FAIL validation: %', r; end if;
  v_log := v_log || 'validation ok'::text;

  -- Old app driver cannot be assigned; new app driver can.
  begin
    update public.jobs set driver_id = v_old_drv where id = v_job;
    raise exception 'FAIL old-app driver was assigned';
  exception when others then
    if sqlerrm <> 'needs_driver_app_1_1' then raise; end if;
  end;
  update public.jobs set driver_id = v_drv where id = v_job;
  v_log := v_log || 'app-version gate ok'::text;

  -- Driver feed
  r := public.driver_jobs(v_tok, 24);
  select x into r from jsonb_array_elements(r->'jobs') x where x->>'id' = v_job::text;
  if r->>'job_kind' <> 'round_trip' or jsonb_array_length(r->'stops') <> 4
     or r->>'current_stop_id' <> (v_stops->0->>'id') or (r->'stops'->0) ? 'otp' then
    raise exception 'FAIL driver_jobs: %', r;
  end if;
  v_log := v_log || 'driver_jobs ok'::text;

  -- Old RPCs refuse multi-stop jobs
  r := public.driver_confirm_handoff(v_tok, v_job, 'pickup', '111111');
  if r->>'error' <> 'needs_app_update' then raise exception 'FAIL legacy handoff: %', r; end if;
  r := public.confirm_job_step(j.token_driver_pickup::text, 'driver_pickup', '111111', null, null);
  if r->>'error' <> 'use_stop_handover' then raise exception 'FAIL confirm_job_step guard: %', r; end if;
  v_log := v_log || 'legacy RPC guards ok'::text;

  -- Out of order, wrong code, lock, reset
  r := public.driver_stop_arrive(v_tok, v_job, (v_stops->1->>'id')::uuid, 24.45, 54.38);
  if r->>'error' <> 'out_of_order' then raise exception 'FAIL out of order arrive: %', r; end if;
  r := public.driver_stop_handoff(v_tok, v_job, (v_stops->0->>'id')::uuid, '000000', null, null);
  if r->>'error' <> 'invalid_otp' then raise exception 'FAIL wrong code: %', r; end if;
  for v_n in 1 .. 4 loop
    r := public.driver_stop_handoff(v_tok, v_job, (v_stops->0->>'id')::uuid, '000000', null, null);
  end loop;
  if r->>'error' <> 'locked' then raise exception 'FAIL lock: %', r; end if;
  r := public.driver_stop_handoff(v_tok, v_job, (v_stops->0->>'id')::uuid, '111111', null, null);
  if r->>'error' <> 'locked' then raise exception 'FAIL lock holds with right code: %', r; end if;
  perform public.reset_job_otp_attempts(v_job);
  v_log := v_log || 'order + wrong code + lock + reset ok'::text;

  -- Client link for B (a stop link that is also the recipient link)
  select * into v_row from public.get_job_by_token(v_stops->1->>'token');
  if v_row.otp_own <> (v_stops->1->>'otp') or v_row.job_kind <> 'round_trip'
     or (select count(*) from jsonb_array_elements(v_row.stops) x where x ? 'otp' and x->>'otp' is not null) <> 2
     or exists (select 1 from jsonb_array_elements(v_row.stops) x where (x->>'mine')::boolean and x->>'seq' in ('1','4')) then
    raise exception 'FAIL B link: own=% stops=%', v_row.otp_own, v_row.stops;
  end if;
  v_log := v_log || 'B link shows only B codes ok'::text;

  -- Walk all four stops
  for v_n in 0 .. 3 loop
    r := public.driver_stop_arrive(v_tok, v_job, (v_stops->v_n->>'id')::uuid, 25.0, 55.0);
    if not (r->>'ok')::boolean then raise exception 'FAIL arrive %: %', v_n, r; end if;
    r := public.driver_stop_handoff(v_tok, v_job, (v_stops->v_n->>'id')::uuid, v_stops->v_n->>'otp', 25.0 + v_n, 55.0);
    if not (r->>'ok')::boolean then raise exception 'FAIL handoff %: %', v_n, r; end if;
    select * into j from public.jobs where id = v_job;
    v_log := v_log || ('stop ' || (v_n + 1) || ' → ' || j.status);
  end loop;
  if j.status <> 'completed' or j.driver_delivery_at is null or (r->>'completed')::boolean is not true then
    raise exception 'FAIL completion: % %', j.status, r;
  end if;

  select count(*) into v_n from public.job_pod_log where job_id = v_job and step = 'stop_handover' and method = 'otp' and stop_id is not null and driver_lat is not null;
  if v_n <> 4 then raise exception 'FAIL pod rows per stop: %', v_n; end if;
  select count(*) into v_n from public.job_pod_log where job_id = v_job and step <> 'stop_handover';
  if v_n <> 0 then raise exception 'FAIL mirror wrote legacy pod rows: %', v_n; end if;
  select count(*) into v_n from public.get_job_pod_by_token(v_stops->0->>'token');
  if v_n <> 4 then raise exception 'FAIL get_job_pod_by_token rows: %', v_n; end if;
  select count(*) into v_n from public.push_outbox where job_id = v_job and title ilike 'delivered%' and audience = 'tracking';
  v_log := v_log || ('pod rows 4, tracking "delivered" pushes ' || v_n);

  -- ── One-way job: unchanged path ──
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status,
    confirmation_mode, token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery, driver_id)
  values ('SMOKE-OW', v_org, 'Carol', '+971503333333', 'Dan', '+971504444444',
    'Dubai', 'C street', 'Abu Dhabi', 'D street', 'parcel', 'today', 'pending', 'driver_only',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '444444', '555555', '666666', '666666', v_old_drv)
  returning id into v_one;
  r := public.driver_arrive(v_old_tok, v_one, 'pickup', 25.1, 55.1);
  if not (r->>'ok')::boolean then raise exception 'FAIL one-way arrive: %', r; end if;
  r := public.driver_confirm_handoff(v_old_tok, v_one, 'pickup', '444444');
  if not (r->>'ok')::boolean then raise exception 'FAIL one-way pickup: %', r; end if;
  r := public.driver_confirm_handoff(v_old_tok, v_one, 'dropoff', '555555');
  if not (r->>'ok')::boolean then raise exception 'FAIL one-way dropoff: %', r; end if;
  select * into j from public.jobs where id = v_one;
  select count(*) into v_n from public.job_pod_log where job_id = v_one and method = 'otp' and stop_id is null;
  if j.status <> 'completed' or j.job_kind <> 'one_way' or v_n <> 2 then
    raise exception 'FAIL one-way: % % pod=%', j.status, j.job_kind, v_n;
  end if;
  select * into v_row from public.get_job_by_token(j.token_client_pickup::text);
  if v_row.otp_own <> '444444' or v_row.stops is not null then raise exception 'FAIL one-way link: %', v_row.otp_own; end if;
  r := public.driver_jobs(v_old_tok, 24);
  select x into r from jsonb_array_elements(r->'jobs') x where x->>'id' = v_one::text;
  if r->>'stage' <> 'dropped_off' or r ? 'stops' and r->'stops' <> 'null'::jsonb then raise exception 'FAIL one-way feed: %', r; end if;
  v_log := v_log || 'one-way unchanged ok'::text;

  -- Reminder candidates accept stop legs
  perform * from public.reminder_candidates();
  v_log := v_log || 'reminder_candidates runs'::text;

  raise exception 'SMOKE PASSED (rolled back): %', array_to_string(v_log, ' | ');
end
$smoke$;
