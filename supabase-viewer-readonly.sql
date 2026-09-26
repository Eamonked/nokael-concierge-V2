-- =============================================================================
-- Nokael — enforce team roles in the database (26 Sep 2026)
-- Project: hhgzxpuzsbqirmbsiltn ("dubai-concierge")
--
-- Before: every org member (viewers included) could INSERT/UPDATE/DELETE every
-- org table, because each table had one "FOR ALL USING is_org_member(...)"
-- policy. After:
--   viewer   → read only
--   operator → read + write operational data (jobs, drivers, quotes, businesses)
--   admin    → operator + API keys (team management stays in /api/team)
--   owner    → same as admin
--
-- Also closes three gaps found on the way:
--   * storage 'driver-docs': any signed-in account (even with no org) could
--     upload/delete files → now org writers only; reads org members only.
--   * public driver-application insert accepted any values (e.g. a PIN hash on
--     an application) → now anon only, and only a plain pending application.
--   * organizations had RLS but no policy, so members couldn't read their own
--     org's name.
-- Idempotent: safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Role helpers (SECURITY DEFINER so they can read org_members under RLS)
-- ---------------------------------------------------------------------------
create or replace function public.can_write_org(org_id uuid)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.org_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'operator')
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.org_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Storage paths don't carry an org id; Nokael is single-tenant today.
create or replace function public.can_write_any_org()
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.org_members
    where user_id = auth.uid()
      and role in ('owner', 'admin', 'operator')
  );
$$;

create or replace function public.is_any_org_member()
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select exists (select 1 from public.org_members where user_id = auth.uid());
$$;

revoke execute on function public.can_write_org(uuid)   from public, anon;
revoke execute on function public.is_org_admin(uuid)    from public, anon;
revoke execute on function public.can_write_any_org()   from public, anon;
revoke execute on function public.is_any_org_member()   from public, anon;
grant  execute on function public.can_write_org(uuid)   to authenticated;
grant  execute on function public.is_org_admin(uuid)    to authenticated;
grant  execute on function public.can_write_any_org()   to authenticated;
grant  execute on function public.is_any_org_member()   to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Org tables: members read, writers write
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['jobs', 'drivers', 'driver_documents', 'quote_requests', 'business_inquiries', 'business_contacts']
  loop
    execute format('drop policy if exists org_members_manage_%1$s on public.%1$I', t);
    execute format('drop policy if exists %1$s_select_members on public.%1$I', t);
    execute format('drop policy if exists %1$s_insert_writers on public.%1$I', t);
    execute format('drop policy if exists %1$s_update_writers on public.%1$I', t);
    execute format('drop policy if exists %1$s_delete_writers on public.%1$I', t);

    execute format('create policy %1$s_select_members on public.%1$I for select to authenticated
                      using (public.is_org_member(organization_id))', t);
    execute format('create policy %1$s_insert_writers on public.%1$I for insert to authenticated
                      with check (public.can_write_org(organization_id))', t);
    execute format('create policy %1$s_update_writers on public.%1$I for update to authenticated
                      using (public.can_write_org(organization_id))
                      with check (public.can_write_org(organization_id))', t);
    execute format('create policy %1$s_delete_writers on public.%1$I for delete to authenticated
                      using (public.can_write_org(organization_id))', t);
  end loop;
end $$;

-- job_ratings has no organization_id; it inherits the job's org.
drop policy if exists org_members_manage_job_ratings on public.job_ratings;
drop policy if exists job_ratings_select_members on public.job_ratings;
drop policy if exists job_ratings_write_writers on public.job_ratings;
create policy job_ratings_select_members on public.job_ratings for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_ratings.job_id and public.is_org_member(j.organization_id)));
create policy job_ratings_write_writers on public.job_ratings for all to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_ratings.job_id and public.can_write_org(j.organization_id)))
  with check (exists (select 1 from public.jobs j where j.id = job_ratings.job_id and public.can_write_org(j.organization_id)));

-- API keys are credentials: admins/owners only (the pool API verifies keys
-- through verify_api_key, which is SECURITY DEFINER and unaffected).
drop policy if exists "Org members manage their own api keys" on public.api_keys;
drop policy if exists api_keys_admins on public.api_keys;
create policy api_keys_admins on public.api_keys for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Members can read their own organisation (name, branding) — used by the dashboard.
drop policy if exists organizations_select_members on public.organizations;
create policy organizations_select_members on public.organizations for select to authenticated
  using (public.is_org_member(id));

-- ---------------------------------------------------------------------------
-- 3. Public forms: anonymous visitors only, and only a plain application
-- ---------------------------------------------------------------------------
drop policy if exists "Allow public insert for drivers" on public.drivers;
drop policy if exists drivers_public_application on public.drivers;
create policy drivers_public_application on public.drivers for insert to anon
  with check (
    onboarding_status = 'pending'
    and pin_hash is null
    and session_expires_at is null
    and coalesce(eid_verified, false) = false
  );

drop policy if exists "Allow public insert for driver_documents" on public.driver_documents;
drop policy if exists driver_documents_public_upload on public.driver_documents;
create policy driver_documents_public_upload on public.driver_documents for insert to anon
  with check (true);

-- ---------------------------------------------------------------------------
-- 4. Storage bucket 'driver-docs'
-- ---------------------------------------------------------------------------
drop policy if exists "Operators can read driver docs"   on storage.objects;
drop policy if exists "Operators can upload driver docs" on storage.objects;
drop policy if exists "Operators can delete driver docs" on storage.objects;
drop policy if exists driver_docs_read_members  on storage.objects;
drop policy if exists driver_docs_insert_writers on storage.objects;
drop policy if exists driver_docs_update_writers on storage.objects;
drop policy if exists driver_docs_delete_writers on storage.objects;

create policy driver_docs_read_members on storage.objects for select to authenticated
  using (bucket_id = 'driver-docs' and public.is_any_org_member());
create policy driver_docs_insert_writers on storage.objects for insert to authenticated
  with check (bucket_id = 'driver-docs' and public.can_write_any_org());
create policy driver_docs_update_writers on storage.objects for update to authenticated
  using (bucket_id = 'driver-docs' and public.can_write_any_org())
  with check (bucket_id = 'driver-docs' and public.can_write_any_org());
create policy driver_docs_delete_writers on storage.objects for delete to authenticated
  using (bucket_id = 'driver-docs' and public.can_write_any_org());

-- ---------------------------------------------------------------------------
-- 5. Ops RPCs that change data: writers only (were any member)
-- ---------------------------------------------------------------------------
create or replace function public.reset_job_otp_attempts(p_job_id uuid)
returns json
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.jobs where id = p_job_id;
  if not found then
    return json_build_object('error', 'job_not_found');
  end if;

  if v_org is null or not public.can_write_org(v_org) then
    raise exception 'Not authorized';
  end if;

  update public.jobs set otp_attempts = 0 where id = p_job_id;
  return json_build_object('success', true, 'job_id', p_job_id);
end;
$function$;

create or replace function public.set_driver_pin(driver_id uuid, pin text)
returns void
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.drivers where id = driver_id;
  if not found then
    raise exception 'Driver not found';
  end if;

  if v_org is null or not public.can_write_org(v_org) then
    raise exception 'Not authorized';
  end if;

  if pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4-6 digits';
  end if;

  update public.drivers
  set pin_hash = crypt(pin, gen_salt('bf')),
      pin_failed_attempts = 0,
      pin_locked_until = null,
      session_expires_at = null
  where id = driver_id;

  update public.driver_sessions s
     set revoked_at = now()
   where s.driver_id = set_driver_pin.driver_id
     and s.revoked_at is null;
end;
$function$;

create or replace function public.dispatch_revoke_driver_sessions(p_driver_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_org uuid;
  v_n   integer;
begin
  select d.organization_id into v_org from public.drivers d where d.id = p_driver_id;
  if not found then
    raise exception 'Driver not found';
  end if;

  if v_org is null or not public.can_write_org(v_org) then
    raise exception 'Not authorized';
  end if;

  update public.driver_sessions s
     set revoked_at = now()
   where s.driver_id = p_driver_id
     and s.revoked_at is null;
  get diagnostics v_n = row_count;

  update public.drivers set session_expires_at = null where id = p_driver_id;

  update public.driver_location_tracking t
     set is_tracking_active = false, updated_at = now()
   where t.driver_id = p_driver_id;

  return jsonb_build_object('ok', true, 'revoked', v_n);
end;
$function$;
