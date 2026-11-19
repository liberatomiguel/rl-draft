-- v2.0.17 (16/11/2026, Miguel): the Verified seal.
--
-- Verified is one more manual grant: a `profile_grants` row with
-- grant_id = 'verified'. No new table, column, view or policy:
--  - the `leaderboard` and `preseason_hall_of_fame` views already aggregate every
--    grant id into their public `grants` column (that is how the boards see it);
--  - the owner-only select policy already lets the player read their own row on
--    sync (that is how the profile and the one-time pop-up see it);
--  - only the dashboard / SQL editor can write grants (no client policy).
-- The one schema change is the grant id check constraint below.
--
-- NOT APPLIED by the agent: run it in the Supabase SQL editor.

-- 1) ONE TIME: let `profile_grants.grant_id` accept 'verified'.
begin;
alter table public.profile_grants drop constraint if exists profile_grants_grant_id_check;
alter table public.profile_grants add constraint profile_grants_grant_id_check
  check (grant_id in ('early-supporter', 'supporter', 'pro', 'contributor', '50-50-staff', 'creator', 'insomniac', 'verified'));
commit;

-- 2) GRANT, by display name (unique, case-insensitive). Idempotent.
insert into public.profile_grants (user_id, grant_id, note)
select p.id, 'verified', 'Verified by Miguel, 16/11/2026'
from public.profiles p
where lower(p.username) = lower('DisplayName')
on conflict (user_id, grant_id) do nothing;

-- 2b) Or by user id (Authentication → Users, or profiles.id).
-- insert into public.profile_grants (user_id, grant_id, note)
-- values ('00000000-0000-0000-0000-000000000000', 'verified', 'Verified by Miguel')
-- on conflict (user_id, grant_id) do nothing;

-- 3) Check: who is verified.
select p.username, g.granted_at, g.note
from public.profile_grants g join public.profiles p on p.id = g.user_id
where g.grant_id = 'verified'
order by g.granted_at;
