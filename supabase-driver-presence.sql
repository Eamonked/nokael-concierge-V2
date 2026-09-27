-- =============================================================================
-- Nokael — driver presence for the ops dashboard (27 Sep 2026)
-- Project: hhgzxpuzsbqirmbsiltn ("dubai-concierge")
--
-- drivers.status is job-derived (available / on_job) and the Android app's
-- Online switch never touches it, so the dashboard had no way to tell who is
-- actually online. This derives presence from what the app really does:
--   * driver_location_tracking — a GPS fix every ~10 s while Online
--   * driver_sessions.last_seen_at — bumped (≤ once a minute) on every app call;
--     the app polls jobs every 25 s while it is open
--
-- presence:
--   online    sharing GPS, last fix within 2 minutes
--   app_open  app in use within 3 minutes, but no recent GPS
--             (switched Offline, or precise location turned off)
--   offline   neither
-- Members of the org only. Read-only; safe to run more than once.
-- =============================================================================

create or replace function public.get_driver_presence(p_organization_id uuid)
returns table (
  driver_id uuid,
  presence text,
  location_at timestamptz,
  app_last_seen_at timestamptz,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision
)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Not authorized for this organization';
  end if;

  return query
  select
    d.id,
    case
      when t.is_tracking_active and t.last_location_update_at > now() - interval '2 minutes' then 'online'
      when s.last_seen_at > now() - interval '3 minutes' then 'app_open'
      else 'offline'
    end,
    t.last_location_update_at,
    s.last_seen_at,
    t.last_known_lat,
    t.last_known_lng,
    t.accuracy_meters
  from public.drivers d
  left join public.driver_location_tracking t on t.driver_id = d.id
  left join lateral (
    select max(ds.last_seen_at) as last_seen_at
    from public.driver_sessions ds
    where ds.driver_id = d.id
      and ds.revoked_at is null
      and ds.expires_at > now()
  ) s on true
  where d.organization_id = p_organization_id;
end;
$$;

revoke execute on function public.get_driver_presence(uuid) from public, anon;
grant  execute on function public.get_driver_presence(uuid) to authenticated;
