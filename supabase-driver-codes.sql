-- "That's the other party's code" + whose link is it (2026-11-07)
--
-- 1. A wrong handover code that is another party's code on the same job keeps
--    error 'invalid_otp' (old apps keep working, the attempt still counts) and
--    adds `code_belongs_to`: 'sender' | 'recipient' | 'stop', plus
--    `code_belongs_seq` for a stop. confirm_job_step (driver steps),
--    driver_confirm_handoff (passes it on) and driver_stop_handoff.
-- 2. link_party(token): 'sender' | 'recipient' | 'stop' | 'driver', so client
--    pages word the code by the token, not by the ?for= in the URL.
--
-- Live-only functions are patched in place; each replacement must match
-- exactly once or the migration aborts.

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

-- ─── one-way handover: whose code was it? ──────────────────────────────
select pg_temp._patch('public.confirm_job_step(text,text,text,double precision,double precision)'::regprocedure,
  $o$    RETURN jsonb_build_object('error', 'invalid_otp');$o$,
  $n$    -- The other client's code (e.g. the sender was sent the recipient's link).
    IF p_step = 'driver_pickup' AND btrim(p_otp) = v_job.otp_recipient THEN
      RETURN jsonb_build_object('error', 'invalid_otp', 'code_belongs_to', 'recipient');
    ELSIF p_step = 'driver_delivery' AND btrim(p_otp) = v_job.otp_sender THEN
      RETURN jsonb_build_object('error', 'invalid_otp', 'code_belongs_to', 'sender');
    END IF;
    RETURN jsonb_build_object('error', 'invalid_otp');$n$);

select pg_temp._patch('public.driver_confirm_handoff(text,uuid,text,text)'::regprocedure,
  $o$    return jsonb_build_object('ok', false, 'error', v_res ->> 'error');$o$,
  $n$    return jsonb_strip_nulls(jsonb_build_object('ok', false, 'error', v_res ->> 'error',
                                                'code_belongs_to', v_res ->> 'code_belongs_to'));$n$);

-- ─── multi-stop handover: another stop's code? ─────────────────────────
select pg_temp._patch('public.driver_stop_handoff(text,uuid,uuid,text,double precision,double precision)'::regprocedure,
  $o$    return jsonb_build_object('ok', false, 'error', 'invalid_otp');$o$,
  $n$    select x.seq into v_left from public.job_stops x
     where x.job_id = p_job_id and x.id <> v_next.id and x.otp = btrim(p_code) order by x.seq limit 1;
    if v_left is not null then
      return jsonb_build_object('ok', false, 'error', 'invalid_otp', 'code_belongs_to', 'stop', 'code_belongs_seq', v_left);
    end if;
    return jsonb_build_object('ok', false, 'error', 'invalid_otp');$n$);

-- ─── Whose link is this? ───────────────────────────────────────────────
-- The tracking page worded itself from ?for=recipient, so a recipient link
-- shared without it read like the sender's. The token decides now.
create or replace function public.link_party(p_token text)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare
  v uuid;
begin
  begin v := p_token::uuid; exception when others then return null; end;
  if exists (select 1 from public.jobs where token_client_pickup = v) then return 'sender'; end if;
  if exists (select 1 from public.jobs where token_client_delivery = v) then return 'recipient'; end if;
  if exists (select 1 from public.job_stops where token = v) then return 'stop'; end if;
  if exists (select 1 from public.jobs where token_driver_pickup = v or token_driver_delivery = v) then return 'driver'; end if;
  return null;
end $$;
grant execute on function public.link_party(text) to anon, authenticated;

commit;
