# Season 1 cutover runbook (Supabase + deploy)

> Written 12/11/2026 by the wave 3 coordinator. Replaces
> `V2-IMPLEMENTATION-PLAN.md` §6-B and §6-C: that text assumed the production
> accounts were dormant. They are not (455 profiles, 70 synced in the last 24 h
> on v1.4.8), so the order below is what counts.

## What is already done in production (12/11, migration `season1_prep_additive`)

Additive only; the live v1.4.8 client keeps working (checked: its boards still
return 100 rows, a signed-in sync still updates its own row).

- New columns on `profiles`: the `season_*` set (incl. `season_legacy_titles`,
  `season_titles_sam|na|eu|oce|mena`, `season_worlds`), `lifetime_xp`,
  `quiz_solved`, `login_streak`, `challenge_stars`, `equipped_*`,
  `preseason_position`, `preseason_positions` (jsonb, one place per board).
- `profile_grants` (manual rewards): read-only for the owner, no client writes.
  Grant ids: `early-supporter`, `supporter`, `pro`, `contributor`,
  `50-50-staff`, `creator`.
- Trigger `protect_preseason_columns`: a client can never write
  `preseason_position` / `preseason_positions` (insert or update).
- `leaderboard` view v2: a superset of the old view (it still exposes `xp` and
  `mmr`, so v1.4.8 and stale tabs keep reading it). `preseason_hall_of_fame`.
- **Security fix:** the old `leaderboard` view carried the schema's default
  INSERT / UPDATE / DELETE grants for `anon`. Being a plain view owned by
  `postgres`, it let anyone holding the public key change or delete profile rows.
  Both views are now SELECT-only.

## DONE: the freeze ran on 12/11/2026 at 13:05 UTC

439 accounts placed, 462 rows in `archive.profiles_preseason_final`, `xp` / `mmr`
locked (a client write was tried in a rolled-back transaction and changed
nothing). **Three boards only: `mmr`, `championships`, `titles_legacy`.** Miguel
dropped the two "highest overall" boards from the rewards the same day (too many
ties), so `best_legacy` / `best_sam` are NOT in `preseason_positions`, and the
SQL below, which shows five, is the earlier draft kept for reference. 77 accounts
hold a board reward: 2 champions, 2 runners-up, 3 thirds, 16 elite, 73 finalists.

## T-15 min: freeze the pre-season (run once, one transaction)

From this moment v1.4.8 clients can no longer move `xp` / `mmr` in the cloud
(their own device keeps its progress; the rank reward comes from the device's
save, the board places from this freeze).

Eligible: every account with at least one finished run. One place per board the
v1.4.8 client showed, for accounts that scored on it. Tie-break on every board:
rating, then XP, then who synced first. On the two "highest overall" boards many
accounts share the top value (12/11 dry run: 56 at the top Legacy overall), so
there the rating decides.

```sql
begin;

-- 0) Backup, outside the API-exposed schemas.
create schema if not exists archive;
create table archive.profiles_preseason_final as select * from public.profiles;

-- 1) One place per pre-season board.
with eligible as (
  select id, mmr, championships, titles_legacy, best_legacy, best_sam, xp, updated_at
    from public.profiles
   where coalesce((durable->>'runsCompleted')::int, 0) > 0
), ranked as (
  select id,
    row_number() over (order by mmr desc, championships desc, xp desc, updated_at asc) as p_mmr,
    case when championships > 0 then row_number() over (order by championships desc, mmr desc, xp desc, updated_at asc) end as p_championships,
    case when titles_legacy > 0 then row_number() over (order by titles_legacy desc, mmr desc, xp desc, updated_at asc) end as p_titles_legacy,
    case when best_legacy  > 0 then row_number() over (order by best_legacy  desc, mmr desc, xp desc, updated_at asc) end as p_best_legacy,
    case when best_sam     > 0 then row_number() over (order by best_sam     desc, mmr desc, xp desc, updated_at asc) end as p_best_sam
  from eligible
)
update public.profiles p
   set preseason_position  = r.p_mmr,
       preseason_positions = jsonb_strip_nulls(jsonb_build_object(
         'mmr', r.p_mmr, 'championships', r.p_championships, 'titles_legacy', r.p_titles_legacy,
         'best_legacy', r.p_best_legacy, 'best_sam', r.p_best_sam))
  from ranked r
 where p.id = r.id
   and p.preseason_position is null;

-- 2) Lock the archive: xp / mmr join the columns no client can write.
create or replace function public.protect_preseason_columns()
  returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null or current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.preseason_position := null;
      new.preseason_positions := null;
    else
      new.xp := old.xp;
      new.mmr := old.mmr;
      new.preseason_position := old.preseason_position;
      new.preseason_positions := old.preseason_positions;
    end if;
  end if;
  return new;
end $$;

commit;
```

Checks right after:

```sql
select count(*) filter (where preseason_position is not null) as placed,
       count(*) as accounts,
       (select count(*) from archive.profiles_preseason_final) as backed_up
  from public.profiles;
select username, preseason_position, preseason_positions, mmr, championships
  from public.profiles order by preseason_position nulls last limit 10;
```

Undo (only before the deploy is live): `update public.profiles set
preseason_position = null, preseason_positions = null;` and re-create the
function from the PREP migration (without the `xp` / `mmr` lines).

## T-0: deploy

Merge to `main` only with Miguel's explicit yes. Cloudflare builds from the
branch (never a local deploy: `.env.local` holds the Supabase keys). Production
build variables: `NEXT_PUBLIC_CAREER_MODE=1`, **no** `NEXT_PUBLIC_NOINDEX`,
the Supabase URL / key and the PostHog key already there. The home page shows
the version: check it says 2.0.0.

## After the deploy

- Sign in with a pre-season account: recap shows the peak rank and every board
  place; the locker has the rank reward (the peak rank's only), First Chapter
  and one reward per board band; XP 0, rating 400; collection and history intact.
- `select count(*) from public.profiles where season_id = 1;` grows as players
  arrive. A row that still has `season_id = 0` has not opened v2.0 yet.
- PostHog: events arriving, annotation on the deploy date.

## Manual rewards (grants)

A grant is one row in `profile_grants`. The player sees the title / badge on the
next sync (opening the site). By display name:

```sql
insert into public.profile_grants (user_id, grant_id, note)
select id, 'creator', 'why this player got it'
  from public.profiles where lower(username) = lower('DisplayName')
on conflict do nothing;
```

By e-mail (when the display name is unknown): `select id from auth.users where
email = '...'`. Remove a grant by deleting the row. The account must have a
profile row (it signed in at least once).

## Rollback of the release

The v2.0 client never writes `xp` / `mmr`, and the freeze is kept in
`archive.profiles_preseason_final`. Rolling the site back to v1.4.8 needs the
trigger's `xp` / `mmr` lines removed (PREP version of the function). What
v1.4.8 does with a local save that already migrated to v12 was not tested (the
reset is one-way on the device), so a rollback after players arrived is a last
resort.
