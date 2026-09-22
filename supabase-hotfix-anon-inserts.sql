-- =====================================================================
-- Hotfix — anonymous inserts can self-approve a driver
-- Project: hhgzxpuzsbqirmbsiltn (dubai-concierge)
-- STATUS: DRAFT — not applied. Independent of Migration A; ship this first.
--
-- Problem (verified against the live DB):
--   * Policy "Allow public insert for drivers" is WITH CHECK (true), role public,
--     and anon holds INSERT on public.drivers.
--   * So an anonymous caller can insert a drivers row with ANY column values:
--     onboarding_status = 'approved', active = true, and a pin_hash they computed
--     themselves. That is a self-registered, approved driver who can log in.
--   * Same shape on driver_documents: verification_status can be set to 'verified'.
--
-- Fix: BEFORE INSERT triggers that overwrite trust-bearing columns when the caller
-- is anon, or an authenticated user who is not a member of the target org.
-- SECURITY DEFINER RPCs (running as owner) and service_role are not affected, so
-- ops inserts and server-side registration keep working.
--
-- Deliberately NOT touched: organization_id, active, contact fields. The public
-- application form keeps working unchanged.
--
-- Rollback (bottom of file) drops both triggers and functions.
-- =====================================================================

create or replace function public.fn_drivers_sanitize_public_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sanitize boolean := false;
begin
  if current_user = 'anon' then
    v_sanitize := true;
  elsif current_user = 'authenticated' then
    v_sanitize := not coalesce(public.is_org_member(NEW.organization_id), false);
  end if;

  if v_sanitize then
    NEW.onboarding_status   := 'pending';
    NEW.pipeline_status     := 'Sourced';
    NEW.status              := 'offline';
    NEW.pin_hash            := null;
    NEW.pin_failed_attempts := 0;
    NEW.pin_locked_until    := null;
    NEW.session_expires_at  := null;
    NEW.tier                := 'D';
    NEW.reliability_score   := 0;
    NEW.rating              := 5.0;
    NEW.jobs_completed      := 0;
    NEW.on_time_rate        := 100.0;
    NEW.internal_notes      := null;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_drivers_sanitize_public_insert on public.drivers;
create trigger trg_drivers_sanitize_public_insert
  before insert on public.drivers
  for each row execute function public.fn_drivers_sanitize_public_insert();

create or replace function public.fn_driver_documents_sanitize_public_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sanitize boolean := false;
begin
  if current_user = 'anon' then
    v_sanitize := true;
  elsif current_user = 'authenticated' then
    v_sanitize := not coalesce(public.is_org_member(NEW.organization_id), false);
  end if;

  if v_sanitize then
    NEW.verification_status := 'pending';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_driver_documents_sanitize_public_insert on public.driver_documents;
create trigger trg_driver_documents_sanitize_public_insert
  before insert on public.driver_documents
  for each row execute function public.fn_driver_documents_sanitize_public_insert();

-- ---------------------------------------------------------------------
-- Post-apply check (run as anon in a throwaway transaction, then ROLLBACK):
--   insert into public.drivers (full_name, phone, whatsapp, email, base_location,
--     vehicle_type, onboarding_status, pin_hash)
--   values ('t','t','t','t@t','t','t','approved','x') returning onboarding_status, pin_hash;
--   -- expect: pending | NULL
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ROLLBACK
-- drop trigger if exists trg_drivers_sanitize_public_insert on public.drivers;
-- drop trigger if exists trg_driver_documents_sanitize_public_insert on public.driver_documents;
-- drop function if exists public.fn_drivers_sanitize_public_insert();
-- drop function if exists public.fn_driver_documents_sanitize_public_insert();
-- ---------------------------------------------------------------------
