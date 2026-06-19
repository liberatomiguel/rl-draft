# Accounts, cloud sync & leaderboards — setup guide (v1.4)

This is the **ops checklist for Miguel**. The code is in place but **dormant**:
with no Supabase env vars, the game runs exactly as the guest-only build and the
Leaderboards page shows local records + a "coming soon" note. Do the steps below
to switch it on. Nothing here touches game logic — it's pure configuration.

> **The progress-safety guarantee is already built and unit-tested**
> (`src/lib/profileSync.test.ts`): on first sign-in the local guest profile is
> **merged** into the cloud and the result never regresses below either side, so
> a player who already has local progress keeps all of it. You don't need to do
> anything special to preserve progress — it's automatic.

## What you'll set up (≈20 min, all free tier)

1. A **Supabase project** (Postgres + Auth).
2. A **Discord application** (the OAuth login).
3. One **SQL migration** (the `profiles` table + security rules).
4. **Environment variables** in `.env.local` (local) and **Vercel** (production).

---

## 1. Create the Supabase project

1. Go to <https://supabase.com> → sign in → **New project**. Pick a name (e.g.
   `rocket-draft`), a strong DB password (save it), and a region near your players.
2. When it's ready, open **Project Settings → API** and copy:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (The anon key is safe to expose in the client — Row-Level Security, set up in
   step 3, is what actually protects the data.)

## 2. Create the Discord application (OAuth)

1. Go to <https://discord.com/developers/applications> → **New Application** →
   name it (e.g. "Rocket Draft Login").
2. Left sidebar → **OAuth2**. Copy the **Client ID** and **Client Secret**.
3. Still on OAuth2 → **Redirects** → add this exact URL (from Supabase, step 4):
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
   (You'll find `<your-project-ref>` in your Supabase Project URL.)
4. In **Supabase → Authentication → Providers → Discord**: toggle **Enable**,
   paste the Discord **Client ID** + **Client Secret**, **Save**.
5. In **Supabase → Authentication → URL Configuration**, set **Site URL** to your
   production site (`https://rocketdraft.app`) and add to **Redirect URLs** both:
   - `https://rocketdraft.app/leaderboards`
   - `http://localhost:3000/leaderboards`
   (The app sends players back to the page they signed in from; in v1.4 that's the
   Leaderboards page.)

## 3. Run the SQL migration

Supabase → **SQL Editor** → **New query** → paste the whole block below → **Run**.

```sql
-- Rocket Draft profiles: one row per signed-in player. The full durable profile
-- lives in `durable` (jsonb, for lossless restore + merge); the flattened
-- columns are what the leaderboards ORDER BY.
create table if not exists public.profiles (
  id                  uuid primary key references auth.users on delete cascade,
  username            text not null default 'Player',
  avatar_url          text,
  xp                  integer not null default 0,
  durable             jsonb   not null default '{}'::jsonb,
  -- flattened leaderboard columns
  best_easy           integer not null default 0,
  best_normal         integer not null default 0,
  best_hard           integer not null default 0,
  best_legacy         integer not null default 0,
  best_worldwide      integer not null default 0,
  best_sam            integer not null default 0,
  championships       integer not null default 0,
  daily_streak        integer not null default 0,
  challenges_cleared  integer not null default 0,
  updated_at          timestamptz not null default now()
);

-- Row-Level Security: everyone can READ (leaderboards are public), but a player
-- can only INSERT/UPDATE their OWN row.
alter table public.profiles enable row level security;

create policy "profiles are readable by anyone"
  on public.profiles for select using (true);

create policy "a user upserts only their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "a user updates only their own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Helpful indexes for the leaderboard sorts.
create index if not exists profiles_best_hard_idx       on public.profiles (best_hard desc);
create index if not exists profiles_best_legacy_idx     on public.profiles (best_legacy desc);
create index if not exists profiles_best_worldwide_idx  on public.profiles (best_worldwide desc);
create index if not exists profiles_best_sam_idx        on public.profiles (best_sam desc);
create index if not exists profiles_xp_idx              on public.profiles (xp desc);
create index if not exists profiles_championships_idx   on public.profiles (championships desc);
```

## 4. Set the environment variables

**Local** — add to `.env.local` (already has the PostHog keys):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon public key>
```

**Production** — Vercel → Project → **Settings → Environment Variables** → add the
same two (Production + Preview), then **redeploy**.

> Both are `NEXT_PUBLIC_*` (client-side). The Discord **Client Secret** is NOT a
> Next env var — it lives only inside Supabase (step 2.4). Never put the secret in
> the repo or in a `NEXT_PUBLIC_*` var.

## 5. Verify

1. Restart `npm run dev` (env vars load at boot).
2. Open `/leaderboards` → you should now see a **"Sign in with Discord"** button
   instead of the "coming soon" note.
3. Click it → authorize on Discord → you're returned signed in; your local
   progress is merged + pushed, and the **Global** boards appear.
4. In Supabase → **Table Editor → profiles**, confirm your row exists with your
   stats.

---

## How it works (for when we extend it together)

- **Client wrapper:** `src/lib/supabase.ts` — creates the client only when the env
  vars are present (`accountsEnabled`), otherwise every call is a no-op. Engine
  purity is intact: nothing under `src/engine` imports it.
- **Merge:** `src/lib/profileSync.ts` `mergeProfiles(local, cloud)` — pure, tested,
  monotonic (counters MAX, collections UNION-earliest-date, history union-by-id).
- **Durable slice:** `toDurable(profileState)` is exactly the `ProfileState` fields
  the cloud carries (the #55.7 list + `challengesCompleted` + `records`).
- **Leaderboard feed:** `records` (peak overall per difficulty + worldwide/SAM) is
  updated in `profileStore.applyRunResults`; `leaderboardStats()` flattens it for
  the sortable columns.
- **Sync trigger (today):** on the Leaderboards page mount + on auth change. The
  page handles sign-in/out + merge + push + the global board fetch.

## Follow-ups we can do together (not blocking the launch)

- **Sync after every run** (not just on the Leaderboards page) — a small global
  `AccountSync` mount that pushes on profile change when signed in.
- **A header sign-in chip** so login isn't only on the Leaderboards page.
- **Daily leaderboard** — the daily seed is already shared globally
  (`src/lib/daily.ts`), so a per-date board is a natural addition.
- **Server-side leaderboard cache / pagination** if the board grows large.
- **Account deletion / data export** controls in Settings (privacy).
