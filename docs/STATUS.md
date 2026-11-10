# Project Status — current state only

> Updated: **2026-11-09**. History: CHANGELOG.md; plan: ROADMAP.md; career
> round: ROADMAP-NEXT-2026-11-05.md. Career map: ROAD-TO-WORLDS-STATUS.md.

## Current builds

- Production: main, v1.4.8, https://rocketdraft.app; assets-only static export.
  Season 1 is not approved for production.
- Season 1 candidate: staging, **v2.0.0-rc.37** = rc.36.21 plus the rc.37
  career round (F1 market, F2 finance, F3 matchday, F4a battery tooling; the
  F5 replay contract is docs only). Career on, noindex, preview tools on,
  analytics/accounts off in the isolated QA export.
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
- Merge gates: typecheck and lint clean; full suite 2095 passed /
  28 skipped (165 files); static export with the staging flags OK.
- F6 triage (09/11, `claude/rc37-balance`): ~1,250 careers paired with the
  battery (bit-exact reproduction). Provisional package: renewal jumps ×4/×5,
  wage curve 1.17, slower start in the easy regions; nothing applied, levers
  off by default. Report: `docs/battery-rc37/F6-EXPERIMENTOS.md`.

## Open, in order

1. **F6:** Miguel approves the direction → confirmation on the 3 difficulties
   (~500 careers, ~2 h) → validation on seed 17019 (882, ~3 h) → rc.38 on
   staging. His six open decisions: F6-EXPERIMENTOS.md Parte 5.
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

## Standing contracts

- Production saves stay on https://rocketdraft.app. Staging is a separate
  origin; persist keys/versions are frozen. Repairs and unlock facts are additive.
- Pure static export, assets-only Worker; no server/Worker script. Career
  production enablement remains a cutover decision. No account/hosting change.
- No unreviewed source asset replacement or hash-only churn. Banner SVG layers
  are generated from the existing design; production serves raster backgrounds.
