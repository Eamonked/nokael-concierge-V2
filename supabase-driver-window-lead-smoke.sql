-- Smoke test for supabase-driver-window-lead.sql. Never commits (final RAISE).
-- Dry run: paste the migration body without begin;/commit; before this file.
do $smoke$
declare
  v_org  uuid := '89412cf2-dd3a-447c-906a-e59aaa64926d';
  v_drv  uuid;
  v_tok  text := 'smoke-' || md5(random()::text) || md5(random()::text);
  v_job  uuid;
  v_ws   timestamptz := date_trunc('minute', now()) + interval '2 hours';
  j      public.jobs%rowtype;
  r      jsonb;
  t      record;
  v_log  text[] := '{}';
begin
  alter table public.jobs disable trigger trg_set_job_ref;
  update public.organizations set settings = settings - 'driver_lead_min' where id = v_org;
  if public._driver_lead(v_org) <> interval '15 min' then raise exception 'FAIL default lead %', public._driver_lead(v_org); end if;

  insert into public.drivers (full_name, phone, whatsapp, email, base_location, vehicle_type, active, onboarding_status, organization_id)
  values ('Smoke Driver', '+971500000001', '+971500000001', 'smoke1@example.invalid', 'Dubai', 'car', true, 'approved', v_org) returning id into v_drv;
  insert into public.driver_sessions (driver_id, token_hash, device_label, expires_at, app_platform, app_version)
  values (v_drv, public._driver_hash_token(v_tok), 'smoke', now() + interval '1 day', 'android', '1.1.0');

  insert into public.jobs (job_ref, organization_id, sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_emirate, pickup_location, delivery_emirate, delivery_location, pickup_lat, pickup_lng, delivery_lat, delivery_lng,
    item_type, urgency, status, confirmation_mode, token_client_pickup, token_client_delivery, token_driver_pickup, token_driver_delivery,
    otp_sender, otp_recipient, otp_driver_pickup, otp_driver_delivery,
    pickup_window_start, pickup_window_end, scheduled_delivery_start, scheduled_delivery_end)
  values ('SMOKE-L1', v_org, 'Alice', '+971501111111', 'Bob', '+971502222222',
    'Dubai', 'A street', 'Dubai', 'B street', 25.2, 55.27, 25.1, 55.2, 'document', 'today', 'pending', 'driver_only',
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '111111', '222222', '333333', '444444',
    v_ws, v_ws + interval '2 hours', v_ws + interval '3 hours', v_ws + interval '5 hours')
  returning * into j;
  v_job := j.id;
  update public.jobs set driver_id = v_drv where id = v_job;

  -- Android payload
  r := (select x from jsonb_array_elements(public.driver_jobs(v_tok) -> 'jobs') x where x ->> 'id' = v_job::text);
  if (r -> 'pickup' ->> 'window_start')::timestamptz <> v_ws - interval '15 min'
     or (r -> 'pickup' ->> 'window_end')::timestamptz <> v_ws + interval '105 min'
     or (r -> 'dropoff' ->> 'window_start')::timestamptz <> v_ws + interval '165 min' then
    raise exception 'FAIL driver_jobs windows: % %', r -> 'pickup', r -> 'dropoff';
  end if;
  if r ->> 'special_instructions' not like '%' || to_char((v_ws - interval '15 min') at time zone 'Asia/Dubai', 'HH24:MI') || '%' then
    raise exception 'FAIL instructions: %', r ->> 'special_instructions';
  end if;
  v_log := v_log || 'driver app: windows and instructions 15 min earlier ok'::text;

  -- Assignment push
  if not exists (select 1 from public.push_outbox where job_id = v_job and audience = 'driver' and title = 'New job assigned'
                  and body like '%Be at pickup from ' || public._push_clock(v_org, v_ws - interval '15 min') || '%') then
    raise exception 'FAIL assignment push: %', (select body from public.push_outbox where job_id = v_job and audience = 'driver' limit 1);
  end if;
  v_log := v_log || 'assignment push says driver time ok'::text;

  -- Links: client sees the real window, driver link the earlier one
  select * into t from public.get_job_by_token(j.token_client_pickup::text);
  if t.pickup_window_start <> v_ws or t.delivery_window_start <> v_ws + interval '3 hours' then raise exception 'FAIL client link shifted'; end if;
  select * into t from public.get_job_by_token(j.token_driver_pickup::text);
  if t.pickup_window_start <> v_ws - interval '15 min' or t.delivery_window_end <> v_ws + interval '285 min' then raise exception 'FAIL driver link not shifted'; end if;
  v_log := v_log || 'client link real window, driver link earlier ok'::text;

  -- Reminders aim at the driver time
  select * into t from public.reminder_candidates() c where c.job_id = v_job and c.leg = 'pickup';
  if t.target <> v_ws - interval '15 min' then raise exception 'FAIL reminder target %', t.target; end if;
  perform public.reminder_send(v_job, 'pickup', 'late', t.target, 1800);
  if not exists (select 1 from public.push_outbox where job_id = v_job and audience = 'staff' and title like 'Driver likely late%'
                  and body like '%due ' || public._push_clock(v_org, v_ws - interval '15 min') || ' (client window ' || public._push_clock(v_org, v_ws) || ')%') then
    raise exception 'FAIL late alert text';
  end if;
  v_log := v_log || 'reminders target driver time, late alert shows both ok'::text;

  -- Waiting clock still uses the client window
  update public.jobs set driver_arrived_pickup_at = v_ws - interval '15 min' where id = v_job;
  if (select clock_start from public.job_waits where job_id = v_job and leg = 'pickup') <> v_ws then raise exception 'FAIL waiting clock'; end if;
  v_log := v_log || 'waiting clock starts at client window ok'::text;

  -- Setting: 0 turns it off; validation
  update public.organizations set settings = settings || '{"driver_lead_min": 0}' where id = v_org;
  if public._driver_lead(v_org) <> interval '0' then raise exception 'FAIL lead 0'; end if;
  update public.organizations set settings = settings - 'driver_lead_min' where id = v_org;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', 'fb81c0b6-1797-4ce4-8107-efa8bed76b90', 'role', 'authenticated')::text, true);
    perform public.update_org_profile(v_org, null, '{"driver_lead_min": 7.5}'::jsonb, null);
    raise exception 'FAIL 7.5 accepted';
  exception when others then
    if sqlerrm not like 'Driver lead time:%' and sqlerrm not like 'Only owners%' then raise; end if;
  end;
  v_log := v_log || 'lead 0 = off, validation ok'::text;

  raise exception 'SMOKE OK (rolled back): %', array_to_string(v_log, ' | ');
end
$smoke$;
