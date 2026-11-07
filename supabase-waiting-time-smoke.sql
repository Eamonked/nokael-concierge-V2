-- Smoke test for supabase-waiting-time.sql. Never commits.
--
-- Dry run: paste the migration body WITHOUT its begin;/commit; lines, then this
-- file, and run both together. The final RAISE aborts the transaction, so
-- nothing is kept; the error message is the test report.
-- After the migration is applied it can also be run on its own.

do $smoke$
declare
  v_org   uuid := '89412cf2-dd3a-447c-906a-e59aaa64926d';
  v_user  uuid := 'fb81c0b6-1797-4ce4-8107-efa8bed76b90';
  v_drv   uuid;
  v_tok   text := 'smoke-' || md5(random()::text) || md5(random()::text);
  v_job   uuid;
  v_job2  uuid;
  v_job3  uuid;
  v_rt    uuid;
  j       public.jobs%rowtype;
  w       public.job_waits%rowtype;
  r       jsonb;
  v_n     integer;
  v_url   text;
  v_err   text;
  v_log   text[] := '{}';
  v_stops jsonb;
  v_ob    bigint;
  v_sub   uuid;
begin
  alter table public.jobs disable trigger trg_set_job_ref;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  -- Known policy for the test, whatever the company has set.
  update public.organizations set settings = coalesce(settings, '{}'::jsonb)
    || jsonb_build_object('waiting', jsonb_build_object('enabled', true, 'free_min', 15, 'block_min', 15, 'block_aed', 25))
   where id = v_org;

  -- Charge maths
  if public._wait_charge(0, 15, 15, 25) <> 0 or public._wait_charge(15, 15, 15, 25) <> 0
     or public._wait_charge(16, 15, 15, 25) <> 25 or public._wait_charge(30, 15, 15, 25) <> 25
     or public._wait_charge(31, 15, 15, 25) <> 50 or public._wait_charge(46, 15, 15, 25) <> 75 then
    raise exception 'FAIL charge maths';
  end if;
  if public._wait_minutes(now(), now() + interval '15 min 50 s') <> 15
     or public._wait_minutes(now() + interval '1 hour', now()) <> 0 then
    raise exception 'FAIL minutes';
  end if;
  v_log := v_log || 'maths 0/15/16/30/31/46 → 0/0/25/25/50/75 ok'::text;

  insert into public.drivers (full_name, phone, whatsapp, email, base_location, vehicle_type, active, onboarding_status, organization_id)
  values ('Smoke Driver', '+971500000001', '+971500000001', 'smoke1@example.invalid', 'Dubai', 'car', true, 'approved', v_org) returning id into v_drv;
  insert into public.driver_sessions (driver_id, token_hash, device_label, expires_at, app_platform, app_version)
  values (v_drv, public._driver_hash_token(v_tok), 'smoke', now() + interval '1 day', 'android', '1.1.0');

  -- ── One-way: pickup waited 31 min, drop-off arrived before its window ──
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, pickup_lat, pickup_lng, delivery_lat, delivery_lng,
    item_type, urgency, status, confirmation_mode, token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery, driver_id,
    pickup_window_start, pickup_window_end, scheduled_delivery_start, scheduled_delivery_end)
  values ('SMOKE-W1', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Dubai', 'A street', 'Dubai', 'B street', 25.2, 55.27, 25.1, 55.2, 'document', 'today', 'pending', 'driver_only',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '111111', '222222', '333333', '444444', v_drv,
    now() - interval '2 hours', now() + interval '1 hour', now() + interval '20 min', now() + interval '2 hours')
  returning id into v_job;

  update public.jobs set driver_arrived_pickup_at = now() - interval '31 min',
    driver_arrived_pickup_lat = 25.2005, driver_arrived_pickup_lng = 55.27 where id = v_job;
  select * into w from public.job_waits where job_id = v_job and leg = 'pickup';
  if not found or w.clock_start <> now() - interval '31 min' or w.ended_at is not null or w.distance_m > 100 then
    raise exception 'FAIL pickup wait open: %', to_jsonb(w);
  end if;
  select count(*) into v_n from public.push_outbox o join public.jobs x on x.id = o.job_id
   where o.job_id = v_job and o.audience = 'tracking' and o.party_token = x.token_client_pickup::text
     and o.body like '%15 min free waiting, then AED 25 per 15 min%';
  if v_n <> 1 then raise exception 'FAIL arrival push to sender (% rows)', v_n; end if;
  v_log := v_log || 'pickup wait opened + sender push ok'::text;

  update public.jobs set driver_pickup_at = now(), status = 'driver_pickup' where id = v_job;
  select * into w from public.job_waits where job_id = v_job and leg = 'pickup';
  select * into j from public.jobs where id = v_job;
  if w.ended_at is null or w.wait_min <> 31 or w.charge_aed <> 50 or w.end_reason <> 'handover' or j.waiting_charge_aed <> 50 then
    raise exception 'FAIL pickup close: % job total %', to_jsonb(w), j.waiting_charge_aed;
  end if;
  v_log := v_log || 'pickup 31 min → AED 50, job total 50 ok'::text;

  update public.jobs set driver_arrived_delivery_at = now() where id = v_job;
  select * into w from public.job_waits where job_id = v_job and leg = 'dropoff';
  if w.clock_start <> now() + interval '20 min' then raise exception 'FAIL early arrival clock: %', w.clock_start; end if;
  update public.jobs set driver_delivery_at = now(), status = 'completed' where id = v_job;
  select * into w from public.job_waits where job_id = v_job and leg = 'dropoff';
  select * into j from public.jobs where id = v_job;
  if w.wait_min <> 0 or w.charge_aed <> 0 or w.end_reason <> 'handover' or j.waiting_charge_aed <> 50 then
    raise exception 'FAIL drop-off close: % total %', to_jsonb(w), j.waiting_charge_aed;
  end if;
  v_log := v_log || 'early drop-off arrival: clock at window, 0 min ok'::text;

  -- Delivered push: rating link for the recipient's subscription
  insert into public.push_subscriptions (channel, endpoint, p256dh, auth, audience, job_id, link_token)
  values ('web', 'https://example.invalid/smoke', 'x', 'y', 'tracking', v_job, j.token_client_delivery::text) returning id into v_sub;
  select o.id into v_ob from public.push_outbox o where o.job_id = v_job and o.audience = 'tracking' and o.url = '?review=1';
  if v_ob is null then raise exception 'FAIL delivered push has no ?review=1'; end if;
  select t.url into v_url from public.push_targets(v_ob) t where t.subscription_id = v_sub;
  if v_url <> '/' || j.token_client_delivery || '/track?for=recipient&review=1' then raise exception 'FAIL push url: %', v_url; end if;
  -- party targeting: the sender's arrival push does not reach the recipient
  select o.id into v_ob from public.push_outbox o where o.job_id = v_job and o.party_token = j.token_client_pickup::text limit 1;
  if exists (select 1 from public.push_targets(v_ob) t where t.subscription_id = v_sub) then raise exception 'FAIL party targeting'; end if;
  v_log := v_log || ('push url ' || replace(v_url, j.token_client_delivery::text, '<tok>') || ', party targeting ok');

  -- Adjust
  begin
    perform public.ops_wait_adjust(v_job, (select id from public.job_waits where job_id = v_job and leg = 'pickup'), 0, ' ');
    raise exception 'FAIL adjust without reason accepted';
  exception when others then
    if sqlerrm <> 'reason_required' then raise; end if;
  end;
  r := public.ops_wait_adjust(v_job, (select id from public.job_waits where job_id = v_job and leg = 'pickup'), 0, 'Regular client, goodwill');
  select * into j from public.jobs where id = v_job;
  if j.waiting_charge_aed <> 0 or j.operator_notes not like '%Pickup waiting waived (was AED 50) — Regular client, goodwill%' then
    raise exception 'FAIL adjust: total % notes %', j.waiting_charge_aed, j.operator_notes;
  end if;
  select to_jsonb(t) into r from public.get_job_by_token(j.token_client_pickup::text) t;
  if jsonb_array_length(r -> 'waits') <> 2 or (r -> 'waits' -> 0 ->> 'waived')::boolean is not true
     or (r -> 'waits' -> 0 ->> 'charge_aed')::numeric <> 0 or (r -> 'waiting_policy' ->> 'free_min')::int <> 15
     or (r -> 'waits' -> 0) ? 'distance_m' then
    raise exception 'FAIL get_job_by_token waits: %', r -> 'waits';
  end if;
  v_log := v_log || 'adjust needs reason, waive logged, link shows waived ok'::text;

  -- ── Warning once, then cancel closes ──
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status, confirmation_mode,
    token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery, driver_id)
  values ('SMOKE-W2', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222', 'Dubai', 'A street', 'Dubai', 'B street',
    'document', 'today', 'pending', 'driver_only', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    '111111', '222222', '333333', '444444', v_drv)
  returning id into v_job2;
  update public.jobs set driver_arrived_pickup_at = now() - interval '20 min' where id = v_job2;
  perform public.waits_tick();
  perform public.waits_tick();
  select count(*) into v_n from public.push_outbox where job_id = v_job2 and title in ('Free waiting time is over', 'Driver waiting');
  if v_n <> 2 then raise exception 'FAIL warn once: % pushes', v_n; end if;
  update public.jobs set status = 'cancelled', cancellation_reason = 'smoke' where id = v_job2;
  select * into w from public.job_waits where job_id = v_job2;
  if w.end_reason <> 'cancelled' or w.wait_min <> 20 or w.charge_aed <> 25 then raise exception 'FAIL cancel close: %', to_jsonb(w); end if;
  v_log := v_log || 'free-time warning once, cancel closes at 20 min → AED 25 ok'::text;

  -- ── Disabled: no wait ──
  update public.organizations set settings = settings || jsonb_build_object('waiting',
    jsonb_build_object('enabled', false, 'free_min', 15, 'block_min', 15, 'block_aed', 25)) where id = v_org;
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status, confirmation_mode,
    token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery, driver_id)
  values ('SMOKE-W3', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222', 'Dubai', 'A street', 'Dubai', 'B street',
    'document', 'today', 'pending', 'driver_only', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    '111111', '222222', '333333', '444444', v_drv)
  returning id into v_job3;
  update public.jobs set driver_arrived_pickup_at = now() where id = v_job3;
  if exists (select 1 from public.job_waits where job_id = v_job3) then raise exception 'FAIL disabled still opened a wait'; end if;
  if not exists (select 1 from public.push_outbox where job_id = v_job3 and audience = 'tracking' and title = 'Driver at pickup') then
    raise exception 'FAIL disabled: plain arrival push missing';
  end if;
  update public.organizations set settings = settings || jsonb_build_object('waiting',
    jsonb_build_object('enabled', true, 'free_min', 15, 'block_min', 15, 'block_aed', 25)) where id = v_org;
  v_log := v_log || 'disabled: no wait, plain arrival push ok'::text;

  -- ── Multi-stop: per stop ──
  insert into public.jobs (job_ref, organization_id, job_kind, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status,
    confirmation_mode, token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery)
  values ('SMOKE-WRT', v_org, 'multi_stop', 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Dubai', 'A street', 'Abu Dhabi', 'B street', 'document', 'today', 'pending', 'four_step',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '111111', '222222', '333333', '333333')
  returning id into v_rt;
  r := public.save_job_stops(v_rt, jsonb_build_array(
    jsonb_build_object('kind', 'pickup', 'contact_name', 'Alice', 'contact_phone', '+971501111111', 'emirate', 'Dubai', 'address', 'A street', 'lat', 25.2, 'lng', 55.27),
    jsonb_build_object('kind', 'drop',   'contact_name', 'Bob',   'contact_phone', '+971502222222', 'emirate', 'Abu Dhabi', 'address', 'B street', 'lat', 24.45, 'lng', 54.38)));
  if not (r->>'ok')::boolean then raise exception 'FAIL save_job_stops: %', r; end if;
  v_stops := r->'stops';
  update public.jobs set driver_id = v_drv where id = v_rt;
  update public.job_stops set arrived_at = now() - interval '17 min' where id = (v_stops->1->>'id')::uuid;
  select * into w from public.job_waits where stop_id = (v_stops->1->>'id')::uuid;
  if not found or w.leg <> 'stop' or w.seq <> 2 then raise exception 'FAIL stop wait open'; end if;
  if not exists (select 1 from public.push_outbox where job_id = v_rt and party_token = v_stops->1->>'token' and title = 'Driver at stop 2') then
    raise exception 'FAIL stop arrival push';
  end if;
  update public.job_stops set handed_at = now() where id = (v_stops->1->>'id')::uuid;
  select * into w from public.job_waits where stop_id = (v_stops->1->>'id')::uuid;
  select * into j from public.jobs where id = v_rt;
  if w.wait_min <> 17 or w.charge_aed <> 25 or j.waiting_charge_aed <> 25 then raise exception 'FAIL stop close: % %', to_jsonb(w), j.waiting_charge_aed; end if;
  if exists (select 1 from public.job_waits where job_id = v_rt and stop_id is null) then raise exception 'FAIL mirror opened a one-way wait'; end if;
  v_log := v_log || 'multi-stop: stop 2 waited 17 min → AED 25, no mirror wait ok'::text;

  -- Settings validation
  begin
    perform public.update_org_profile(v_org, null, jsonb_build_object('waiting', jsonb_build_object('enabled', true, 'free_min', 15, 'block_min', 0, 'block_aed', 25)), null);
    raise exception 'FAIL block 0 accepted';
  exception when others then
    if sqlerrm not like 'Waiting time:%' and sqlerrm not like 'Only owners%' then raise; end if;
  end;
  v_log := v_log || 'settings validation ok'::text;

  raise exception 'SMOKE OK (rolled back): %', array_to_string(v_log, ' | ');
end
$smoke$;
