-- =============================================================================
-- Job stop details, cargo specs and attachments
-- =============================================================================
-- The dashboard's job form has always shown these fields (building/gate,
-- company, time window and gate notes per stop; vehicle, quantity, weight,
-- dimensions and handling flags; payment mode; attachments) but they had no
-- columns, so everything typed into them was dropped on save.
--
-- 1. Columns on jobs for every one of those fields.
-- 2. driver_jobs: drivers see them. Installed driver apps (web + Android) only
--    show special_instructions, so the RPC now folds the stop and cargo details
--    into that text — every driver sees them without an app release. The same
--    values are also sent as structured fields for a future app version.
-- 3. A private job-attachments bucket: dispatch only (never sent to drivers).
--    Path: <organization_id>/<job_id>/<file>.
--
-- Safe to re-run. Apply BEFORE deploying the dashboard that writes these columns.

-- -----------------------------------------------------------------------------
-- 1. Columns
-- -----------------------------------------------------------------------------
alter table public.jobs
  add column if not exists pickup_building      text,
  add column if not exists pickup_company       text,
  add column if not exists pickup_notes         text,
  add column if not exists pickup_window_start  timestamptz,
  add column if not exists pickup_window_end    timestamptz,
  add column if not exists delivery_building    text,
  add column if not exists delivery_company     text,
  add column if not exists delivery_notes       text,
  add column if not exists payment_mode         text,
  add column if not exists vehicle_required     text,
  add column if not exists quantity             integer,
  add column if not exists weight_kg            numeric(10,2),
  add column if not exists length_cm            numeric(10,1),
  add column if not exists width_cm             numeric(10,1),
  add column if not exists height_cm            numeric(10,1),
  add column if not exists handling_flags       text[] not null default '{}',
  add column if not exists attachments          jsonb  not null default '[]'::jsonb;

do $$ begin
  alter table public.jobs add constraint jobs_payment_mode_chk
    check (payment_mode is null or payment_mode in ('cod', 'invoice', 'card'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.jobs add constraint jobs_cargo_numbers_chk
    check ((quantity is null or quantity >= 1)
       and (weight_kg is null or weight_kg >= 0)
       and (length_cm is null or length_cm >= 0)
       and (width_cm  is null or width_cm  >= 0)
       and (height_cm is null or height_cm >= 0));
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. What the driver reads
-- -----------------------------------------------------------------------------
-- special_instructions plus one labelled paragraph per stop, cargo and payment,
-- in the company's timezone. Labels make it readable even where the app
-- collapses line breaks.
create or replace function public._driver_instructions(j public.jobs)
returns text
language sql
stable
set search_path to 'public'
as $$
  with tz as (
    select coalesce((select o.settings->>'timezone' from public.organizations o where o.id = j.organization_id), 'Asia/Dubai') as zone
  ),
  parts as (
    select
      nullif(btrim(j.special_instructions), '') as general,
      nullif(concat_ws(' · ',
        nullif(btrim(j.pickup_building), ''),
        nullif(btrim(j.pickup_company), ''),
        case when j.pickup_window_start is not null or j.pickup_window_end is not null then
          'window ' || concat_ws('–',
            to_char(j.pickup_window_start at time zone (select zone from tz), 'DD Mon HH24:MI'),
            to_char(j.pickup_window_end   at time zone (select zone from tz), 'DD Mon HH24:MI'))
        end,
        nullif(btrim(j.pickup_notes), '')), '') as pickup,
      nullif(concat_ws(' · ',
        nullif(btrim(j.delivery_building), ''),
        nullif(btrim(j.delivery_company), ''),
        nullif(btrim(j.delivery_notes), '')), '') as dropoff,
      nullif(concat_ws(' · ',
        case when coalesce(j.quantity, 1) > 1 then j.quantity || ' pieces' end,
        case when j.weight_kg > 0 then j.weight_kg::float8 || ' kg' end,
        case when coalesce(j.length_cm, 0) > 0 or coalesce(j.width_cm, 0) > 0 or coalesce(j.height_cm, 0) > 0 then
          concat_ws('×', coalesce(j.length_cm, 0)::float8, coalesce(j.width_cm, 0)::float8, coalesce(j.height_cm, 0)::float8) || ' cm'
        end,
        case j.vehicle_required
          when 'motorbike'    then 'motorbike'
          when 'cargo_van'    then 'cargo van needed'
          when 'flatbed_3t'   then '3-ton flatbed needed'
          when 'refrigerated' then 'refrigerated vehicle needed'
          else nullif(j.vehicle_required, '')
        end,
        (select string_agg(case f
                  when 'fragile'      then 'FRAGILE'
                  when 'refrigerated' then 'KEEP COLD'
                  when 'two_person'   then 'TWO-PERSON LIFT'
                  when 'hazmat'       then 'HAZARDOUS'
                  else upper(f) end, ', ')
           from unnest(j.handling_flags) f)), '') as cargo,
      case j.payment_mode when 'cod' then 'Cash on delivery — collect payment from the recipient' end as payment
  )
  select nullif(concat_ws(E'\n\n',
           general,
           'PICKUP — '   || pickup,
           'DROP-OFF — ' || dropoff,
           'CARGO — '    || cargo,
           'PAYMENT — '  || payment), '')
  from parts;
$$;

revoke execute on function public._driver_instructions(public.jobs) from public, anon, authenticated;

-- Same as the live driver_jobs, except special_instructions (now the composed
-- text) and the added pickup/dropoff/cargo/payment_mode fields.
create or replace function public.driver_jobs(p_token text, p_recent_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_driver uuid := public._driver_from_session(p_token);
  v_hours  integer := least(greatest(coalesce(p_recent_hours, 24), 1), 168);
  v_jobs   jsonb;
begin
  with base as (
    select j.*,
      case
        when j.status = 'returned'  then 'returned'
        when j.status = 'cancelled' then 'cancelled'
        when j.status = 'completed' or j.driver_delivery_at is not null then 'completed'
        else 'open'
      end as bucket,
      case
        when j.status = 'returned'  then coalesce(j.returned_at, j.updated_at)
        when j.status = 'cancelled' then coalesce(j.cancelled_at, j.updated_at)
        when j.status = 'completed' or j.driver_delivery_at is not null
          then coalesce(j.client_delivery_at, j.driver_delivery_at, j.updated_at)
      end as closed_at,
      public._driver_instructions(j) as driver_instructions
    from public.jobs j
    where j.driver_id = v_driver
  ),
  scoped as (
    select b.*,
      case when b.bucket = 'open' then
        row_number() over (
          partition by b.bucket
          order by (b.driver_arrived_pickup_at is null and b.driver_pickup_at is null),
                   coalesce(b.scheduled_pickup_at, b.created_at),
                   b.created_at
        )
      end as queue_pos
    from base b
    where b.bucket = 'open'
       or b.closed_at >= now() - make_interval(hours => v_hours)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'job_ref', s.job_ref,
      'list_status',
        case when s.bucket = 'open'
             then case when s.queue_pos = 1 then 'active' else 'upcoming' end
             else s.bucket end,
      'stage',
        case
          when s.driver_delivery_at        is not null then 'dropped_off'
          when s.driver_arrived_delivery_at is not null then 'at_dropoff'
          when s.driver_pickup_at          is not null then 'picked_up'
          when s.driver_arrived_pickup_at  is not null then 'at_pickup'
          else 'heading_to_pickup'
        end,
      'status', s.status,
      'confirmation_mode', s.confirmation_mode,
      'item_type', s.item_type,
      'urgency', s.urgency,
      'service_tier', s.service_tier,
      'company_name', s.company_name,
      'sender_name', s.sender_name,
      'sender_phone', case when s.bucket = 'open' then s.sender_phone end,
      'recipient_name', s.recipient_name,
      'recipient_phone', case when s.bucket = 'open' then s.recipient_phone end,
      'pickup', jsonb_build_object(
        'address', s.pickup_location, 'emirate', s.pickup_emirate,
        'lat', s.pickup_lat, 'lng', s.pickup_lng,
        'building', s.pickup_building, 'company', s.pickup_company, 'notes', s.pickup_notes,
        'window_start', s.pickup_window_start, 'window_end', s.pickup_window_end),
      'dropoff', jsonb_build_object(
        'address', s.delivery_location, 'emirate', s.delivery_emirate,
        'lat', s.delivery_lat, 'lng', s.delivery_lng,
        'building', s.delivery_building, 'company', s.delivery_company, 'notes', s.delivery_notes,
        'window_start', s.scheduled_delivery_start, 'window_end', s.scheduled_delivery_end),
      'cargo', jsonb_build_object(
        'vehicle_required', s.vehicle_required, 'quantity', s.quantity, 'weight_kg', s.weight_kg,
        'length_cm', s.length_cm, 'width_cm', s.width_cm, 'height_cm', s.height_cm,
        'handling', to_jsonb(s.handling_flags)),
      'payment_mode', s.payment_mode,
      'scheduled_pickup_at', s.scheduled_pickup_at,
      'special_instructions', s.driver_instructions,
      'driver_payout_aed', s.driver_payout_aed,
      'driver_remark', s.driver_remark,
      -- Mirrors confirm_job_step's max-attempts constant (5). Keep in sync.
      'otp_locked', coalesce(s.otp_attempts, 0) >= 5,
      'arrivals',
          coalesce(case when s.driver_arrived_pickup_at is not null then
            jsonb_build_array(jsonb_build_object(
              'kind', 'pickup', 'at', s.driver_arrived_pickup_at,
              'lat', s.driver_arrived_pickup_lat, 'lng', s.driver_arrived_pickup_lng)) end,
            '[]'::jsonb)
       || coalesce(case when s.driver_arrived_delivery_at is not null then
            jsonb_build_array(jsonb_build_object(
              'kind', 'dropoff', 'at', s.driver_arrived_delivery_at,
              'lat', s.driver_arrived_delivery_lat, 'lng', s.driver_arrived_delivery_lng)) end,
            '[]'::jsonb),
      'returned_at', s.returned_at,
      'return_reason', s.return_reason,
      'cancellation_reason', s.cancellation_reason,
      'created_at', s.created_at
    )
    order by (s.bucket <> 'open'), s.queue_pos, s.closed_at desc
  ), '[]'::jsonb)
  into v_jobs
  from scoped s;

  return jsonb_build_object('ok', true, 'server_time', now(), 'jobs', v_jobs);
end;
$function$;

-- -----------------------------------------------------------------------------
-- 3. Attachments (dispatch only)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-attachments', 'job-attachments', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Folder 1 of the path is the organisation (same shape as org-logos).
drop policy if exists job_attachments_member_read  on storage.objects;
drop policy if exists job_attachments_writer_insert on storage.objects;
drop policy if exists job_attachments_writer_delete on storage.objects;

create policy job_attachments_member_read on storage.objects
  for select to authenticated
  using (bucket_id = 'job-attachments' and public.is_org_member(public._org_logo_owner(name)));

create policy job_attachments_writer_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-attachments' and public.can_write_org(public._org_logo_owner(name)));

create policy job_attachments_writer_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'job-attachments' and public.can_write_org(public._org_logo_owner(name)));
