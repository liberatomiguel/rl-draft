# Project Status — current state only

> Updated: **2026-11-12**. History: CHANGELOG.md. Career map:
> ROAD-TO-WORLDS-STATUS.md. Plan: ROADMAP.md.

## Current builds

- Production remains main, v1.4.8, https://rocketdraft.app; static assets only.
  Season 1 has no production approval.
- Staging candidate **v2.0.0-rc.54**, the Season 1 cutover build: pre-season rank reward for the peak rank only, one frozen place and reward per pre-season board, nine Season 1 boards, tour reworked (once per season, static draft example, no animation), achievements review (92 draft, 22 career), Rocket Street desk and championship in every SAM season, Season 1 start 12/11. Production Supabase already has the additive schema and SELECT-only public views; the freeze runs minutes before the deploy (docs/handoff-2.0/CUTOVER.md). Not verified: a real sign-in on v2.0 against the production database, the full export of real saves, most new screens in a browser. Details: CHANGELOG rc.54.
- Before it, **rc.53** (Supernova at 90 stars; rc.52 was rc.51 plus Miguel's first look: legendary badges 8 % larger instead of 16 %, a soft glow, five epic titles quieter, Creator in orchid magenta). rc.51: Miguel's cosmetics review of 11/11. Every badge re-exported (Hypernova, Creator and the Staff art added), 9 new banners, 16 new rewards (three-star challenges, Classic feats, Road to Worlds milestones), On Target 50, Rocketeer at Grand Champion, Staff title removed; Wildfire, Heatwave, Cosmic Ascension and the new banners animate from pre-rendered frames. Not played by Miguel; animations checked on a desktop browser only; Supernova 75 vs 90 is open; the Creator / Staff grant SQL is not applied. Details: CHANGELOG rc.51.
- Before it, **rc.50**: wave 2 integrated (mobile pass, copy clean-up, guided tour, analytics catalogue 2.0 with an event budget guard, performance) and the fix of the season-3 soft lock that stopped every career on rc.47–rc.49 (R130–R132). Not played by Miguel; mobile checked in emulation only (no physical device, no Safari); analytics runs in production only and is unverified against PostHog; draft matrix and challenge replays must be repeated once the special-card pool is final. Notes: docs/handoff-2.0/.
- Before it, **rc.47-rc.49**: the launch wave, six fronts integrated (career engine and screens, XP/rating/rank unlocks, draft difficulty, web/SEO, quiz/menu), R129 elite signing (rc.48) and Miguel's review fixes (rc.49); notes in docs/handoff-2.0/. Not yet played by Miguel; the new career screens, the migration of real pre-season saves and account sync are not verified. Still to come before the cutover: final special cards (then repeat the draft matrix and challenge replays). BALANCE_VERSION 25.
- Before it, **rc.42-rc.46**: Miguel's Road to Worlds feedback (rc.42, CAREER-FEEDBACK-rc42.md), mid-career balance (rc.43), real coaches and bench growth (rc.44), support staff (rc.45), elite talent price (rc.46). The coach and staff screens are not yet checked in a browser; rc.45 is not measured on Hard and Easy; rc.46 on Normal only.
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
  rc.42 checks and limits are in CAREER-FEEDBACK-rc42.md.
- Prior challenge/daily/quiz and cosmetics validation remains documented in
  UI-REVIEW-rc36-21.md, UI-DAILY-AUDIT-rc36-17.md and CHANGELOG.md. Daily calendar
  reviewed through 8 November 2027; refresh before then or after rule changes.
- rc.37 battery: 4,914 careers, no softlocks/errors. Reports and F6 experiments
  remain in docs/battery-rc37; these are simulation policies, not predictions
  of human success. This UI/flow release makes no new title-pacing claim.

## Remaining gates

1. Miguel plays F6 in NA/EU/SAM, Normal/Hard first, and answers
   F6-EXPERIMENTOS.md Parts 7.9/7.11. Career pacing/affordability acceptance
   remains Gate 3b. rc.42 does not close it.
2. Review open rc.37 handoff questions (F1/F2/F3); F5 approval before code.
   Gate 2 play and ENG-03 real-save fixtures remain.
3. Etapa 4: collection pacing, DATA-02, SEA-01 and ECO-06. Etapa 5:
   integrated playtests, real saves, account/sync, performance, final EN/PT/art,
   tutorial and launch notes. Etapa 6: season dates, migration/rollback and
   Miguel's cutover tasks in V2-IMPLEMENTATION-PLAN.md §6. No main deployment.
4. PENDING-COSMETICS.md retains the Staff and Creator grant SQL, missing photos
   and the unlock-copy decision; UI publication does not complete them. Event cards/Season Rating
   deltas from 5 November remain Miguel's decisions.

## Standing contracts

Player saves stay on rocketdraft.app; staging is a separate origin. Persist
keys/versions stay frozen and repairs are additive. Pure static export,
assets-only Worker, no account/hosting changes. Generated art/manifests follow
the asset build pipeline; no source asset replacements beyond supplied art.
