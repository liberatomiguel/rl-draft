-- v2.0.10: ignore a profile write from a pre-2.0 client once the account is on a
-- Season blob.
--
-- What happened (13/11/2026, account 74 of the pre-season board): a copy of the game
-- that was opened BEFORE the Season 1 deploy (an old tab or a cached app) kept
-- running the old code. When it synced, it saved the profile in the old format on
-- top of the Season 1 one: the cloud copy lost its season, cosmetics, missions and
-- lifetime blocks. A v2 device repairs it on its next sync from its own local copy,
-- but a player whose only Season 1 copy is the cloud one would lose it.
--
-- The rule: when the stored blob has the `season` key and the incoming one has not,
-- the row keeps every value it had. Dashboard and service-role writes pass.
--
-- APPLIED in production on 13/11/2026 (migration
-- v2011_reject_stale_client_write_and_backup, after the season leader's profile was
-- reset by an old tab). Triggers on public.profiles: protect_preseason_columns,
-- reject_stale_client_write.

create or replace function public.reject_stale_client_write()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if (auth.uid() is not null or current_user in ('anon', 'authenticated'))
     and old.durable ? 'season'
     and not (coalesce(new.durable, '{}'::jsonb) ? 'season') then
    return old;
  end if;
  return new;
end $function$;

drop trigger if exists reject_stale_client_write on public.profiles;
create trigger reject_stale_client_write
  before update on public.profiles
  for each row execute function public.reject_stale_client_write();

-- Check: no Season 1 row should be left with a pre-season blob.
-- select count(*) from public.profiles where season_id >= 1 and not (durable ? 'season');
