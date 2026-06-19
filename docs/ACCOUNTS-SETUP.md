# Accounts, cloud sync & leaderboards — setup guide (v1.4)

Login is **email + 6-digit code** (no Discord, no passwords): the player types
their email, gets a code, enters it, done. This is the **ops checklist for
Miguel**. The code is in place but **dormant** until the Supabase env vars are
set — with no vars the game runs exactly as the guest-only build and the
Leaderboards page shows local records + a "coming soon" note.

> **Progress is never lost.** On first sign-in the local guest profile is
> **merged** into the cloud and the result never regresses below either side
> (unit-tested: `src/lib/profileSync.test.ts`). Nothing special needed — automatic.

## Status of the steps

- [x] **Supabase project created** — URL `https://rvdtluzbewzrbrgmouzy.supabase.co`.
- [x] **Env vars set in `.env.local`** (`NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY`,
      the publishable key — safe in the client, RLS protects the data).
- [ ] **Run the SQL** (step 1) — the `profiles` table + security rules.
- [ ] **Email sending** (step 2) — the code template + (for launch) custom SMTP.
- [ ] **Set the same env vars in Vercel** (step 3) for production.

---

## 1. Run the SQL migration

Supabase → **SQL Editor** → **New query** → paste → **Run**.

```sql
-- One row per signed-in player. The full durable profile lives in `durable`
-- (jsonb, lossless restore + merge); the flat columns are what the leaderboards
-- ORDER BY.
create table if not exists public.profiles (
  id                  uuid primary key references auth.users on delete cascade,
  username            text not null default 'Player',
  xp                  integer not null default 0,
  durable             jsonb   not null default '{}'::jsonb,
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

-- Row-Level Security: everyone can READ (leaderboards are public); a player can
-- only INSERT/UPDATE their OWN row.
alter table public.profiles enable row level security;

create policy "profiles are readable by anyone"
  on public.profiles for select using (true);

create policy "a user upserts only their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "a user updates only their own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create index if not exists profiles_best_hard_idx       on public.profiles (best_hard desc);
create index if not exists profiles_best_legacy_idx     on public.profiles (best_legacy desc);
create index if not exists profiles_best_worldwide_idx  on public.profiles (best_worldwide desc);
create index if not exists profiles_best_sam_idx        on public.profiles (best_sam desc);
create index if not exists profiles_xp_idx              on public.profiles (xp desc);
create index if not exists profiles_championships_idx   on public.profiles (championships desc);
```

## 2. Email sending (the 6-digit code)

Email auth is **on by default** in Supabase (Authentication → Providers → Email).
Two things to set:

**a) Make the email show the CODE (not a magic link).**
Supabase → **Authentication → Email Templates → "Magic Link"** → edit the body so
it shows the token. Minimum working body:

```html
<h2>Your Rocket Draft sign-in code</h2>
<p>Enter this code to sign in:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>It expires in 60 minutes. If you didn't request it, ignore this email.</p>
```

(The app calls `signInWithOtp` then `verifyOtp` — it only needs `{{ .Token }}`.)

**b) Custom SMTP — REQUIRED before sharing widely.**
Supabase's built-in email is **rate-limited to a few messages per hour** (fine to
test alone, NOT for a launch). Set up a free sender:
1. Make a free **Resend** account (<https://resend.com>) → verify a sender domain
   (or use their test sender to start) → copy an **SMTP** host/port/user/pass.
2. Supabase → **Authentication → Settings → SMTP Settings** → enable custom SMTP,
   paste the Resend SMTP details, save. (Resend free = 3,000 emails/month.)
3. Optional but nice: Authentication → Settings → set the **OTP expiry** and rate
   limits to taste.

> No passwords are ever stored or entered — Supabase Auth handles the code. The
> only "secret" is the SMTP password, which lives only inside Supabase.

## 3. Production env vars (Vercel)

Vercel → Project → **Settings → Environment Variables** → add for **Production +
Preview** (same values as `.env.local`), then **redeploy**:

```
NEXT_PUBLIC_SUPABASE_URL=https://rvdtluzbewzrbrgmouzy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…   (the publishable key)
```

## 4. Verify

1. Restart `npm run dev` (env vars load at boot).
2. Open `/leaderboards` → instead of "coming soon" you'll see a **"Sign in to
   compete"** email form.
3. Enter your email → **Email me a code** → check inbox → enter the 6-digit code →
   **Verify & sign in**. Your local progress merges + pushes; the **Global** boards
   appear, and you can set a public **display name**.
4. Supabase → **Table Editor → profiles** → confirm your row exists.

---

## How it works (for when we extend it together)

- **Client wrapper:** `src/lib/supabase.ts` — creates the client only when the env
  vars are present (`accountsEnabled`), else every call no-ops. Engine purity is
  intact: nothing under `src/engine` imports it. Auth = `sendEmailCode` +
  `verifyEmailCode` (Supabase email OTP).
- **Merge:** `src/lib/profileSync.ts` `mergeProfiles(local, cloud)` — pure, tested,
  monotonic (counters MAX, collections UNION-earliest-date, history union-by-id).
- **Leaderboard feed:** `records` (peak overall per difficulty + worldwide/SAM) is
  updated in `profileStore.applyRunResults`; `leaderboardStats()` flattens it.
- **Sync trigger (today):** on the Leaderboards page mount + on auth change. The
  page handles sign-in, merge, push, the display-name editor, and the board fetch.

## Follow-ups we can do together (not blocking launch)

- **Sync after every run** (not just on the Leaderboards page) — a small global
  mount that pushes on profile change when signed in.
- **A header sign-in chip** so login isn't only on the Leaderboards page.
- **Daily leaderboard** — the daily seed is already shared globally
  (`src/lib/daily.ts`), so a per-date board is a natural addition.
- **Add Discord as a 2nd login option** later if the community wants one click.
- **Account deletion / data export** in Settings (privacy).
