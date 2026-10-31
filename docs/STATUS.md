# Project Status — current state only

> Last updated: **2026-10-31**. History: `CHANGELOG.md`; plan of record:
> `ROADMAP.md`. Career map and state: `ROAD-TO-WORLDS-STATUS.md`.

## Where things are

- **Production:** `main` at v1.4.6, `rocketdraft.app`, assets-only Cloudflare
  static export. Season 1 is not approved for production.
- **Season 1 candidate:** `staging`, **v2.0.0-rc.36.5**, career on, noindex,
  preview tools on, analytics off. Play at `staging.rocketdraft.app`.
- **Etapas 1–2:** built; Gate 2 still needs Miguel's play. ENG-03 real-save
  fixtures remain open.
- **Etapa 3:** complete for **Gate 3b**. Six fronts integrated and independently
  reviewed: training and HQ polish, sponsor/contract talks, founding economy
  and slower growth, season goals/news/achievements, crests/calendar/weekends.
  rc.36.5 corrects the requested news typography/controls, adds cycle-report
  opt-out and coach-compatible repeat, weekly scrim variety, roster inspection
  and spectator layout. New sponsors share a one-season horizon; prizes grow
  in rounded annual steps. Local clubs retain their own development origin.
  Gate 3b remains open: `CAREER-FEEDBACK-rc36-5.md`.
- **Next after approval:** Etapa 4 (rc.37), then Etapa 5 (rc.38), then cutover.
  Further screen polish goes to Etapa 5; bugs can be fixed at the gate.

## Current gates and evidence

- Full suite: **1463 passed**, 18 opt-in checks skipped; typecheck
  clean; lint **0 errors, 0 warnings**. Data regeneration is unchanged and
  validation green. Staging-like static build, browser E2E and request budget:
  `CAREER-FEEDBACK-rc36-5.md` (EN/PT desktop/mobile; Classic 62/75, home 27/28).
- **BALANCE_VERSION 10**; fingerprint is
  pinned by `src/config/balanceVersion.test.ts`. Package, lock and site version
  are all rc.36.5.
- Opening: 63 paired starts, every difficulty × roster × region, three
  seasons; four additional paired SAM/Normal/prospect starts over six seasons.
  Isolates local annual rebasing under the same new finance rules: first-year
  results identical in all 63 pairs. SAM first Major S6/S6/none/S4 → S4/S4/S6/S4.
  Real resources; deterministic policies, not human success forecasts.
- Earlier pacing/economy/growth/endgame evidence remains in rc36-3/4 reports.
  Regional timing, star affordability and Worlds titles remain open. Six
  historical seasons, then infinite; years 7–8 do not satisfy the launch goal.
- For future economy/growth changes run `CAREER_ECON=1` (four processes by
  `ECON_REGIONS`), `CAREER_ARC=1` **alone**, `CAREER_GROWTH=1` and
  `CAREER_TRAINING=1`. Never combine ARC with ARC_REPORT.
- Before a release: typecheck, full tests, lint, build:data/validate:data,
  staging-like build; E2E on Wrangler, `request-budget.mjs`; visual effects
  also `perf:probe`. Data/pool changes additionally require SIM_MATRIX and
  CH_TUNE if challenges leave their bands; shared-sim golden changes require
  a documented decision.

## Still open before main

- Miguel's account/cutover actions: `V2-IMPLEMENTATION-PLAN.md` §6 (staging
  Supabase/Worker vars, production SQL and freeze trigger, pre-season freeze,
  grants, Cloudflare variables and sitemap).
- Manual regression (§7), Lighthouse, event-card curation, PT pass and the
  v2.0 player notes. Gate 3b's loan, wage-budget, scouting-band and older-roster
  decisions remain in `ROADMAP.md`.
- Reconciliation of the attached rc.29 plan, deliveries versus pending work,
  changed decisions and the shortest completion path: `ROADMAP-REVIEW-2026-10-31.md`.
  Current packages/estimate: `ROADMAP-NEXT-2026-10-31.md`; planning only.
- Scripted career news corpus and 50/50 partner material/permission; the brand
  stays The Wire until agreed. Missing optional art uses fallbacks.

## Standing contracts

- Player saves remain on `https://rocketdraft.app` only; staging saves have
  their own origin. Persist versions/keys remain frozen and migrations additive.
- Pure static export, assets-only Worker, no server code. Career routes stay
  noindex; production only enables career with NEXT_PUBLIC_CAREER_MODE=1 at
  the approved cutover.
- Supabase accounts are code-complete, not enabled in production. PostHog is
  lazy, cookieless, EU and production-only. Never commit hash-only manifest
  changes from a Windows asset rebuild.
