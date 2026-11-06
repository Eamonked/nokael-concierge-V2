-- Smoke test for supabase-convert-to-stops.sql. Never commits (final RAISE).
-- Dry run: paste the migration body, then this file, and run both together.

do $smoke$
declare
  v_org   uuid := '89412cf2-dd3a-447c-906a-e59aaa64926d';
  v_user  uuid := 'fb81c0b6-1797-4ce4-8107-efa8bed76b90';
  v_drv   uuid;
  v_old_drv uuid;
  v_tok   text := 'smoke-' || md5(random()::text) || md5(random()::text);
  v_old_tok text := 'smoke-' || md5(random()::text) || md5(random()::text);
  v_job   uuid;
  v_job2  uuid;
  j0      public.jobs%rowtype;
  j       public.jobs%rowtype;
  r       jsonb;
  s       record;
  v_log   text[] := '{}';
  v_n     integer;
  v_stops jsonb;
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

  -- One-way job like NOK-0105: driver_only, collected, on the way to B.
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, pickup_lat, pickup_lng, delivery_emirate, delivery_location, delivery_lat, delivery_lng,
    item_type, urgency, status, confirmation_mode, driver_id,
    token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery)
  values ('SMOKE-CV', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Abu Dhabi', 'A street', 24.53, 54.40, 'Dubai', 'B street', 25.11, 55.24,
    'parcel', 'immediate', 'pending', 'driver_only', v_old_drv,
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '111111', '222222', '333333', '444444')
  returning id into v_job;
  update public.jobs set driver_arrived_pickup_at = now() - interval '30 min', driver_arrived_pickup_lat = 24.53,
    driver_arrived_pickup_lng = 54.40 where id = v_job;
  update public.jobs set driver_pickup_at = now() - interval '25 min', status = 'driver_pickup' where id = v_job;
  select * into j0 from public.jobs where id = v_job;
  select count(*) into v_n from public.job_pod_log where job_id = v_job and step = 'driver_pickup';
  if v_n <> 1 then raise exception 'FAIL setup pod rows %', v_n; end if;

  v_stops := jsonb_build_array(
    jsonb_build_object('id', 'from_pickup', 'kind', 'pickup', 'address', 'A street'),
    jsonb_build_object('id', 'from_delivery', 'kind', 'drop', 'contact_name', 'Bob', 'contact_phone', '+971502222222',
                       'emirate', 'Dubai', 'address', 'B street', 'lat', 25.11, 'lng', 55.24),
    jsonb_build_object('kind', 'pickup', 'contact_name', 'Bob', 'contact_phone', '0502222222', 'emirate', 'Dubai',
                       'address', 'B street', 'lat', 25.11, 'lng', 55.24, 'item_note', 'Return item'),
    jsonb_build_object('kind', 'drop', 'contact_name', 'Alice', 'contact_phone', '+971501111111', 'emirate', 'Abu Dhabi',
                       'address', 'A street', 'lat', 24.53, 'lng', 54.40));

  -- Old app driver: refused, nothing changes.
  r := public.convert_job_to_stops(v_job, 'round_trip', v_stops);
  if r->>'error' is distinct from 'needs_driver_app_1_1' then raise exception 'FAIL old app gate: %', r; end if;
  begin
    update public.jobs set job_kind = 'round_trip' where id = v_job;
    raise exception 'FAIL trigger allowed kind change for old app';
  exception when raise_exception then
    if sqlerrm <> 'needs_driver_app_1_1' then raise; end if;
  end;
  v_log := v_log || 'old app refused (rpc + trigger)'::text;

  -- Driver on 1.1: bad list is refused and rolled back.
  update public.jobs set driver_id = v_drv where id = v_job;
  r := public.convert_job_to_stops(v_job, 'round_trip', jsonb_build_array(v_stops -> 0, v_stops -> 2));
  if (r->>'ok')::boolean then raise exception 'FAIL bad list accepted: %', r; end if;
  select * into j from public.jobs where id = v_job;
  select count(*) into v_n from public.job_stops where job_id = v_job;
  if j.job_kind <> 'one_way' or v_n <> 0 then raise exception 'FAIL bad list not rolled back (%/%)', j.job_kind, v_n; end if;
  v_log := v_log || ('bad list refused: ' || (r->>'error'))::text;

  r := public.convert_job_to_stops(v_job, 'round_trip', v_stops);
  if not (r->>'ok')::boolean then raise exception 'FAIL convert: %', r; end if;
  select * into j from public.jobs where id = v_job;
  if j.job_kind <> 'round_trip' or j.status <> 'driver_pickup' or j.job_ref <> 'SMOKE-CV'
     or j.token_client_pickup <> j0.token_client_pickup or j.token_client_delivery <> j0.token_client_delivery
     or j.otp_sender <> j0.otp_sender or j.otp_recipient <> j0.otp_recipient
     or j.driver_pickup_at <> j0.driver_pickup_at or j.driver_delivery_at is not null then
    raise exception 'FAIL mirror after convert: %', to_jsonb(j);
  end if;
  select count(*) into v_n from public.job_stops where job_id = v_job and handed_at is not null and seq = 1 and method is not null;
  if v_n <> 1 then raise exception 'FAIL stop 1 not carried as handed'; end if;
  select count(*) into v_n from public.job_stops where job_id = v_job;
  if v_n <> 4 then raise exception 'FAIL stop count %', v_n; end if;
  -- Alice's return drop shares stop 1's link.
  select count(distinct token) into v_n from public.job_stops where job_id = v_job;
  if v_n <> 2 then raise exception 'FAIL shared links %', v_n; end if;
  select count(*) into v_n from public.job_pod_log where job_id = v_job and step = 'stop_handover';
  if v_n <> 1 then raise exception 'FAIL stop 1 pod row %', v_n; end if;
  v_log := v_log || 'converted collected job: same ref, links, codes; stop 1 handed'::text;

  -- Converting again is refused.
  r := public.convert_job_to_stops(v_job, 'multi_stop', v_stops);
  if r->>'error' is distinct from 'already_multi_stop' then raise exception 'FAIL reconvert: %', r; end if;

  -- Driver walks stops 2-4.
  for s in select * from public.job_stops where job_id = v_job and seq > 1 order by seq loop
    r := public.driver_stop_arrive(v_tok, v_job, s.id, s.lat, s.lng);
    if not coalesce((r->>'ok')::boolean, false) then raise exception 'FAIL arrive %: %', s.seq, r; end if;
    r := public.driver_stop_handoff(v_tok, v_job, s.id, s.otp, s.lat, s.lng);
    if not coalesce((r->>'ok')::boolean, false) then raise exception 'FAIL handoff %: %', s.seq, r; end if;
  end loop;
  select * into j from public.jobs where id = v_job;
  if j.status <> 'completed' or j.driver_delivery_at is null then raise exception 'FAIL completion %', j.status; end if;
  select count(*) into v_n from (select distinct on (step, stop_id) * from public.job_pod_log
                                  where job_id = v_job and step = 'stop_handover' order by step, stop_id, created_at desc) x;
  if v_n <> 4 then raise exception 'FAIL pod rows per stop %', v_n; end if;
  v_log := v_log || 'walked to completed, 4 handover rows'::text;

  -- A pending four-step job without driver converts to multi-stop (B kept, C added).
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status, confirmation_mode,
    token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery)
  values ('SMOKE-CV2', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Dubai', 'A street', 'Dubai', 'B street', 'document', 'today', 'pending', 'four_step',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '111111', '222222', '333333', '444444')
  returning id into v_job2;
  select * into j0 from public.jobs where id = v_job2;
  r := public.convert_job_to_stops(v_job2, 'multi_stop', jsonb_build_array(
    jsonb_build_object('id', 'from_pickup', 'kind', 'pickup', 'contact_name', 'Alice', 'contact_phone', '+971501111111', 'address', 'A street, edited'),
    jsonb_build_object('kind', 'drop', 'contact_name', 'Cara', 'contact_phone', '+971503333333', 'address', 'C street'),
    jsonb_build_object('id', 'from_delivery', 'kind', 'drop', 'contact_name', 'Bob', 'contact_phone', '+971502222222', 'address', 'B street')));
  if not (r->>'ok')::boolean then raise exception 'FAIL convert pending: %', r; end if;
  select * into j from public.jobs where id = v_job2;
  if j.confirmation_mode <> 'driver_only' or j.status <> 'pending' or j.pickup_location <> 'A street, edited'
     or j.recipient_name <> 'Cara' then
    raise exception 'FAIL pending convert mirror: %', to_jsonb(j);
  end if;
  -- Bob keeps his original recipient link and code on his (now third) stop.
  select count(*) into v_n from public.job_stops st
   where st.job_id = v_job2 and st.seq = 3 and st.contact_name = 'Bob'
     and st.token = j0.token_client_delivery and st.otp = '222222';
  if v_n <> 1 then raise exception 'FAIL Bob lost his link/code'; end if;
  v_log := v_log || 'pending four-step → multi_stop, edited stop 1, new first drop'::text;

  raise exception 'SMOKE PASSED (rolled back): %', array_to_string(v_log, ' | ');
end;
$smoke$;
