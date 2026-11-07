-- Early pickup: waiting counts once the sender says the package is ready (2026-11-07)
--
-- User's rule: a driver who arrives at pickup before the client's window only
-- gets waiting time if the sender tapped "My package is ready" on their link.
-- Clock start at pickup = greatest(arrival, least(window start, ready time)):
--   ready before the driver arrived        → from arrival
--   sender taps ready while driver is early → from that moment
--   never ready                             → from the window start (as before)
-- Drop-off and multi-stop stops are unchanged (no "ready" there).
--
-- 1. _wait_open: the pickup window counts as starting at sender_ready_at when
--    that is earlier; the arrival push tells an early sender to tap ready.
-- 2. trg_wait_ready: sender_ready_at set while the pickup wait is open → its
--    clock_start moves back to the ready time (never before arrival); push the
--    driver and dispatch "Package ready".
-- 3. mark_package_ready(token): sender's link only, server time, before
--    collection, idempotent. The tracking page's new button uses it.

begin;

create or replace function pg_temp._patch(p_fn regprocedure, p_old text, p_new text)
returns void language plpgsql as $$
declare
  v_def text := pg_get_functiondef(p_fn);
  v_n integer := (length(v_def) - length(replace(v_def, p_old, ''))) / greatest(length(p_old), 1);
begin
  if v_n <> 1 then
    raise exception 'patch % matched % times: %', p_fn, v_n, left(p_old, 80);
  end if;
  execute replace(v_def, p_old, p_new);
end $$;

-- ─── 1. Clock start at an early pickup ─────────────────────────────────
select pg_temp._patch('public._wait_open(public.jobs,public.job_stops,text,timestamp with time zone,double precision,double precision)'::regprocedure,
  $o$  v_body := coalesce(v_driver, 'Your driver') || ' has arrived at ' || v_place || '.';$o$,
  $n$  -- Early pickup: waiting counts from when the sender said the package is ready.
  if p_leg = 'pickup' and p_job.sender_ready_at is not null then
    v_window := least(v_window, p_job.sender_ready_at);
  end if;

  v_body := coalesce(v_driver, 'Your driver') || ' has arrived at ' || v_place || '.';$n$);

select pg_temp._patch('public._wait_open(public.jobs,public.job_stops,text,timestamp with time zone,double precision,double precision)'::regprocedure,
  $o$      v_body := v_body || ' Waiting time counts from ' || public._push_clock(p_job.organization_id, v_window) || '.';$o$,
  $n$      v_body := v_body || ' Waiting time counts from ' || public._push_clock(p_job.organization_id, v_window)
        || case when p_leg = 'pickup' then ', or from when you tap "My package is ready".' else '.' end;$n$);

-- ─── 2. Sender marks ready ─────────────────────────────────────────────
create or replace function public._wait_on_ready()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_ref text := coalesce(new.job_ref, left(new.id::text, 8));
  v_place text := public._push_place(new.pickup_location);
begin
  if new.sender_ready_at is null or old.sender_ready_at is not null or new.job_kind <> 'one_way'
     or new.driver_pickup_at is not null or new.client_pickup_at is not null then
    return null;
  end if;

  update public.job_waits
     set clock_start = greatest(arrived_at, least(clock_start, new.sender_ready_at))
   where job_id = new.id and leg = 'pickup' and stop_id is null and ended_at is null;

  if new.driver_id is not null then
    perform public.push_enqueue('driver', new.organization_id, new.driver_id, null, new.id,
      'Package ready', v_ref || ': the sender says the package is ready at ' || v_place || '.',
      '/driver-app/', 'job:' || new.id || ':ready');
  end if;
  perform public.push_enqueue('staff', new.organization_id, null, null, new.id,
    'Package ready', v_ref || ': the sender marked the package ready at ' || v_place || '.',
    '/dashboard', 'job:' || new.id || ':ready');
  return null;
end $$;

drop trigger if exists trg_wait_ready on public.jobs;
create trigger trg_wait_ready
  after update of sender_ready_at on public.jobs
  for each row execute function public._wait_on_ready();

-- ─── 3. The tracking page's "My package is ready" ──────────────────────
create or replace function public.mark_package_ready(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v uuid;
  j public.jobs%rowtype;
begin
  begin v := p_token::uuid; exception when others then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end;
  select * into j from public.jobs where token_client_pickup = v for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if j.job_kind <> 'one_way' then return jsonb_build_object('ok', false, 'error', 'not_supported'); end if;
  if j.status in ('completed', 'cancelled', 'returned') or j.driver_pickup_at is not null or j.client_pickup_at is not null then
    return jsonb_build_object('ok', false, 'error', 'already_collected');
  end if;
  if j.sender_ready_at is not null then
    return jsonb_build_object('ok', true, 'ready_at', j.sender_ready_at);
  end if;
  update public.jobs set sender_ready_at = now(), updated_at = now() where id = j.id;
  return jsonb_build_object('ok', true, 'ready_at', now());
end $$;
grant execute on function public.mark_package_ready(text) to anon, authenticated;

commit;
