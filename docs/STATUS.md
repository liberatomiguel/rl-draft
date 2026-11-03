# Project Status — current state only

> Last updated: **2026-11-03**. History: `CHANGELOG.md`; plan of record:
> `ROADMAP.md`. Career map: `ROAD-TO-WORLDS-STATUS.md`.

## Where things are

- **Production:** `main` at v1.4.6, `rocketdraft.app`, assets-only Cloudflare
  static export. Season 1 is not approved for production.
- **Season 1 candidate:** `staging`, **v2.0.0-rc.36.8**, career on, noindex,
  preview tools on, analytics off. Play at `staging.rocketdraft.app`.
- **Etapas 1–2:** built; Gate 2 still needs Miguel's play. ENG-03 real-save
  fixtures remain open.
- **Etapa 3 / Gate 3b:** integrated; acceptance remains open. rc.36.6 fixes
  calendar holds and hidden training reports, adds Tuesday/Wednesday practice
  playback, simplifies spectator actions and clarifies HQ/training. Public
  news is presented by 50/50; private decisions go to mail. Supplied regional
  names power new careers. Rare 1v1/2v2 cups and new showmatch invitations
  complete this feedback package. Evidence: `CAREER-FEEDBACK-rc36-6.md`.
- **rc.36.7:** inline practice detail, window underlines, selectable news lead,
  partner notifications, qualifier/direct-eight layout and phase-based briefing.
  160 targeted tests plus types/lint/static export pass. BALANCE_VERSION 13.
- **Next:** close career progression/economy acceptance, then Etapa 4,
  Etapa 5 and cutover. `ROADMAP-NEXT-2026-11-03.md` gives scope and a next-chat
  prompt: four sessions estimated, with a fifth reserved for unresolved gates.

## Current evidence and limits

- rc.36.6 career/content/persist/assets/balance regressions: **968 passed**,
  15 optional checks skipped (77 files passed, nine skipped). Typecheck and
  lint of changed TS files clean. Data validation and 35 persist-contract
  checks pass. Build/browser evidence and environment limits are recorded
  in `CAREER-FEEDBACK-rc36-6.md`.
- **BALANCE_VERSION 13**, fingerprint pinned by its test. Package, lock and
  site agree on rc.36.6. This feedback package does not remeasure the career
  economy or assert that historical Worlds pacing is solved.
- Prior full-suite baseline: 1463 passed, 18 optional skipped (rc.36.5).
  Prior static/mobile/request-budget evidence remains in that release's report.
- Opening/economy/endgame evidence remains in rc36-3/4/5 reports: 63 paired
  three-season starts and four paired six-season SAM/Normal/prospect starts
  isolate local annual rebasing. First-year results identical in all pairs;
  SAM first Major S6/S6/none/S4 → S4/S4/S6/S4. Deterministic policies, not
  human success forecasts. Regional timing, star affordability and historical
  Worlds titles remain open; infinite years do not satisfy the launch goal.
- Only rerun opt-in economy/growth matrices when an actual change needs them.
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
