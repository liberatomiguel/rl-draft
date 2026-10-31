# Project Status — current state only

> Last updated: **2026-10-31**. History: `CHANGELOG.md`; plan of record:
> `ROADMAP.md`. Career map and state: `ROAD-TO-WORLDS-STATUS.md`.

## Where things are

- **Production:** `main` at v1.4.6, `rocketdraft.app`, assets-only Cloudflare
  static export. Season 1 is not approved for production.
- **Season 1 candidate:** `staging`, **v2.0.0-rc.36.2**, career on, noindex,
  preview tools on, analytics off. Play at `staging.rocketdraft.app`.
- **Etapas 1–2:** built; Gate 2 still needs Miguel's play. ENG-03 real-save
  fixtures remain open.
- **Etapa 3:** complete for **Gate 3b**. Six fronts integrated and independently
  reviewed: training and HQ polish, sponsor/contract talks, founding economy
  and slower growth, season goals/news/achievements, crests/calendar/weekends.
  rc.36.2 restores selective accents, adds HQ bootcamps and weekly scrim recaps,
  improves clubs/coaches/calendar/news, and applies approved goal rewards/Sunday
  trade-offs plus the requested wage/prize experiment.
  Gate checklist, measurements and decisions: `RC36-2-GATE3B.md`.
- **Next after approval:** Etapa 4 (rc.37), then Etapa 5 (rc.38), then cutover.
  Further screen polish goes to Etapa 5; bugs can be fixed at the gate.

## Current gates and evidence

- Full suite: **1447 passed**, 13 opt-in checks skipped; typecheck
  clean; lint **0 errors, 0 warnings**. Data regeneration is unchanged and
  validation green. Staging-like static build, browser E2E and request budget:
  `RC36-2-GATE3B.md`.
- **BALANCE_VERSION 6**, rc.36's shared integration version; fingerprint is
  pinned by `src/config/balanceVersion.test.ts`. Package, lock and site version
  are all rc.36.
- Growth/training and both long-career measurements: `CAREER-GROWTH-rc36.md`,
  `CAREER-TRAINING-rc36.md`, `CAREER-ARC-rc36.md`,
  `ECONOMY-PROBE-rc36.md`; contract comparison: `ECONOMY-CONTRACT.md` §13.
- Normal pace: **0.4562 Majors qualified per season; Worlds in 17.12%**
  of season rows, against the 0.44 / 16% target; the residual is for Gate 3b.
  Match difficulty unchanged. Remaining economy bands are
  explicit gate decisions, not silently approved.
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
