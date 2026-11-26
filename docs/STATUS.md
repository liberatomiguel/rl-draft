# Project Status — current state only

> Updated: **2026-11-26**. History: CHANGELOG.md. Career map:
> ROAD-TO-WORLDS-STATUS.md. Post-2.0 Road to Worlds roadmap:
> ROADMAP-RTW-2026-11-17.md, reordered by PLANO-PROXIMO-NIVEL-2026-11-19.md
> (E1/E2 decided 24/11). Etapa 1: ETAPA-1-STATUS.md (gate closed) and
> MATCHDAY-SPEC.md. Etapa 2: PRO-SPEC.md. Phone redesign:
> `docs/redesign/MOBILE-PLAN.md`. Competitor study: CONCORRENTES-2026-11-19.md.

## Current builds

- **Production = v2.0.36 (22/11/2026)**, `main` `0991f70`: the career landing
  `/rocket-league-manager` leads with what a PC mod cannot offer (no mod, no
  download, phones). The current identity; no Etapa 1 code.
- **Staging = 2.2.0-rc.5 (26/11/2026)**, branch `release/v2.2`: rc.6 plus
  the big update, each part behind its own staging-only flag: the Pro player
  career to retirement (`proCareer`), a start at a real organisation
  (`realOrgStart`), the board with confidence, dismissal and job offers
  (`board`), endless variety rounds 1 and 2 (`endlessVariety`).
  BALANCE_VERSION 51. Gate document, numbers and probe commands:
  **`V2.2-STATUS.md`** (decisions R151 to R162, DESIGN-DECISIONS #186;
  handoffs in `docs/handoff-2.2/`). **Open before the gate:** the board's
  stated chances are now bands in words and hold within one band of the
  measured rate (underdog Normal is easier than stated); Worlds reached by
  92 % of average Pro careers (spec: about 40 %); a final browser pass is
  running (no full check of the board, real-organisation and endless screens
  nor of the Pro's match, gala and card); per-season circuit formats were
  judged unsafe and are not built.
- **rc.6 (24/11/2026)** below it, integration of five lines on top of
  rc.5 (`3914518`, the phone redesign):
  - **Phone redesign (rc.5):** every screen has its own layout under 640px
    (run, career with its tab bar, hub); desktop unchanged. Rules: `DESIGN.md`
    "Phone"; DESIGN-DECISIONS #178 to #182, R148. Not on a physical phone or
    Safari.
  - **Etapa 1 gate closed (R149)** and v2.0.36 merged in: new identity,
    Matchday slices 1 to 5, Mundo vivo M1, M2.1, M3, Worlds by region (R146).
  - **Daily: today's best draft and a percentile** against simulated drafts
    (#183, `engine/dailyOptimal.ts`), under a finished Daily only.
  - **Friend duel by link** (#184, `engine/duel.ts`, `/duel`): same seed, same
    draft, standings compared; an exhibition (no XP, rating or cards).
  - **Pro slice 1** (R150, #185, `PRO-SPEC.md`): create a player, growth,
    own save `rocket-draft:pro:v1` (persist CONTRACT changed on purpose),
    behind `FEATURES.proCareer`.
  - Flags on in the staging build only (`STAGING_BUILD`,
    `stagingFlags.test.ts`): `matchdayStyles`, `matchdayDecisions`,
    `matchdayBoxScore`, `worldLife`, `proCareer`. BALANCE_VERSION 47.
  - Entry: https://staging.rocketdraft.app (career on, noindex, accounts and
    analytics off). The duel and Daily screens were built on the rc.4 look and
    merged under the phone redesign: check them at 375 px.

## The staging line (rule since 24/11)

- **Staging accumulates stages; `main` moves only when Miguel decides.**
  Etapa 1 passed its gate on 24/11 (R149) and stays on staging.
- New work (Etapa 2 Pro, the Draft fronts) branches from `origin/staging`.
  A v2.0.x hotfix that ships on `main` is merged into staging, never the
  other way round.
- Several sessions publish to staging in parallel: `git fetch`, merge
  `origin/staging` if it moved, re-run the checks, then a **fast-forward**
  `git push origin HEAD:staging` (never force). Workers Build builds it
  (~11 min). Never a local deploy (`.env.local` holds the Supabase keys),
  never `main` without Miguel, never `public/fonts-trial/`.

## Next

- **Miguel plays rc.6 on staging**, phone first: the redesign, the duel
  (`/duel`), the Daily's best draft, and the Pro door on the saves picker.
- **Etapa 2 Pro, slice 2** after Miguel's review of slice 1 (PRO-SPEC.md
  lists the slices).

## Open decisions (Miguel's)

From the Etapa 1 gate (details in ETAPA-1-STATUS.md):
- XP for the substitute who comes in on a swap (`fieldedIds` does not change).
- Confirm the Worlds spread of R146 (EU 57 / NA 30 / others 13, seasons 1–8).
- Gate goals 3, 6 and 7 (the bot probes do not measure them).
- A7: rc.5 added the career tab bar on phones (`CareerTabBar`); Miguel confirms it closes A7.
- P1–P4 of MATCHDAY-SPEC.md §11 (style cycle, trait names, "Leave it to the
  coach" default, the section 7 limits).

Carried from v2.0.x:
- Org-less stacks (A4 / E3): needs Miguel's list.
- The zone rule of DEPLOY-CLOUDFLARE §9 (self-repair of failed build files,
  v2.0.32) is not applied yet.
- Career cloud save (v2.0.26–2.0.30): not verified on two real devices or
  mobile Safari; watch `account_sync_failed`.
- Which landing start founds more careers (PostHog `/career/new` with or
  without `?start=quick`); search baseline in memory `seo-search-landscape`.
- POSTLAUNCH-2.0-REPORT: an event for a refused career advance, the event
  budget, FR / ES, mobile career entry.
- PENDING-COSMETICS.md: the Staff and Creator grant SQL, missing photos, the
  unlock copy.

## Evidence and limits

- Etapa 1 numbers come from bots (probes and batteries), not players: see
  ETAPA-1-STATUS.md. Mobile widths, PT screens and lite-effects mode of the
  new identity were not checked screen by screen.
- The daily calendar is reviewed through 8 November 2027; refresh before
  then or after rule changes.
- After any career engine or store change: the soft-lock probe
  (`P1_SOFT=1`, alone) before staging.

## Standing contracts

Player saves stay on rocketdraft.app; staging is a separate origin. Persist
keys/versions stay frozen and repairs are additive. Pure static export,
assets-only Worker, no account/hosting changes. Generated art and manifests
follow the asset build pipeline.
