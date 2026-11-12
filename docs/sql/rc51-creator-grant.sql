-- rc.51 — NOT EXECUTED. Apply only on purpose, to the Supabase project you mean
-- (staging first). No users are granted by this migration.
-- Keeps the five manual grant IDs (the four originals + '50-50-staff' from
-- docs/sql/rc38-staff-grant.sql) and adds 'creator' (the Creator badge + title).
-- If rc38-staff-grant.sql was never applied, this one covers it too.
begin;
alter table public.profile_grants drop constraint if exists profile_grants_grant_id_check;
alter table public.profile_grants add constraint profile_grants_grant_id_check
  check (grant_id in ('early-supporter', 'supporter', 'pro', 'contributor', '50-50-staff', 'creator'));
commit;
-- Then manually add a profile_grants row with grant_id='creator' for the
-- intended existing profile. RLS, read policies and permissions remain unchanged.
