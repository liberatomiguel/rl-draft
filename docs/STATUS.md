# Project Status — current state only

> Updated: **2026-11-10**. History: CHANGELOG.md; plan: ROADMAP.md; career
> round: ROADMAP-NEXT-2026-11-05.md. Career map: ROAD-TO-WORLDS-STATUS.md.

## Current builds

- Production: main, v1.4.8, https://rocketdraft.app; assets-only static export.
  Season 1 is not approved for production.
- Season 1 candidate: staging, **v2.0.0-rc.39.1** = rc.38.3 (cosmetic / reward
  presentation, draft header, special photos back in drafts) plus the career's
  F6 balance package (R100–R108, BALANCE_VERSION 16) and the RLCS 2027 wave in
  the first infinite season (R109; rc.39.1 moved it from season nine). Career on, noindex, preview tools on,
  analytics/accounts off in the isolated QA export.
  Play at https://staging.rocketdraft.app.
- rc.39 is one merge commit on `staging` (branch `claude/rc37-balance`): it is
  undone with `git revert -m 1 <merge>` and a push, or by a rollback of the
  `rocket-draft-staging` Worker's deployment. Saves stay readable either way.

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
  (SSA); insolvency 2 / 7 / 21 % (on target).
- BALANCE_VERSION **17** (rc.39.1; 16 = rc.39, the F6 career package; 15 was rc.36.16's
  daily-only calibration plus the rc.37 career tunables). Saves additive only;
  persist keys/versions frozen.
- UI rc.38–38.3: typecheck, lint, suite and staging export passed (all 1073
  image URLs); no new captures. Details: CHANGELOG.
- rc.39 gates: typecheck, lint, full suite 2129 passed / 31 skipped (170
  files), career static export built. No browser check of the new screens.
- F6 (09–10/11, published in rc.39): the approved package applied (renewal
  jumps ×4/×5, wage curve 1.17, slower easy regions) plus chemistry by time,
  the reserve rule, proportional reputation, psychologist, briefing, the bank
  fix and Hard's own scales (R100–R108). Validated on seed 17019, 147 careers
  a difficulty, paired with the battery. Report: F6-EXPERIMENTOS.md Part 7.

## Open, in order

1. **F6 on staging (rc.39):** Miguel plays it (NA / EU / SAM, Normal and Hard
   first) and answers F6-EXPERIMENTOS.md 7.9 and 7.11 (the pace to a Worlds
   title in the main regions). Not checked in the app: the reserve slot text,
   the "No reserve" hold card, the bank refusal. Design proposals for 2.0.1
   (reputation ladder, a second sponsor, endgame): Part 8.
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
