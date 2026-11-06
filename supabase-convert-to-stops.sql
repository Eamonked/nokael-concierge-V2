-- Convert a one-way job into a multi-stop or round-trip job, keeping the same
-- job, job number, links and codes.
--
-- The job's pickup becomes stop 1 (sender link + code) and its delivery becomes
-- a drop (recipient link + code). Progress already made carries over:
--   driver arrived / collected at the pickup → stop 1 arrived / handed over
--     (the GPS row of the collection is copied as stop 1's handover row)
--   driver arrived at the delivery           → that drop is arrived
-- Allowed while the job is pending or collected, and the delivery has not been
-- handed over. A job with a driver needs that driver on Nokael Driver 1.1+.
--
-- Requires supabase-multi-stop.sql. Re-runnable.

-- The app-version gate also fires when an assigned job becomes multi-stop.
create or replace function public._guard_multi_stop_driver()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.job_kind <> 'one_way' and new.driver_id is not null
     and (tg_op = 'INSERT'
          or new.driver_id is distinct from old.driver_id
          or old.job_kind = 'one_way')
     and not public._driver_multi_stop_ready(new.driver_id) then
    raise exception 'needs_driver_app_1_1'
      using hint = 'This driver needs Nokael Driver 1.1 or newer for multi-stop jobs.';
  end if;
  return new;
end;
$$;

-- p_stops is the full new stop list, as for save_job_stops. The entry with
-- id 'from_pickup' is the job's current pickup and must be first; the entry
-- with id 'from_delivery' is the job's current delivery. Their details may be
-- edited unless already handed over.
create or replace function public.convert_job_to_stops(p_job_id uuid, p_kind text, p_stops jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  j       public.jobs%rowtype;
  v_pod   public.job_pod_log%rowtype;
  v_s1    uuid;
  v_s2    uuid;
  v_stops jsonb := '[]'::jsonb;
  v_e     jsonb;
  v_res   jsonb;
  v_has_delivery boolean := false;
begin
  select * into j from public.jobs where id = p_job_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'job_not_found');
  end if;
  if j.organization_id is null or not public.can_write_org(j.organization_id) then
    raise exception 'Not authorized';
  end if;
  if j.job_kind <> 'one_way' then
    return jsonb_build_object('ok', false, 'error', 'already_multi_stop');
  end if;
  if p_kind not in ('multi_stop', 'round_trip') then
    return jsonb_build_object('ok', false, 'error', 'invalid_kind');
  end if;
  if j.status not in ('pending', 'driver_pickup')
     or j.driver_delivery_at is not null or j.client_delivery_at is not null then
    return jsonb_build_object('ok', false, 'error', 'cannot_convert_now');
  end if;
  if j.driver_id is not null and not public._driver_multi_stop_ready(j.driver_id) then
    return jsonb_build_object('ok', false, 'error', 'needs_driver_app_1_1');
  end if;
  if jsonb_typeof(p_stops) <> 'array' or jsonb_array_length(p_stops) < 2
     or p_stops -> 0 ->> 'id' is distinct from 'from_pickup' then
    return jsonb_build_object('ok', false, 'error', 'invalid_stops');
  end if;
  -- A collected job keeps its pickup unchanged (it is handed over).
  if j.status = 'driver_pickup' and j.driver_pickup_at is null then
    return jsonb_build_object('ok', false, 'error', 'cannot_convert_now');
  end if;

  select * into v_pod from public.job_pod_log
   where job_id = p_job_id and step = 'driver_pickup' and action = 'confirmed'
   order by created_at desc limit 1;

  begin
    set constraints public.job_stops_job_seq_key deferred;
    update public.jobs set job_kind = p_kind where id = p_job_id;

    insert into public.job_stops (organization_id, job_id, seq, kind, contact_name, contact_phone,
      emirate, address, lat, lng, building, company, notes, window_start, window_end, token, otp,
      arrived_at, arrived_lat, arrived_lng, near_at, handed_at, handed_lat, handed_lng, method)
    values (j.organization_id, p_job_id, 1, 'pickup', j.sender_name, j.sender_phone,
      j.pickup_emirate, j.pickup_location, j.pickup_lat, j.pickup_lng, j.pickup_building,
      j.pickup_company, j.pickup_notes, j.pickup_window_start, j.pickup_window_end,
      j.token_client_pickup, j.otp_sender,
      j.driver_arrived_pickup_at, j.driver_arrived_pickup_lat, j.driver_arrived_pickup_lng,
      j.driver_near_pickup_at,
      j.driver_pickup_at,
      case when j.driver_pickup_at is not null then v_pod.driver_lat end,
      case when j.driver_pickup_at is not null then v_pod.driver_lng end,
      case when j.driver_pickup_at is not null then coalesce(v_pod.method, 'ops_override') end)
    returning id into v_s1;

    -- The delivery is kept as a stop only if the new list still has it
    -- (seq is set by save_job_stops; 1000 keeps it clear of new stops).
    for v_e in select value from jsonb_array_elements(p_stops) loop
      if v_e ->> 'id' = 'from_delivery' then
        v_has_delivery := true;
      end if;
    end loop;
    if v_has_delivery then
      insert into public.job_stops (organization_id, job_id, seq, kind, contact_name, contact_phone,
        emirate, address, lat, lng, building, company, notes, window_start, window_end, token, otp,
        arrived_at, arrived_lat, arrived_lng, near_at)
      values (j.organization_id, p_job_id, 1000, 'drop', j.recipient_name, j.recipient_phone,
        j.delivery_emirate, j.delivery_location, j.delivery_lat, j.delivery_lng, j.delivery_building,
        j.delivery_company, j.delivery_notes, j.scheduled_delivery_start, j.scheduled_delivery_end,
        j.token_client_delivery, j.otp_recipient,
        j.driver_arrived_delivery_at, j.driver_arrived_delivery_lat, j.driver_arrived_delivery_lng,
        j.driver_near_delivery_at)
      returning id into v_s2;
    end if;

    if j.driver_pickup_at is not null and v_pod.id is not null then
      insert into public.job_pod_log (organization_id, job_id, step, action, method, actor_user_id,
                                      driver_id, driver_lat, driver_lng, accuracy_m, fix_age_s, stop_id, created_at)
      values (v_pod.organization_id, p_job_id, 'stop_handover', 'confirmed', v_pod.method, v_pod.actor_user_id,
              v_pod.driver_id, v_pod.driver_lat, v_pod.driver_lng, v_pod.accuracy_m, v_pod.fix_age_s, v_s1,
              v_pod.created_at);
    end if;

    for v_e in select value from jsonb_array_elements(p_stops) loop
      v_stops := v_stops || jsonb_build_array(case v_e ->> 'id'
        when 'from_pickup' then v_e || jsonb_build_object('id', v_s1)
        when 'from_delivery' then v_e || jsonb_build_object('id', v_s2)
        else v_e end);
    end loop;

    v_res := public.save_job_stops(p_job_id, v_stops);
    if not coalesce((v_res ->> 'ok')::boolean, false) then
      raise exception 'convert_failed:%', coalesce(v_res ->> 'error', 'unknown');
    end if;
  exception when raise_exception then
    if sqlerrm like 'convert_failed:%' then
      return jsonb_build_object('ok', false, 'error', substr(sqlerrm, 16));
    end if;
    raise;
  end;

  return v_res;
end;
$$;
revoke all on function public.convert_job_to_stops(uuid, text, jsonb) from public, anon;
grant execute on function public.convert_job_to_stops(uuid, text, jsonb) to authenticated;
