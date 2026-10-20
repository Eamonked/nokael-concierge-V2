-- Fix: editing an in-progress job's address / times / instructions failed.
--
-- _push_on_job built its "what changed" list with  v_changes || 'drop-off address'.
-- With a bare string literal, Postgres picks the array || array operator and
-- tries to parse 'drop-off address' as an array literal, raising
-- "malformed array literal" (22P02). The trigger runs inside the UPDATE, so the
-- whole save was rejected (HTTP 400) whenever a job with a driver had its
-- pickup/drop-off address, pickup time, delivery window or instructions
-- changed. Seen on NOK-0098, 2026-10-20.
--
-- Only those five lines change (array_append); everything else is the live
-- definition as of 2026-10-20.

CREATE OR REPLACE FUNCTION public._push_on_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ref text := coalesce(new.job_ref, left(new.id::text, 8));
  v_pickup text := public._push_place(new.pickup_location);
  v_dropoff text := public._push_place(new.delivery_location);
  v_route text := v_pickup || ' → ' || v_dropoff;
  v_driver text := (select coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), 'Your driver') from public.drivers where id = new.driver_id);
  v_tag text := 'job:' || new.id;
  v_dist double precision;
  v_changes text[] := '{}';
  v_is_new boolean := tg_op = 'INSERT';
begin
  -- Assigned (new job with a driver, or a different driver).
  if new.driver_id is not null and (v_is_new or new.driver_id is distinct from old.driver_id)
     and new.status not in ('completed', 'cancelled', 'returned') then
    perform public.push_enqueue('driver', new.organization_id, new.driver_id, null, new.id,
      'New job assigned', v_ref || ' · ' || v_route, '/driver-app/', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Driver assigned', v_ref || ': ' || coalesce(v_driver, 'A driver') || ' is on the way to ' || v_pickup || '.', '/portal/', v_tag);
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Driver assigned', coalesce(v_driver, 'Your driver') || ' is on the way to ' || v_pickup || '.', null, v_tag);
  end if;

  if v_is_new then
    return null;
  end if;

  -- Taken off the previous driver.
  if old.driver_id is not null and new.driver_id is distinct from old.driver_id
     and old.status not in ('completed', 'cancelled', 'returned') then
    perform public.push_enqueue('driver', new.organization_id, old.driver_id, null, new.id,
      'Job reassigned', v_ref || ' is no longer assigned to you.', '/driver-app/', v_tag);
  end if;

  -- Cancelled.
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and new.driver_id is not null then
    perform public.push_enqueue('driver', new.organization_id, new.driver_id, null, new.id,
      'Job cancelled', v_ref || ' · ' || v_route || coalesce(' — ' || nullif(btrim(new.cancellation_reason), ''), ''), '/driver-app/', v_tag);
  end if;

  -- Details changed while the same driver has it.
  if new.driver_id is not null and new.driver_id is not distinct from old.driver_id
     and new.status not in ('completed', 'cancelled', 'returned') then
    if new.pickup_location is distinct from old.pickup_location then v_changes := array_append(v_changes, 'pickup address'); end if;
    if new.delivery_location is distinct from old.delivery_location then v_changes := array_append(v_changes, 'drop-off address'); end if;
    if new.scheduled_pickup_at is distinct from old.scheduled_pickup_at then v_changes := array_append(v_changes, 'pickup time'); end if;
    if new.scheduled_delivery_start is distinct from old.scheduled_delivery_start
       or new.scheduled_delivery_end is distinct from old.scheduled_delivery_end then v_changes := array_append(v_changes, 'delivery window'); end if;
    if new.special_instructions is distinct from old.special_instructions then v_changes := array_append(v_changes, 'instructions'); end if;
    if cardinality(v_changes) > 0 then
      perform public.push_enqueue('driver', new.organization_id, new.driver_id, null, new.id,
        'Job updated', v_ref || ': ' || array_to_string(v_changes, ', ') || ' changed.', '/driver-app/', v_tag);
    end if;
  end if;

  -- Arrived at pickup.
  if new.driver_arrived_pickup_at is not null and old.driver_arrived_pickup_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Driver arrived at pickup', v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' at ' || v_pickup, '/dashboard', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Driver at pickup', v_ref || ': ' || coalesce(v_driver, 'Your driver') || ' has arrived at ' || v_pickup || '.', '/portal/', v_tag);
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Driver at pickup', coalesce(v_driver, 'Your driver') || ' has arrived at ' || v_pickup || '.', null, v_tag);
    v_dist := public._push_distance_m(new.driver_arrived_pickup_lat, new.driver_arrived_pickup_lng, new.pickup_lat, new.pickup_lng);
    if v_dist > 1000 then
      perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
        'Arrival far from pickup', v_ref || ': ' || coalesce(v_driver, 'Driver') || ' confirmed arrival ' || round((v_dist / 1000)::numeric, 1) || ' km from the pickup pin.', '/dashboard', v_tag || ':far');
    end if;
  end if;

  -- Arrived at drop-off (staff only).
  if new.driver_arrived_delivery_at is not null and old.driver_arrived_delivery_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Driver arrived at drop-off', v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' at ' || v_dropoff, '/dashboard', v_tag);
    v_dist := public._push_distance_m(new.driver_arrived_delivery_lat, new.driver_arrived_delivery_lng, new.delivery_lat, new.delivery_lng);
    if v_dist > 1000 then
      perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
        'Arrival far from drop-off', v_ref || ': ' || coalesce(v_driver, 'Driver') || ' confirmed arrival ' || round((v_dist / 1000)::numeric, 1) || ' km from the drop-off pin.', '/dashboard', v_tag || ':far');
    end if;
  end if;

  -- Picked up.
  if new.driver_pickup_at is not null and old.driver_pickup_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Picked up', v_ref || ' · ' || coalesce(v_driver, 'Driver') || ' collected the package, heading to ' || v_dropoff, '/dashboard', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Picked up', v_ref || ': on its way to ' || v_dropoff || '.', '/portal/', v_tag);
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Picked up', 'Your package is on its way to ' || v_dropoff || '.', null, v_tag);
  end if;

  -- Delivered.
  if new.driver_delivery_at is not null and old.driver_delivery_at is null then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Delivered', v_ref || ' · delivered to ' || v_dropoff, '/dashboard', v_tag);
    perform public.push_enqueue('client', new.organization_id, null, new.business_id, new.id,
      'Delivered', v_ref || ' was delivered to ' || v_dropoff || '.', '/portal/', v_tag);
    perform public.push_enqueue('tracking', new.organization_id, null, null, new.id,
      'Delivered', 'Your package was delivered to ' || v_dropoff || '.', null, v_tag);
  end if;

  -- Returned (critical for dispatch).
  if new.status = 'returned' and old.status is distinct from 'returned' then
    perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
      'Package returned', v_ref || ' · ' || coalesce(v_driver, 'Driver') || coalesce(': ' || nullif(btrim(new.return_reason), ''), ''), '/dashboard', v_tag || ':returned');
  end if;

  return null;
end $function$;
