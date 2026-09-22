-- Nokael DB cleanup, phase 1 (reversible: rename now, drop after a soak period)
-- Checked 2026-09-19 against live project hhgzxpuzsbqirmbsiltn (dubai-concierge):
-- every column below is unpopulated, has no function/trigger/policy/index references,
-- and appears in app code only as an unused TypeScript interface field.
-- NOT APPLIED. Before running: delete the matching fields from the Driver and Job
-- interfaces in src/lib/supabase.ts (they are type-only, but leaving them invites reuse).

begin;

-- drivers: Emirates ID scans live in driver_documents; these are dead duplicates
alter table public.drivers rename column eid_front_url to _deprecated_eid_front_url;
alter table public.drivers rename column eid_back_url  to _deprecated_eid_back_url;
alter table public.drivers rename column eid_verified  to _deprecated_eid_verified;
alter table public.drivers rename column emirates_id   to _deprecated_emirates_id;

-- drivers: vehicle_type and vehicle_plate are the fields actually used
alter table public.drivers rename column vehicle_make  to _deprecated_vehicle_make;
alter table public.drivers rename column vehicle_model to _deprecated_vehicle_model;

-- jobs: service_tier is empty on all jobs. Only the unused view active_jobs_board
-- references it (a view follows the rename, so nothing breaks).
alter table public.jobs rename column service_tier to _deprecated_service_tier;

commit;

-- ROLLBACK: rename each column back (drop the "_deprecated_" prefix).
--
-- AFTER ~1 WEEK with no errors in the Supabase logs, drop for real:
--   alter table public.drivers
--     drop column _deprecated_eid_front_url, drop column _deprecated_eid_back_url,
--     drop column _deprecated_eid_verified,  drop column _deprecated_emirates_id,
--     drop column _deprecated_vehicle_make,  drop column _deprecated_vehicle_model;
--   -- jobs._deprecated_service_tier can only be dropped after active_jobs_board
--   -- is dropped or recreated without it.
