# Project Status — current state only

> Updated: **2026-11-08**. History: CHANGELOG.md; plan: ROADMAP.md.
> Career map: ROAD-TO-WORLDS-STATUS.md.

## Current builds

- Production: main, v1.4.8, https://rocketdraft.app; assets-only static export.
  Season 1 is not approved for production.
- Season 1 candidate: staging, **v2.0.0-rc.36.20**, career on, noindex,
  preview tools on, analytics/accounts off in the isolated QA export.
  Play at https://staging.rocketdraft.app.
- The rc.37 career workstreams remain separate. This package does not edit
  career engine/store or existing career balance values.

## Current evidence

- CH-01/02/03: 45 fixed-seed challenges / 135 stars with legal engine/store
  replays, reload and once-only grants. Seven Draft Labs. Existing IDs, seeds,
  goals and earned progress are preserved by rc.36.17.
- Daily follow-up: 365 unique reviewed seeds, 09/11/2026–08/11/2027 UTC;
  every legal store replay wins and earns its bonus. The 11-template rotation
  separates Hard/Legacy days. Only future dailies read the new field shifts.
- Quiz: 259 eligible players, a deck without repeats until completion, and
  unambiguous full clues before the last attempt. Older dates keep their answer.
- UI-01/01a/02: clear login XP, collected days and in-cell rewards; every rank's
  actual rewards/condition; all 35 badges and 18 banners reviewed, including
  First Chapter, Overdrive and Cosmic Ascension. Static/live layers, EN/PT,
  profile/locker integration, 320px and reduced effects checked.
- rc.36.18 restores lock overlays, shows all owned badges and inline track
  rewards, cleans rank-up and separates orbital banner art from its background.
- rc.36.20 compacts login/rank rewards, adds visual XP, makes locks translucent
  and restores missing reusable shapes and independent banner motion planes.
- Release validation: 2000 tests passed, lint, types and static export checked.
  Production probe: profile 63 ms/s, board 20 ms/s, zero compositor failures.
  Lighthouse accessibility: 100/100 on profile/login and Challenges entries.
  Final visual/performance/accessibility evidence and limits:
  UI-REVIEW-rc36-20.md and UI-DAILY-AUDIT-rc36-17.md.
- Cosmetic inventory/proposals share one 106-row table:
  COSMETICS-CATALOG-UNIFIED.md (89 existing, 17 proposed; grants unchanged).
- BALANCE_VERSION 14 changes daily-only calibration. Existing match/chemistry,
  Classic/Quick and career tunables retain their values.

## Remaining gates

- Etapas 1–2 are implemented; Gate 2 play and ENG-03 real-save fixtures remain.
- Gate 3b: career progression/economy acceptance, including historical Worlds
  pacing. Use existing rc36-3/4/5 evidence and the separate rc.37 reports;
  do not claim simulation policies predict human success.
- Etapa 4: collection pacing and acceptance, DATA-02, SEA-01 cadence/rewards
  review and ECO-06 sales/trades decision. UI-01/02 are delivered; the other
  decisions are not silently closed.
- Etapa 5: integrated playtest by difficulty/region, real saves, account/sync,
  performance, final EN/PT/art, tutorial and launch notes.
- Etapa 6: season dates, leaderboard freeze/grants, migration/rollback rehearsal
  and Miguel's cutover actions (V2-IMPLEMENTATION-PLAN.md §6). No main deploy.
- Refresh the reviewed daily calendar before November 2027 or after data/rule
  changes; the replay suite guards the currently reviewed dates.

## Standing contracts

- Production saves stay on https://rocketdraft.app. Staging is a separate
  origin; persist keys/versions are frozen. Repairs and unlock facts are additive.
- Pure static export, assets-only Worker; no server/Worker script. Career
  production enablement remains a cutover decision. No account/hosting change.
- No unreviewed source asset replacement or hash-only churn. Banner SVG layers
  are generated from the existing design; production serves raster backgrounds.
