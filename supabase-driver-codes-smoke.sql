-- Smoke test for supabase-driver-codes.sql. Never commits (final RAISE).
-- Dry run: paste the migration body without begin;/commit; before this file.
do $smoke$
declare
  v_org  uuid := '89412cf2-dd3a-447c-906a-e59aaa64926d';
  v_user uuid := 'fb81c0b6-1797-4ce4-8107-efa8bed76b90';
  v_drv  uuid;
  v_tok  text := 'smoke-' || md5(random()::text) || md5(random()::text);
  v_job  uuid;
  v_rt   uuid;
  v_ws   timestamptz := date_trunc('minute', now()) - interval '10 min';
  r      jsonb;
  v_stops jsonb;
  v_log  text[] := '{}';
begin
  alter table public.jobs disable trigger trg_set_job_ref;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.drivers (full_name, phone, whatsapp, email, base_location, vehicle_type, active, onboarding_status, organization_id)
  values ('Smoke Driver', '+971500000001', '+971500000001', 'smoke1@example.invalid', 'Dubai', 'car', true, 'approved', v_org) returning id into v_drv;
  insert into public.driver_sessions (driver_id, token_hash, device_label, expires_at, app_platform, app_version)
  values (v_drv, public._driver_hash_token(v_tok), 'smoke', now() + interval '1 day', 'android', '1.2.0');

  -- ── One-way: the other party's code ──
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, pickup_lat, pickup_lng, delivery_lat, delivery_lng,
    item_type, urgency, status, confirmation_mode, token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery,
    pickup_window_start, pickup_window_end, scheduled_delivery_start, scheduled_delivery_end)
  values ('SMOKE-W1', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Dubai', 'A street', 'Dubai', 'B street', 25.2, 55.27, 25.1, 55.2, 'document', 'today', 'pending', 'driver_only',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '111111', '222222', '333333', '444444',
    v_ws, v_ws + interval '2 hours', v_ws + interval '3 hours', v_ws + interval '5 hours')
  returning id into v_job;
  update public.jobs set driver_id = v_drv where id = v_job;

  update public.jobs set driver_arrived_pickup_at = now() where id = v_job;

  -- ── Wrong party's code at pickup / drop-off ──
  r := public.driver_confirm_handoff(v_tok, v_job, 'pickup', '222222');
  if r ->> 'error' <> 'invalid_otp' or r ->> 'code_belongs_to' <> 'recipient' then raise exception 'FAIL recipient code at pickup: %', r; end if;
  if (select otp_attempts from public.jobs where id = v_job) <> 1 then raise exception 'FAIL attempt not counted'; end if;
  r := public.driver_confirm_handoff(v_tok, v_job, 'pickup', '999999');
  if r ->> 'error' <> 'invalid_otp' or r ? 'code_belongs_to' then raise exception 'FAIL plain wrong code: %', r; end if;
  r := public.driver_confirm_handoff(v_tok, v_job, 'pickup', '111111');
  if not (r ->> 'ok')::boolean then raise exception 'FAIL right pickup code: %', r; end if;
  update public.jobs set driver_arrived_delivery_at = now() where id = v_job;
  r := public.driver_confirm_handoff(v_tok, v_job, 'dropoff', '111111');
  if r ->> 'error' <> 'invalid_otp' or r ->> 'code_belongs_to' <> 'sender' then raise exception 'FAIL sender code at drop-off: %', r; end if;
  -- the old job-token path (web) says the same
  r := public.confirm_job_step((select token_driver_delivery::text from public.jobs where id = v_job), 'driver_delivery', '111111', null, null);
  if r ->> 'code_belongs_to' <> 'sender' then raise exception 'FAIL confirm_job_step: %', r; end if;
  v_log := v_log || 'other party code flagged, attempts still count ok'::text;

  if public.link_party((select token_client_pickup::text from public.jobs where id = v_job)) <> 'sender'
     or public.link_party((select token_client_delivery::text from public.jobs where id = v_job)) <> 'recipient'
     or public.link_party((select token_driver_pickup::text from public.jobs where id = v_job)) <> 'driver'
     or public.link_party('not-a-uuid') is not null or public.link_party(gen_random_uuid()::text) is not null then
    raise exception 'FAIL link_party';
  end if;
  v_log := v_log || 'link_party ok'::text;

  -- ── Multi-stop: another stop's code ──
  insert into public.jobs (job_ref, organization_id, job_kind, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status,
    confirmation_mode, token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery)
  values ('SMOKE-W2', v_org, 'multi_stop', 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Dubai', 'A street', 'Abu Dhabi', 'B street', 'document', 'today', 'pending', 'driver_only',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '555555', '666666', '333333', '333333')
  returning id into v_rt;
  r := public.save_job_stops(v_rt, jsonb_build_array(
    jsonb_build_object('kind', 'pickup', 'contact_name', 'Alice', 'contact_phone', '+971501111111', 'emirate', 'Dubai', 'address', 'A street', 'lat', 25.2, 'lng', 55.27),
    jsonb_build_object('kind', 'drop',   'contact_name', 'Bob',   'contact_phone', '+971502222222', 'emirate', 'Abu Dhabi', 'address', 'B street', 'lat', 24.45, 'lng', 54.38)));
  if not (r->>'ok')::boolean then raise exception 'FAIL save_job_stops: %', r; end if;
  v_stops := r->'stops';
  update public.jobs set driver_id = v_drv where id = v_rt;
  update public.job_stops set arrived_at = now() - interval '3 min' where id = (v_stops->0->>'id')::uuid;
  r := public.driver_stop_handoff(v_tok, v_rt, (v_stops->0->>'id')::uuid, v_stops->1->>'otp', null, null);
  if r ->> 'error' <> 'invalid_otp' or r ->> 'code_belongs_to' <> 'stop' or (r ->> 'code_belongs_seq')::int <> 2 then
    raise exception 'FAIL other stop code: %', r;
  end if;
  if (select otp_attempts from public.job_stops where id = (v_stops->0->>'id')::uuid) <> 1 then raise exception 'FAIL stop attempt not counted'; end if;
  r := public.driver_stop_handoff(v_tok, v_rt, (v_stops->0->>'id')::uuid, v_stops->0->>'otp', null, null);
  if not (r ->> 'ok')::boolean then raise exception 'FAIL right stop code: %', r; end if;
  -- (the first/last contacts share the job's sender/recipient links)
  if public.link_party(v_stops->1->>'token') not in ('stop', 'recipient') then raise exception 'FAIL link_party stop'; end if;
  v_log := v_log || 'other stop code ok'::text;

  raise exception 'SMOKE OK (rolled back): %', array_to_string(v_log, ' | ');
end
$smoke$;
