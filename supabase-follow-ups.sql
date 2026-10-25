-- =============================================================================
-- Nokael — follow-ups queue state (26 Oct 2026)
-- Project: hhgzxpuzsbqirmbsiltn
--
-- The dashboard's Follow-ups tab works out who to contact (pending quotes,
-- sample-certificate leads, first-time clients, busy repeat clients) from the
-- jobs / quote_requests / business_inquiries it already loads — see
-- src/pages/dashboard/followUps.ts. Only what staff did about each one is
-- stored here: marked done, or snoozed until a time.
--
-- item_key is the follow-up's stable id, e.g. 'quote:<uuid>', 'lead:<uuid>',
-- 'first:<phone key>', 'repeat:<phone key>'.
-- Members read; writers (not viewers) change. Safe to run more than once.
-- =============================================================================

create table if not exists public.follow_up_state (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  item_key        text not null check (length(item_key) between 3 and 120),
  status          text not null check (status in ('done', 'snoozed')),
  snoozed_until   timestamptz,
  updated_by      uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, item_key),
  check (status <> 'snoozed' or snoozed_until is not null)
);

alter table public.follow_up_state enable row level security;

drop policy if exists follow_up_state_select_members on public.follow_up_state;
create policy follow_up_state_select_members on public.follow_up_state
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists follow_up_state_insert_writers on public.follow_up_state;
create policy follow_up_state_insert_writers on public.follow_up_state
  for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists follow_up_state_update_writers on public.follow_up_state;
create policy follow_up_state_update_writers on public.follow_up_state
  for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists follow_up_state_delete_writers on public.follow_up_state;
create policy follow_up_state_delete_writers on public.follow_up_state
  for delete to authenticated
  using (public.can_write_org(organization_id));

grant select, insert, update, delete on public.follow_up_state to authenticated;
-- Staff-only: the public site never touches it.
revoke all on public.follow_up_state from anon;
