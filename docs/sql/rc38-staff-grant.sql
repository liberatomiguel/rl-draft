-- Apply only to the staging Supabase project. No users are granted by this migration.
-- Keeps the existing four manual grant IDs and adds the requested 50/50 staff ID.
begin;
alter table public.profile_grants drop constraint if exists profile_grants_grant_id_check;
alter table public.profile_grants add constraint profile_grants_grant_id_check
  check (grant_id in ('early-supporter', 'supporter', 'pro', 'contributor', '50-50-staff'));
commit;
-- Then manually add a profile_grants row with grant_id='50-50-staff' for the
-- intended existing profile. RLS, read policies and permissions remain unchanged.
