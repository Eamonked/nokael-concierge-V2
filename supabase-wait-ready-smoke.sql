-- Smoke test for supabase-wait-ready.sql. Never commits (final RAISE).
-- Dry run: paste the migration body without begin;/commit; before this file.
do $smoke$
declare
  v_org  uuid := '89412cf2-dd3a-447c-906a-e59aaa64926d';
  v_drv  uuid;
  v_ws   timestamptz := date_trunc('minute', now()) + interval '40 min';  -- window starts in 40 min
  j      public.jobs%rowtype;
  w      public.job_waits%rowtype;
  r      jsonb;
  v_log  text[] := '{}';
begin
  alter table public.jobs disable trigger trg_set_job_ref;
  update public.organizations set settings = coalesce(settings, '{}'::jsonb)
    || jsonb_build_object('waiting', jsonb_build_object('enabled', true, 'free_min', 15, 'block_min', 15, 'block_aed', 25))
   where id = v_org;
  insert into public.drivers (full_name, phone, whatsapp, email, base_location, vehicle_type, active, onboarding_status, organization_id)
  values ('Smoke Driver', '+971500000001', '+971500000001', 'smoke1@example.invalid', 'Dubai', 'car', true, 'approved', v_org) returning id into v_drv;

  -- ── A: early, never ready → clock at the window ──
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status, confirmation_mode,
    token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery, pickup_window_start, pickup_window_end, driver_id)
  values ('SMOKE-R1', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222', 'Dubai', 'A street', 'Dubai', 'B street',
    'document', 'today', 'pending', 'driver_only', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    '111111', '222222', '333333', '444444', v_ws, v_ws + interval '2 hours', v_drv)
  returning * into j;
  update public.jobs set driver_arrived_pickup_at = now() - interval '5 min' where id = j.id;
  select * into w from public.job_waits where job_id = j.id and leg = 'pickup';
  if w.clock_start <> v_ws then raise exception 'FAIL A clock %', w.clock_start; end if;
  if not exists (select 1 from public.push_outbox where job_id = j.id and body like '%or from when you tap "My package is ready".%') then
    raise exception 'FAIL A arrival push text';
  end if;
  v_log := v_log || 'early, not ready: clock at window ok'::text;

  -- ── B: sender taps ready while the driver waits early → clock from then ──
  if (public.mark_package_ready(j.token_client_delivery::text) ->> 'ok')::boolean then raise exception 'FAIL B recipient marked ready'; end if;
  if (public.mark_package_ready('nope') ->> 'ok')::boolean then raise exception 'FAIL B bad token'; end if;
  r := public.mark_package_ready(j.token_client_pickup::text);
  if not (r ->> 'ok')::boolean then raise exception 'FAIL B mark: %', r; end if;
  select * into w from public.job_waits where job_id = j.id and leg = 'pickup';
  if w.clock_start <> (select sender_ready_at from public.jobs where id = j.id) then raise exception 'FAIL B clock % ', w.clock_start; end if;
  if (select count(*) from public.push_outbox where job_id = j.id and title = 'Package ready') <> 2 then raise exception 'FAIL B pushes'; end if;
  r := public.mark_package_ready(j.token_client_pickup::text);   -- idempotent
  if not (r ->> 'ok')::boolean or (select count(*) from public.push_outbox where job_id = j.id and title = 'Package ready') <> 2 then
    raise exception 'FAIL B repeat: %', r;
  end if;
  v_log := v_log || 'ready while early: clock from ready, driver+staff pushed, sender link only ok'::text;

  -- ── C: ready before the driver arrived early → clock from arrival ──
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status, confirmation_mode,
    token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery, pickup_window_start, pickup_window_end, driver_id)
  values ('SMOKE-R2', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222', 'Dubai', 'A street', 'Dubai', 'B street',
    'document', 'today', 'pending', 'driver_only', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    '111111', '222222', '333333', '444444', v_ws, v_ws + interval '2 hours', v_drv)
  returning * into j;
  update public.jobs set sender_ready_at = now() - interval '10 min' where id = j.id;  -- ready 10 min ago
  update public.jobs set driver_arrived_pickup_at = now() - interval '2 min' where id = j.id;
  select * into w from public.job_waits where job_id = j.id and leg = 'pickup';
  if w.clock_start <> now() - interval '2 min' then raise exception 'FAIL C clock %', w.clock_start; end if;
  -- after collection, ready is refused
  update public.jobs set driver_pickup_at = now() where id = j.id;
  update public.jobs set sender_ready_at = null where id = j.id;
  if (public.mark_package_ready(j.token_client_pickup::text) ->> 'error') <> 'already_collected' then raise exception 'FAIL C after collection'; end if;
  v_log := v_log || 'ready before arrival: clock from arrival; refused after collection ok'::text;

  -- ── D: on time (window already open) → arrival, unchanged ──
  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, item_type, urgency, status, confirmation_mode,
    token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery, pickup_window_start, pickup_window_end, driver_id)
  values ('SMOKE-R3', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222', 'Dubai', 'A street', 'Dubai', 'B street',
    'document', 'today', 'pending', 'driver_only', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    '111111', '222222', '333333', '444444', now() - interval '30 min', now() + interval '90 min', v_drv)
  returning * into j;
  update public.jobs set driver_arrived_pickup_at = now() where id = j.id;
  select * into w from public.job_waits where job_id = j.id and leg = 'pickup';
  if w.clock_start <> now() then raise exception 'FAIL D clock %', w.clock_start; end if;
  perform public.mark_package_ready(j.token_client_pickup::text);
  select * into w from public.job_waits where job_id = j.id and leg = 'pickup';
  if w.clock_start <> now() then raise exception 'FAIL D clock moved %', w.clock_start; end if;
  v_log := v_log || 'on time: clock from arrival, ready changes nothing ok'::text;

  raise exception 'SMOKE OK (rolled back): %', array_to_string(v_log, ' | ');
end
$smoke$;
