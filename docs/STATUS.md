# Project Status — current state only

> Updated: **2026-11-10**. History: CHANGELOG.md. Career map:
> ROAD-TO-WORLDS-STATUS.md. Plan: ROADMAP.md.

## Current builds

- Production remains main, v1.4.8, https://rocketdraft.app; static assets only.
  Season 1 has no production approval.
- Staging candidate **v2.0.0-rc.41**, revising rc.40: Miguel's
  Road to Worlds feedback. Manual crest builder, HQ/Club/Training/Finances layouts,
  inbox-only routine loans, mandatory accept/decline, direct-seed coach
  briefings, title ledger, partner events and reputation-20 contracted market.
  Optional cups every open week, calendar forecasts and spectator title stops.
  Request mapping and validation: CAREER-FEEDBACK-rc41.md.
- The rc.39 F6 package remains in place (R100–R109); the 2027 roster wave
  still enters season seven, the first infinite season. BALANCE_VERSION **19**
  includes a 20% reduction of training-wear absence risk with a coach (R111).
- Staging configuration: career on, noindex; accounts/analytics off in the
  isolated QA export. Entry: https://staging.rocketdraft.app.

## Evidence and limits

- rc.40 adds eight integration regressions for historical counts, title
  settlement/reload, routine-loan silence, reputation gates, weekly baseline,
  exact prize tables and persisted crest roles. Historical source audit:
  CAREER-HONORS-SOURCES.md. Missing past individual lineups in existing saves
  are disclosed, not invented. New careers record all future title lineups.
- Browser review covers the creation wizard, HQ, Club, Finances and Training;
  Training/Club/Finances checked at 320 px without horizontal page overflow.
  rc.41 checks and limits are in CAREER-FEEDBACK-rc41.md.
- Prior challenge/daily/quiz and cosmetics validation remains documented in
  UI-REVIEW-rc36-21.md, UI-DAILY-AUDIT-rc36-17.md and CHANGELOG.md. Daily calendar
  reviewed through 8 November 2027; refresh before then or after rule changes.
- rc.37 battery: 4,914 careers, no softlocks/errors. Reports and F6 experiments
  remain in docs/battery-rc37; these are simulation policies, not predictions
  of human success. This UI/flow release makes no new title-pacing claim.

## Remaining gates

1. Miguel plays F6 in NA/EU/SAM, Normal/Hard first, and answers
   F6-EXPERIMENTOS.md Parts 7.9/7.11. Career pacing/affordability acceptance
   remains Gate 3b. rc.41 does not close it.
2. Review open rc.37 handoff questions (F1/F2/F3); F5 approval before code.
   Gate 2 play and ENG-03 real-save fixtures remain.
3. Etapa 4: collection pacing, DATA-02, SEA-01 and ECO-06. Etapa 5:
   integrated playtests, real saves, account/sync, performance, final EN/PT/art,
   tutorial and launch notes. Etapa 6: season dates, migration/rollback and
   Miguel's cutover tasks in V2-IMPLEMENTATION-PLAN.md §6. No main deployment.
4. PENDING-COSMETICS.md retains Staff SQL/art, missing photos and reward/copy
   decisions; UI publication does not complete them. Event cards/Season Rating
   deltas from 5 November remain Miguel's decisions.

## Standing contracts

Player saves stay on rocketdraft.app; staging is a separate origin. Persist
keys/versions stay frozen and repairs are additive. Pure static export,
assets-only Worker, no account/hosting changes. Generated art/manifests follow
the asset build pipeline; no source asset replacements beyond supplied art.
