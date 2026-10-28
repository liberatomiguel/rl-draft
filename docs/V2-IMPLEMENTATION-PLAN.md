# Rocket Draft v2.0 "Season 1" — implementation plan

> **Status: LIVING DOCUMENT.** Written 2026-10-16 from Miguel's v2.0 design
> guides. It is the execution order for the biggest release in the project's
> history. Each phase lists its deliverables, the files it touches, its gates and
> what Miguel has to do on his side. Update the checkboxes as work lands.
>
> Read `docs/STATUS.md` first for the current state of the repo; this file is the
> plan, not the status.
>
> **Navigation (save context):** Phases 0–3 (§3) are done and shipped as
> v2.0.0-rc.1 on `staging`; §0–§2 are the rules and architecture that are now
> in the code. For remaining work read only **§6** (what Miguel does, in
> order), **§7** (staging regression checklist) and **§8** (open decisions).
> Jump with `grep -n "^## " docs/V2-IMPLEMENTATION-PLAN.md`.

---

## 0. Non-negotiables (every phase, every commit)

1. **Static export only. No Worker script, ever.** Everything below is
   client-side + Supabase. No route handlers, middleware, Server Actions, ISR,
   OpenNext. `wrangler.jsonc` keeps no `main`. (DESIGN-DECISIONS #102.)
2. **Request diet stays.** New pages use `AppLink` (intent prefetch only), art
   through `src/lib/assets.ts` (hashed WebP from the manifest, fallbacks without
   a request), no new third-party SDKs, no polling. New Supabase traffic is
   one read per screen open at most and the existing debounced push. Supabase
   requests do not count against Cloudflare, but they are still a cost: never
   fetch in a loop or on every render.
3. **SEO is revenue.** The home keeps its `<h1>`, the hero copy (`APP.tagline`,
   `APP.description`), `HOME_SEO` content and the `/pt` twin, the metadata
   (`title`, `description`, `keywords`, hreflang, JSON-LD) and the sitemap. The
   redesign reorganises the *menu*, never the crawlable text. Any new indexable
   page gets metadata + a sitemap entry; player-only pages (`/missions`,
   `/quiz` results, profile) are `noindex` where they carry per-player state.
4. **Saves are sacred.** The persist contract changes exactly once in v2.0
   (profile v11 → v12) with an additive migrate that keeps the collection,
   achievements, lifetime counters and run history, and the cloud merge stays
   monotonic per season. `persistContract.test.ts` is updated deliberately, with
   a DESIGN-DECISIONS entry (#110).
5. **Never publish to `main` during v2.0 development.** Work on the feature
   branch, deploy to the **staging Worker** (`staging.rocketdraft.app`,
   `wrangler deploy --env staging` from the `staging` branch, career on,
   noindex). `main` = production = untouched until the full review passes.
6. **Gates before every commit:** `npm run typecheck`, `npm test`, `npm run
   lint` at 0 errors / 0 warnings (since rc.27 — any new one is a regression),
   `npm run build` green for anything that ships (runs `validate:data`,
   `test:contract`, `build:images`, export, `postexport` checks).
7. **Every tunable number in `src/config/balance.ts`; every string in
   `copy.en.ts` + `copy.pt.ts`** (career: `copy.career.*`). Game logic only in
   `src/engine` (pure, seeded RNG).

---

## 1. Release workflow (branches, staging, production)

```
claude/dazzling-cannon-1d6thr  (this work, cut from main @ v1.4.6)
        │  milestone commits "v2.0.0-alpha.N — …"
        ▼
     staging  ← merge for each testable milestone → Workers Builds / `wrangler deploy --env staging`
        │        staging.rocketdraft.app (NEXT_PUBLIC_CAREER_MODE=1, NEXT_PUBLIC_NOINDEX=1)
        │        separate origin → separate localStorage → testers never touch real saves
        ▼
       main   ← ONLY after the full v2.0 review, as "v2.0.0 — Season 1"
```

- **Staging must use its own Supabase project** (see §6 step A). A v2.0 client
  writes the new season columns and a v12 `durable` blob; pointing staging at the
  production project would let testers' rows drift before the pre-season is
  frozen. The code is also defensive (it never writes the frozen pre-season
  columns), but a separate project is the safe setup.
- Season switch = a deploy. The current season is a build-time constant
  (`src/config/season.ts`). There is no server clock; the client's UTC date
  drives dailies, missions, events and the season calendar.

---

## 2. Architecture decisions for v2.0 (the technical base)

### 2.1 Season model (`src/config/season.ts`)

```ts
SEASON = { id: 1, name: "Season 1", startsAt: "<launch date>", endsAt: "<+9 weeks>", weeks: 9 }
PRESEASON_ID = 0
```

- `profile.season.id` tags which season the season-scoped fields belong to.
- **Season-scoped fields keep their names:** `xp` and `mmr` on the profile ARE
  the season values. Every existing reader (rank, rank rewards, Collection gate,
  challenge unlocks, header emblem) keeps working unchanged. `season` holds the
  rest: `{ id, peakMmr, peakRankId, runs, titles, ratingHistory[] }`.
- **Lifetime fields** (never reset): `runsCompleted`, `wins`, `playoffAppearances`,
  `podiums`, `swissWinsTotal`, `gamesWon`, `goalsScored`, `unlockedSpecials`,
  `achievements`, `runHistory`, `dailyResults`, `records`, plus new
  `lifetime: { xp }` (cumulative XP across seasons) and the quiz / mission /
  login counters.
- **Legacy snapshot** `legacy.preseason` is taken by the v12 migrate from the
  v11 profile BEFORE the reset: `{ xp, mmr, rankId, runsCompleted, titles,
  challengesCleared, snapshotAt, position: null }`. `position` (final
  leaderboard place) arrives from the cloud for signed-in players (§2.5).
- **Season-aware merge.** `mergeProfiles` first normalises both sides through
  `normalizeSeason()`: a blob whose `season.id !== SEASON.id` (a v11 cloud row,
  or a row from a previous season) is snapshotted + reset exactly like the local
  migrate, then the two snapshots merge by MAX and the season fields merge by
  MAX. A pre-season cloud row can therefore never re-inflate a Season 1 profile.

### 2.2 Season Rating (replaces the title-only MMR; DESIGN-DECISIONS #111)

- Everyone starts Season 1 at **400** (`SEASON_RATING.start`).
- Rating moves on every finished tournament run by a **placement × difficulty**
  delta (table in `balance.ts`, first-guess values below). Early exits at higher
  difficulties cost a few points (floor 0), so the board rewards results, not
  volume; the first `placementRuns` (5) runs of a season never lose rating.
  Daily ×1.25, Quick ×0.5, hidden overalls +15 % on gains. Challenge runs and
  Road to Worlds never touch it (they give Season XP only).

| Difficulty | Title | Final | 3rd | 4th | Top 8 | Swiss exit |
|---|---|---|---|---|---|---|
| Easy | +6 | +3 | +2 | +1 | 0 | −2 |
| Normal | +10 | +5 | +3 | +2 | 0 | −3 |
| Hard | +16 | +9 | +5 | +3 | +1 | −4 |
| Legacy | +26 | +14 | +8 | +5 | +2 | −5 |

- `season.ratingHistory` keeps the last 40 entries `{ t, delta, mmr, difficulty,
  placement, mode }` for the profile's rating graph. `season.peakMmr` feeds the
  recap and the leaderboard tooltip.
- `lastMmrGain` (results screen) becomes signed (shows −3 too).

### 2.3 Cosmetics (`src/data/cosmetics.ts`, `src/engine/cosmetics.ts`)

Kinds: `title` (tag next to the name), `badge` (small icon), `frame` (ring
around the rank emblem / avatar), `banner` (profile header + leaderboard row
background), `cardBack` (reserved, Phase 1b). **All CSS/SVG, zero image
assets, zero requests.** Each entry: `{ id, kind, tier, style, source }`;
names + descriptions live in `copy.en.ts`/`copy.pt.ts` (`COSMETICS` group).

Ownership is **derived + unioned**, never hand-written into saves:
- `fromLegacy(legacy.preseason)` → participation, rank, position tiers;
- `fromSeasonProgress(rankId)` → the Season 1 rank track;
- `fromGrants(grants[])` → supporter / pro / contributor (cloud, manual);
- `fromMilestones(login, missions, quiz, challenges)` → streak / star rewards.
`cosmetics.owned` caches the union with unlock dates (for "NEW" markers);
`cosmetics.equipped` = `{ title, frame, banner, badges[≤3] }`.

**Legacy rewards (pre-season), the names:**

| Reward | Who | What |
|---|---|---|
| Participation | finished ≥1 run in the pre-season | title **"Day One"** + badge **"First Chapter"** |
| Rank | peak pre-season rank | **profile frame** in the rank's colour, richer up the ladder (Bronze→Gold plain ring · Platinum/Diamond double ring · Champion/GC animated sheen · SSL holo ring) + SSL gets the title **"Pre-season Legend"** |
| Rating top 100 / 50 / 10 / 1 | frozen final board by rating | **banner** + title: **Pre-season Challenger / Contender / Elite / Champion** (higher tiers include the lower) |
| Supporters | manual grant `supporter` | title **"Early Supporter"** + badge; `contributor` → **"Founding Contributor"** |
| Pro players | manual grant `pro` | title **"Pro Player"** + verified-style badge |

**Season 1 progression track (cosmetic, generic):** Bronze banner "Kickoff" ·
Silver badge "Ignition" · Gold frame "Chrome" · Platinum title "Grinder" ·
Diamond banner "Neon Circuit" · Champion frame "Prism" (animated) · GC title
"Relentless" · SSL frame "Supersonic" + title "Season 1 Legend". Login streak:
day 3 badge, day 7 frame, day 14 banner, day 30 title "Streak Master".
Challenge stars: 10 / 25 / 45 stars → badge / card back / title.

### 2.4 Missions + login streak (`src/engine/missions.ts`)

- A **catalog** of mission templates (`id, kind, target, tier easy|mid|hard,
  reward xp, requires{minRank?, legacyUnlocked?, careerMode?}`), ~30 daily +
  ~20 weekly. Progress is driven by typed **progress events** emitted by the
  stores (`run_completed`, `series_won`, `daily_played`, `special_selected`,
  `perfect_chemistry`, `challenge_cleared`, `star_earned`, `quiz_solved`,
  `career_matchday`, …) and folded by a pure reducer.
- **Deterministic pick:** for a date key the eligible catalog is shuffled with
  the seeded RNG (`seedFromDate`) and one mission per tier is taken. The chosen
  ids are stored with the day/week key so the set never changes mid-period.
- Rewards auto-grant on completion (toast), the "all three" bonus too. No claim
  step (fewer taps, nothing to forget).
- **Login streak:** first open of a UTC day counts; consecutive days extend the
  streak; a gap resets it to 1 but keeps earned rewards. XP per day plus the
  cosmetics above. No run required.

### 2.5 Supabase v2 (schema in §6)

- The client **stops writing `xp` and `mmr`** (the pre-season columns are now
  the frozen archive) and writes `season_id`, `season_xp`, `season_mmr`,
  `season_peak_mmr`, `season_titles`, `season_runs`, `lifetime_xp`, the equipped
  cosmetics, `quiz_solved`, `login_streak`.
- `preseason_position` is filled once by Miguel's **freeze SQL** (§6 step C);
  the client reads it on sync and stores it in `legacy.preseason.position`.
- `profile_grants` (manual, dashboard-only writes) carries supporter / pro /
  contributor; read on sync, unioned into `grants`.
- The public `leaderboard` view v2 exposes the season columns + equipped
  cosmetics + `preseason_position` + `grants`; `preseason_hall_of_fame` exposes
  the frozen final standings.

### 2.6 Event-exclusive cards + Special Hunt (`specialCards.json`)

- Optional `event: { from: "YYYY-MM-DD", to: "YYYY-MM-DD", huntRuns: 6 }` on a
  special card. In the window it joins the eligible pool at its rarity's chance;
  outside it is never offered. Owned copies stay in the Collection forever.
- Special Hunt: after `huntRuns` finished runs inside the window
  (`profile.events[eventId].runs`), the card's chance ramps (`SPECIALS.event.
  huntMultiplier`). Collection shows the window and the hunt progress.
- Miguel curates one card per week of Season 1 (8–10 entries) in
  `specialCards.json`; `validate:data` checks the window format.

### 2.7 Match simulation variety + bracket spoilers (engine)

- `match.ts`: per-series **momentum** (the side that lost the previous game gets
  a small bounce, so 4–0 sweeps between equal teams are rarer and comebacks
  happen), scoreline flavour re-tuned (fewer 7–0s, more 3–2 / 4–3 / OT), and a
  `comeback` note when a side wins after trailing 0–2 / 1–3. Overall remains
  dominant: the `balance.test.ts` anchors (+2 → 62–72 %, +6 ≥ 90 %, +12 ≥ 98 %)
  still hold. The golden master is regenerated once, with a CHANGELOG note.
- Bracket spoiler: the playoff/qualifier bracket only shows the next round's
  pairings once the user's own series of the current round is revealed.

### 2.8 Daily Quiz — "Guess the Player" (`src/engine/quiz.ts`, `/quiz`)

- Seeded by the date; picks a player with enough facts (country, years active,
  orgs, titles, teammates) and builds 3–5 ordered clues from the dataset. Three
  attempts, each miss reveals a clue; score 3/2/1; a type-ahead over player
  nicknames. XP on solve, history + stats on the profile, achievements for
  streaks/totals. Zero network.

### 2.9 Challenges 2.0 (Phase 2) — design summary

- Each challenge: `kind: "boss" | "gauntlet" | "preset"`, `stars: [main, s2,
  s3]` with star conditions (`win`, `noSpecials`, `sweep`, `maxOverall`,
  `perfectChemistry`, `underdog`, `hiddenOverall`, `winAll`), per-star XP
  (first time only), rank-gated unlocks, fixed seed, sim-validated win bands
  (floor/ceiling per tier) in `challenges.test.ts`. Progress resets (v12
  migrate moves the old count into `legacy.preseason.challengesCleared`).

### 2.10 Road to Worlds 2.0 (Phase 3) — sub-phases

R1 Hub rebuild (calendar week strip, day-by-day advance animation, "what can I
do now" cards) · R2 Finances (weekly payroll, loans, debt plan, sponsors tab,
buffs on the hub) · R3 Training rework (interactive weekly plan, visible
projections, coach effects explicit, attributes that matter) · R4 Market fixes
(sub slot signing, coach tab routing, negotiation clarity) · R5 Competition
(Community cups rebalanced, regional **qualifier** for non-top-8, local teams
growing over seasons, real new lineups entering by season) · R6 Inserts
(random events, sponsor events, training decisions) · R7 Career achievements
(permanent, mode-owned). Each sub-phase: engine + tests + copy + screens, with
decisions in `ROAD-TO-WORLDS-DECISIONS.md`.

### 2.11 Weekly Cups / PvP duel (post-2.0 idea, designed only)

The async duel needs a stored roster + invite link: a Supabase `duels` table
(RLS: creator + challenger rows, public read of finished results), a static
`/duel` page that reads the id from the query string client-side. Fits the
static rule. Scheduled for v2.1 after Season 1 ships.

---

## 3. Phases in execution order

### Phase 0 — technical base (engine + stores + data + DB), no UI yet
Goal: everything that touches saves and the DB lands first, fully tested, so
every later surface builds on a stable contract.

- [x] 0a Season model, profile v12 migrate (snapshot + reset), lifetime fields,
      season-aware merge, contract test update, DESIGN-DECISIONS #110.
- [x] 0b Cosmetics catalog + derivation + equipped state + copy.
- [x] 0c Season Rating table + history + peak; results readout.
- [x] 0d Supabase v2 SQL (this doc §6) + `lib/supabase.ts` push/read v2 +
      `accountStore` folds grants/position.
- [x] 0e Missions engine + login streak + store events + copy.
- [x] 0f Event-exclusive cards + Special Hunt + data validation.
- [x] 0g Match variety + bracket spoiler fix + golden regen.
- Gate: typecheck · tests · build. Commit `v2.0.0-alpha.1 — Season 1 technical base`.

### Phase 1 — player-facing surfaces of the base
- [x] Season recap "Your Legacy Lives On" (once per profile, upgrades when the
      cloud position arrives).
- [x] Profile v2: identity card (name, title, frame, banner, badges), season
      panel (rank, rating, graph, progress track), lifetime stats, locker
      (equip), achievements, history.
- [x] Leaderboard v2: Season Rating board with cosmetics per row, Hall of Fame
      (pre-season), titles boards; profile peek.
- [x] Missions + login streak UI (home widget + `/missions`).
- [x] `/quiz` Guess the Player.
- [x] Home v2 + top bar (SEO text untouched).
- Gate + commit `v2.0.0-alpha.2 — Season 1 surfaces`. **Merge to staging.**

### Phase 2 — Challenges 2.0
- [x] Engine kinds + stars, progress + reset, new authored set, sim validation,
      star-track rewards, screens.
- Gate + commit `v2.0.0-alpha.3 — Challenges 2.0`. Merge to staging.

### Phase 3 — Road to Worlds 2.0 (R1 → R7)
- Each sub-phase its own commit; career docs updated; staging after R3 and R7.
- [x] A — economy & market clarity: weekly payroll, bank loan, loans panel,
      coach effects + deep link, community-cup local scene, starter rosters,
      sub-slot signing (ROAD-TO-WORLDS-DECISIONS R20–R25).
- [x] B — hub rebuild + week calendar strip + day-by-day advance animation (R26).
- [x] C — training rework: weekly drill, growth ETA meters, attribute effects
      (shared-sim offense/defense, DESIGN-DECISIONS #117), scrim tiers, 21+
      curve (R27–R29).
- [x] D — regional qualifier for non-top-8 (R30); real orgs entering the world
      by season (R31). Local scene scales with the user by construction.
- [x] E — weekly inserts (R33); sponsors tab/perks expanded in A.
- [x] F (part 1) — permanent career achievements (R32, DESIGN-DECISIONS #118).
- [x] F (part 2) — colour kits + contrast guard in the creation wizard (R34).

### Phase 4 — content, QA, launch
- [ ] Event cards curated (Miguel), achievements for new systems, PT pass.
- [x] Automated gates + audits on the rc build: perf audit on `wrangler dev`
      (cold home 25 req, 0 4xx across 21 routes), SEO view-source of `/` and
      `/pt` (title, description, h1, HOME_SEO, JSON-LD intact), browser smokes
      of Finances, Market, Training, HQ, qualifier lobby, inserts, wizard.
- [ ] Manual regression on staging (checklist in §7: profiles, two devices,
      runs, event cards, quiz, challenges, career end-to-end), Lighthouse.
- [x] CHANGELOG `[2.0.0]`, STATUS, DESIGN-DECISIONS #110–#118, ROAD-TO-WORLDS docs
      (R20–R34) — kept current through every sub-phase.
- [ ] Miguel: §6 steps B–D, then merge to `main`, tag `v2.0.0`.

---

## 4. Consistency rules for the new surfaces (UX / copy)

- One visual language: `Panel`, `Badge`, `Button`, `SectionTitle`, `kicker`,
  `display` type; blue = structure, orange = action, gold = achievement, cyan =
  info. New cosmetics introduce colour only through their own tokens.
- Every screen answers in its first viewport: *what is this, what can I do now,
  what do I get.* Primary action is one orange button per screen.
- Copy tone: clean esports-desk, second person, short. EN first, PT mirrored,
  same keys. No memes.
- Mobile first: all new grids collapse to one column; sticky bars reuse the
  existing classes (the `lite-fx` selectors depend on them).
- Mount-gated player state (`useMounted`) with reserved heights (CLS), like the
  home hero does today.

---

## 5. Risk register

| Risk | Mitigation |
|---|---|
| A bad v12 migrate wipes progress | migrate is pure + unit-tested from v1…v11 fixtures; contract test runs in `prebuild`, so a broken migrate cannot build |
| Pre-season cloud rows re-inflating Season 1 | `normalizeSeason` in the merge; the client never writes `xp`/`mmr` again |
| Testers on staging polluting production rows | separate Supabase project for staging (§6-A) |
| Request regression on Cloudflare | no new SDKs, no polling, hashed assets only; re-measure on `wrangler dev` in Phase 4 |
| SEO regression on the home | hero + `HOME_SEO` + metadata are untouched by the redesign; view-source diff in Phase 4 |
| Golden master drift | regenerated once in 0g with a CHANGELOG line; challenges re-validated in Phase 2 |
| Scope blowing past the launch | phases 0–2 are the launch floor; Phase 3 is sub-phased so R1–R5 can ship and R6–R7 slip to 2.0.1 if needed |

---

## 6. What Miguel must do (Supabase + Cloudflare), in order

### A. Before testing on staging (any time from now)
1. Create a **second Supabase project** (`rocket-draft-staging`), run §6-B on it
   too, and set its URL/anon key as the **staging Worker's build variables**
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) together with
   `NEXT_PUBLIC_CAREER_MODE=1` and `NEXT_PUBLIC_NOINDEX=1`. Also configure its
   email template / SMTP like `docs/ACCOUNTS-SETUP.md` §2 (or use the built-in
   mailer for a handful of testers).
2. Optional: insert a few `profile_grants` rows on staging to test the
   Supporter / Pro cosmetics.

### B. On the PRODUCTION project, BEFORE the v2.0 deploy (idempotent, safe today)

Supabase → SQL Editor → paste → Run.

```sql
-- ===== Rocket Draft v2.0 / Season 1 — schema (idempotent) =====

-- 1) Season-scoped + lifetime + cosmetic columns. The old `xp` and `mmr` columns
--    become the FROZEN pre-season archive: the v2.0 client never writes them.
alter table public.profiles
  add column if not exists season_id          integer not null default 0,
  add column if not exists season_xp          integer not null default 0,
  add column if not exists season_mmr         integer not null default 400,
  add column if not exists season_peak_mmr    integer not null default 400,
  add column if not exists season_titles      integer not null default 0,
  add column if not exists season_runs        integer not null default 0,
  add column if not exists lifetime_xp        integer not null default 0,
  add column if not exists quiz_solved        integer not null default 0,
  add column if not exists login_streak       integer not null default 0,
  add column if not exists challenge_stars    integer not null default 0,
  add column if not exists equipped_title     text,
  add column if not exists equipped_frame     text,
  add column if not exists equipped_banner    text,
  add column if not exists equipped_badges    text[] not null default '{}',
  add column if not exists preseason_position integer;

-- 2) Manual grants (early-supporter / supporter / pro / contributor — every
--    GrantId of src/data/cosmetics.ts). You INSERT rows by hand in Table Editor:
--    user_id (from auth.users), grant_id, optional note.
--    Players can only READ their own rows; nobody can write through the app.
create table if not exists public.profile_grants (
  -- references profiles (not auth.users) so the app can embed the grants in the
  -- profile read (one request). Grant only players who already have a profile row.
  user_id    uuid not null references public.profiles(id) on delete cascade,
  grant_id   text not null check (grant_id in ('early-supporter', 'supporter', 'pro', 'contributor')),
  note       text,
  granted_at timestamptz not null default now(),
  primary key (user_id, grant_id)
);
-- rc.27: projects that ran an older copy of this block have a check without
-- 'early-supporter' — replace it (idempotent; the default constraint name).
alter table public.profile_grants drop constraint if exists profile_grants_grant_id_check;
alter table public.profile_grants add constraint profile_grants_grant_id_check
  check (grant_id in ('early-supporter', 'supporter', 'pro', 'contributor'));
alter table public.profile_grants enable row level security;
drop policy if exists "a user reads only their own grants" on public.profile_grants;
create policy "a user reads only their own grants"
  on public.profile_grants for select using (auth.uid() = user_id);

-- 3) Freeze protection: the app can never change the pre-season archive columns
--    (xp, mmr, preseason_position) once v2.0 is live — only the dashboard can.
--    TIMING (rc.27 review): from the moment this trigger exists, no client can move
--    xp/mmr any more. That is harmless while no pre-2.0 client signs in to this
--    project (production accounts are still dormant), but if a v1.x build with
--    accounts is live, create this trigger at the cutover (with step C), not before.
create or replace function public.protect_preseason_columns()
  returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.xp := old.xp;
    new.mmr := old.mmr;
    new.preseason_position := old.preseason_position;
  end if;
  return new;
end $$;
drop trigger if exists protect_preseason_columns on public.profiles;
create trigger protect_preseason_columns
  before update on public.profiles
  for each row execute function public.protect_preseason_columns();

-- 4) Public leaderboard view v2 (safe columns only; DROP first so the column
--    order can change — CREATE OR REPLACE VIEW cannot insert columns).
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = false) as
  select p.username,
         p.season_id, p.season_xp, p.season_mmr, p.season_peak_mmr,
         p.season_titles, p.season_runs, p.lifetime_xp,
         p.xp as preseason_xp, p.mmr as preseason_mmr, p.preseason_position,
         p.best_easy, p.best_normal, p.best_hard, p.best_legacy,
         p.best_worldwide, p.best_sam,
         p.championships, p.titles_easy, p.titles_normal, p.titles_hard, p.titles_legacy,
         p.daily_streak, p.challenges_cleared, p.challenge_stars,
         p.quiz_solved, p.login_streak,
         p.equipped_title, p.equipped_frame, p.equipped_banner, p.equipped_badges,
         coalesce((select array_agg(g.grant_id order by g.grant_id)
                   from public.profile_grants g where g.user_id = p.id), '{}'::text[]) as grants
  from public.profiles p;
grant select on public.leaderboard to anon, authenticated;

-- 5) Pre-season Hall of Fame: the frozen final board (position is filled by step C).
drop view if exists public.preseason_hall_of_fame;
create view public.preseason_hall_of_fame with (security_invoker = false) as
  select p.username, p.preseason_position as position, p.mmr, p.xp, p.championships,
         p.equipped_title, p.equipped_frame, p.equipped_banner,
         coalesce((select array_agg(g.grant_id order by g.grant_id)
                   from public.profile_grants g where g.user_id = p.id), '{}'::text[]) as grants
  from public.profiles p
  where p.preseason_position is not null;
grant select on public.preseason_hall_of_fame to anon, authenticated;

create index if not exists profiles_season_mmr_idx on public.profiles (season_id, season_mmr desc);
create index if not exists profiles_season_xp_idx  on public.profiles (season_id, season_xp desc);
create index if not exists profiles_preseason_pos_idx on public.profiles (preseason_position);
```

### C. At launch: freeze the pre-season board (run ONCE, right before or right after the v2.0 deploy to main)

Eligible = every account that finished at least one run in the pre-season.
Order: rating (`mmr`), then titles, then XP, then who got there first.

```sql
update public.profiles p
   set preseason_position = r.pos
  from (
    select id,
           row_number() over (order by mmr desc, championships desc, xp desc, updated_at asc) as pos
      from public.profiles
     where coalesce((durable->>'runsCompleted')::int, 0) > 0
  ) r
 where p.id = r.id
   and p.preseason_position is null;
```

Check: `select username, preseason_position, mmr, championships, xp from public.profiles order by preseason_position nulls last limit 20;`

Because the v2.0 client never writes `xp` / `mmr` (trigger in B-3), running this a
day after the deploy gives the same result as running it before.

### D. Grants (any time after B)
Table Editor → `profile_grants` → Insert row: `user_id` (copy from
Authentication → Users), `grant_id` = `early-supporter` | `supporter` | `pro` |
`contributor`.
The player sees the title/badge on their next sync (open the site).

### E. Cloudflare
- Staging Worker build variables (§6-A). Production keeps its current variables;
  career stays flag-gated until R1–R5 are accepted, then add
  `NEXT_PUBLIC_CAREER_MODE=1` to the **production** build variables as part of
  the v2.0 launch (and remove the `/career` `noindex` only when the mode is
  final).
- After launch: resubmit the sitemap in Search Console (new `/quiz` page).

---

## 7. Launch regression checklist (staging)

- Fresh profile: tutorial → first run → rank up → Collection unlock → missions
  tick → login streak day 1.
- Pre-season profile (import a real v11 save via DevTools): recap screen shows
  the right rank/rating/titles, rewards appear in the locker, XP = 0, rating =
  400, collection/achievements intact, run history intact.
- Signed-in pre-season account: recap upgrades with position; grants appear;
  leaderboard row shows title/frame/banner; Hall of Fame lists the account.
- Two devices, one account: progress merges both ways, nothing lost.
- Daily / Quick / Classic / Legacy / Regional runs; rating history grows;
  negative delta shows on a Swiss exit after 5 runs.
- Event card inside/outside its window; hunt ramp after N runs.
- Quiz: solve on 1st/2nd/3rd attempt and fail; next day a new player.
- Challenges: 1/2/3 stars; repeat gives no XP; stars track rewards.
- Career: creation → first week → qualifier → regional; payroll weekly; loan.
- `wrangler dev` request counts (home cold ≤ 30, draft run ≤ 75), 0 404s.
- View-source `/` and `/pt`: h1, hero copy, HOME_SEO sections, JSON-LD present.

---

## 8. Open decisions for Miguel (answer whenever; defaults are implemented)

1. Rating deltas (§2.2) and whether Swiss exits should cost rating at all
   (default: yes, after 5 placement runs, floor 0).
2. Names: "Day One" / "First Chapter" / "Pre-season Challenger→Champion" /
   "Early Supporter" / "Founding Contributor" / "Pro Player" (defaults).
3. Season 1 dates (`src/config/season.ts`), 9 weeks by default.
4. Avatar: v2.0 ships rank emblem + frame; a picture picker (own special cards /
   org logos) is Phase 1b if wanted. No uploads (storage, moderation, requests).
5. Event cards: which 8–10 cards, one per week.
