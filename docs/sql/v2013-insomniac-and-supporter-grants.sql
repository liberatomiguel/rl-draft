-- v2.0.13 (14/11/2026, Miguel): the Insomniac title and three supporter grants.
--
-- 1. `profile_grants.grant_id` accepts 'insomniac' (the Legendary title for the
--    first player to reach Supersonic Legend in Season 1).
-- 2. Arc gets 'insomniac' and 'supporter'; Mystic and RSphinx get 'supporter'.
--
-- Accounts are matched by their exact display name (unique, case-insensitive).
-- The inserts are idempotent. A client older than v2.0.13 ignores the unknown
-- 'insomniac' grant, so the order against the deploy does not matter; the player
-- sees the title once he loads v2.0.13.
--
-- NOT APPLIED by the agent: run it in the Supabase SQL editor.

begin;

alter table public.profile_grants drop constraint if exists profile_grants_grant_id_check;
alter table public.profile_grants add constraint profile_grants_grant_id_check
  check (grant_id in ('early-supporter', 'supporter', 'pro', 'contributor', '50-50-staff', 'creator', 'insomniac'));

insert into public.profile_grants (user_id, grant_id, note)
select p.id, g.grant_id, g.note
from (values
  ('arc',     'insomniac', 'First Supersonic Legend of Season 1 (14/11/2026)'),
  ('arc',     'supporter', 'Granted by Miguel, 14/11/2026'),
  ('mystic',  'supporter', 'Granted by Miguel, 14/11/2026'),
  ('rsphinx', 'supporter', 'Granted by Miguel, 14/11/2026')
) as g(username, grant_id, note)
join public.profiles p on lower(p.username) = g.username
on conflict (user_id, grant_id) do nothing;

-- Expect 4 rows: Arc x2, Mystic, RSphinx.
select p.username, g.grant_id, g.granted_at
from public.profile_grants g join public.profiles p on p.id = g.user_id
where lower(p.username) in ('arc', 'mystic', 'rsphinx')
order by p.username, g.grant_id;

commit;
