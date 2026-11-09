# Project Status — current state only

> Updated: **2026-11-09**. History: CHANGELOG.md; plan: ROADMAP.md; career
> round: ROADMAP-NEXT-2026-11-05.md. Career map: ROAD-TO-WORLDS-STATUS.md.

## Current builds

- Production: main, v1.4.8, https://rocketdraft.app; assets-only static export.
  Season 1 is not approved for production.
- Season 1 candidate: staging, **v2.0.0-rc.38.3** = rc.37 plus cosmetic / reward
  presentation corrections and draft header ordering (CHANGELOG; UNLOCK-COPY-AUDIT-rc38;
  SPECIAL-CARDS-MISSING-rc38). Career on, noindex, preview tools on,
  analytics/accounts off in the isolated QA export. Special-card photos show
  during drafts again, including hidden-overall runs (rc.38.3).
  Play at https://staging.rocketdraft.app.
- F6 balancing: branch `claude/rc37-balance`, cut from staging rc.37. No
  balance change reaches staging before Miguel approves the package.

## Current evidence

- Challenges CH-01/02/03: 45 fixed-seed challenges / 135 stars with legal
  replays, reload and once-only grants; seven Draft Labs (rc.36.16–17).
- Dailies: 365 reviewed seeds (09/11/2026–08/11/2027 UTC), every legal replay
  wins; 11-template rotation. Quiz: 259 eligible players, no repeats.
- UI-01/01a/02 (rc.36.18–21): login/rank rewards, all 35 badges and 18 banners
  reviewed (UI-REVIEW-rc36-21.md, UI-DAILY-AUDIT-rc36-17.md). Cosmetics:
  COSMETICS-CATALOG-UNIFIED.md (89 existing, 17 proposed; grants unchanged).
- rc.37 battery (06/11): 4,914 careers, 0 softlocks/errors. Report:
  `docs/battery-rc37/RELATORIO-COMPLETO.md` (tables `rc37-tabelas.md`, cells
  `rc37-cells.csv`); raw JSONL `C:/Users/Miguel/CLAUDE/rc37-battery/run1`.
  Findings: youth profiles dominate titles; Worlds reach 6 % (EU) to 93 %
  (SSA); bimodal funnel; renewals p50 0.61 of market; chemistry stuck at
  67 %; reputation saturates at 100; the psychologist adds 0 rating.
  Insolvency 2 / 7 / 21 % (on target).
- BALANCE_VERSION **15**: rc.36.16's daily-only calibration plus the rc.37
  career tunables (both sides had bumped to 14). Saves additive only; persist
  keys/versions frozen.
- Merge gates (rc.38.1): typecheck and lint clean; full suite 2117 passed /
  28 skipped (167 files), including visibility and manual-title appearance
  regressions. Staging export validated (all 1073 image URLs). rc.38 real-flow
  captures remain historical evidence; no new captures requested for rc.38.1.
- UI rc.38.2: 3 existing season-header tests, typecheck, lint and staging
  export passed; no new captures. Engine/balance unchanged.
- UI rc.38.3: 19 card visibility/frame tests, typecheck, lint and staging
  export passed. Photos restored; hidden overall remains `??`. No captures.

## Open, in order

1. **F6 balancing** on `claude/rc37-balance`: controlled experiments on the
   measured bottlenecks (renewals first), then a package for Miguel.
2. Miguel's review of the rc.37 handoffs' open points (`HANDOFF-rc37-*.md`:
   F1 10(a)–(g), F2 10(a)–(e), F3 in play); F5 approval before any code.
3. Gate 2 play and ENG-03 real-save fixtures. Gate 3b progression/economy
   acceptance, including historical Worlds pacing; simulation policies do
   not predict human success.
4. Etapa 4 (collection pacing, DATA-02, SEA-01, ECO-06), Etapa 5 (integrated
   playtest by difficulty/region, real saves, accounts/sync, performance,
   EN/PT/art, tutorial, launch notes), Etapa 6 (season dates, leaderboard
   freeze, migration rehearsal, Miguel's cutover in V2-IMPLEMENTATION-PLAN.md
   §6). No main deploy. Still Miguel's: event cards and Season Rating deltas
   (05/11 decisions 15–16).
5. Refresh the reviewed daily calendar before November 2027 or after data or
   rule changes; the replay suite guards the reviewed dates.

6. Cosmetic follow-ups: **PENDING-COSMETICS.md** — staging SQL for Staff,
   user-supplied Staff art, 21 missing special photos, unlock-copy decisions
   and proposed rewards. None are completed by publishing the UI changes.

## Standing contracts

- Production saves stay on https://rocketdraft.app. Staging is a separate
  origin; persist keys/versions are frozen. Repairs and unlock facts are additive.
- Pure static export, assets-only Worker; no server/Worker script. Career
  production enablement remains a cutover decision. No account/hosting change.
- No unreviewed source asset replacement or hash-only churn. Banner SVG layers
  are generated from the existing design; production serves raster backgrounds.
