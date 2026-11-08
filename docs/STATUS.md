# Project Status — current state only

> Last updated: **2026-11-07**. History: `CHANGELOG.md`; plan of record:
> `ROADMAP.md`. Career map: `ROAD-TO-WORLDS-STATUS.md`.

## Where things are

- **Production:** `main` at v1.4.8, `rocketdraft.app`, assets-only Cloudflare
  static export. Season 1 is not approved for production.
- **Season 1 candidate:** `staging`, **v2.0.0-rc.36.16**, career on, noindex,
  preview tools on, analytics off. Play at `staging.rocketdraft.app`.
- **Etapas 1–2:** built; Gate 2 still needs Miguel's play. ENG-03 real-save
  fixtures remain open.
- **Etapa 3 / Gate 3b:** integrated; progression/economy acceptance remains
  open. Career feedback evidence: `CAREER-FEEDBACK-rc36-6.md`.
- **Next:** close career progression/economy acceptance, then Etapa 4,
  Etapa 5 and cutover. `ROADMAP-NEXT-2026-11-05.md` gives the current scope and test plan;
  the rc.37 workstreams remain separate.

- **rc.36.15:** 19 missing logos restored, neutral Octane for 28 teams with
  no verified logo, and season-aware identity maps for 11 major orgs.

- **rc.36.16:** CH-01/02/03: 45 challenges / 135 reachable stars, seven
  Draft Labs, exact legal replay proofs, EN/PT and once-only daily rewards.
  Evidence/playtest: CHALLENGE-AUDIT-rc36-16.md. Career rc.37 remains separate.

## Current evidence and limits

- rc.36.16: full suite **1615 passed**, 20 optional skipped, with two workers;
  lint, typecheck and static export pass. All 45 legal solutions earn three stars through the
  engine/store, including reload and repeat rewards. Persist contracts unchanged.

- rc.36.15: full regression **1532 passed**, four resource-timeout cases
  passed in an isolated 20-test rerun (no timeout/config changes). 33 targeted
  logo/data tests, lint and the static export pass.
- Prebuild: 98 data tests and 35 persist-contract tests pass. Accounts and
  analytics remain disabled in the isolated QA build.
- Verified all 438 previous lineups, 1314 starter cards, 289 coaches, 147 subs,
  17 seasons, 111 specials and 56 achievements remain identical. Every old
  player/org id remains valid; only reviewed current spellings changed.
- Logo browser QA: 10 historical/new/fallback roster cases pass, desktop
  and 320px mobile, with no missing images or browser exceptions.
- Browser QA: desktop 1280px and mobile 390/320px, EN/PT, 2027 and both
  2016 editions, NA team 1, card pick/reroll/reload, reduced motion and
  normal reel reveal. No browser exceptions; the season stays hidden from
  sight and assistive technology until the reel lands.
- **BALANCE_VERSION 13**, fingerprint unchanged. Package, lock and site agree
  on rc.36.15. Career calendar/economy, saves, account settings and other
  branches are outside this expansion; progression acceptance stays open.
- Opening/economy/endgame evidence remains in rc36-3/4/5 reports: 63 paired
  three-season starts and four paired six-season SAM/Normal/prospect starts
  isolate local annual rebasing. First-year results identical in all pairs;
  SAM first Major S6/S6/none/S4 → S4/S4/S6/S4. Deterministic policies, not
  human success forecasts. Regional timing, star affordability and historical
  Worlds titles remain open; infinite years do not satisfy the launch goal.
- Rerun opt-in economy/growth matrices only when needed.
  CAREER_ARC runs alone; CAREER_ECON partitions by ECON_REGIONS. Reuse current
  evidence and real-save fixtures; never silently relax a release gate.

## Still open before main

- Miguel's account/cutover actions: `V2-IMPLEMENTATION-PLAN.md` §6 (staging
  Supabase/Worker variables, production SQL/freeze, grants and sitemap).
- Gate 3b progression/economy acceptance and loan, wage-budget, scouting-band
  and older-roster decisions; details in `ROADMAP.md`.
- Etapa 4 collection/challenges/rewards; Etapa 5 integrated regression,
  accounts/sync, real saves, performance, EN/PT, launch notes and remaining art.
- Scripted historical news corpus remains partial. The supplied 50/50 logo,
  presentation and events are implemented; no partner-art blocker remains.

## Standing contracts

- Production saves stay on `https://rocketdraft.app`; staging is a separate
  origin. Persist versions/keys remain frozen; repairs are additive.
- Pure static export, assets-only Worker, no server code. Career routes stay
  noindex; production career enables only at the approved cutover.
- Supabase accounts are code-complete, not enabled in production. Analytics
  stays lazy, cookieless, EU and production-only. No hash-only asset churn.
