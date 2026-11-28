# Project Status — current state only

> Updated: **2026-11-28**. History: CHANGELOG.md. Career map:
> ROAD-TO-WORLDS-STATUS.md. The rc.9 pass: `docs/handoff-rc9/` (SPEC.md and
> one handoff per front). Earlier gate documents: V2.2-STATUS.md,
> V2.3-STATUS.md, ETAPA-1-STATUS.md, PRO-SPEC.md.

## Current builds

- **Production = v2.0.36 (22/11/2026)**, `main` `0991f70`. No Etapa 1 code.
- **Staging candidate = 2.1.0-rc.9 (28/11/2026)**, branch `rc9/ui` (not
  published yet; the publish is Miguel's go). The release is named **2.1**:
  the staging series 2.2.0-rc.1 to rc.8 continues as 2.1.0. BALANCE_VERSION
  58. On top of rc.8 (v2.3 locker room, media days, fan feed; event formats;
  the real-org takeover in RLCS 2027 with the board's mandate; Pro career;
  endless variety; the share kit):
  - **Every screen redrawn** (DS, HQ, TRAIN-MARKET, ORG-UI, CLUB-NEWS,
    DRAFT-UI, MATCHDAY, SHARE, STORIES, DUEL-UI fronts): Demi caps titles, a
    lead block per screen, large figures, cards for choices, rows for ledgers
    (`DESIGN.md` "Composition"; DESIGN-DECISIONS #209 to #300).
  - **Matchday:** the series room (plan, live game, end), two clicks per
    managed series; the live game as a broadcast board.
  - **Locker room that moves** (R211–R219): a weekly pull toward a target
    (results against expectation, form, load), a held mood, four player
    requests, a bounded match effect; the screens show the held mood with
    its trend and reason.
  - **The manager's post** after a big moment (R253–R257) and the Fans tab.
  - **Duel, team against team** (#225–#229, #294–#300): `/duel`, draft from
    the same boards, a best of 7 on the series engine; the rc.6 duel is gone.
  - **Established orgs** get their own catalogue (R220–R226); **coaches
    retire 28 to 35**, late endless projects from season 8 (R230–R235).
  - **Draft:** the absurd losses capped and Region-only placements re-priced
    (#221); share prompts and images (#255–#262).

## Flags (`FEATURES`, balance.ts)

On in every build: `careerMode` (kill switch `NEXT_PUBLIC_CAREER_MODE=0`),
`showEliminatorTeam`. Off everywhere: `careerHardStabilityRule`. On in the
staging build only (`STAGING_BUILD`, off in production): `matchdayStyles`,
`worldLife`, `matchdayDecisions`, `matchdayBoxScore`, `proCareer`,
`realOrgStart`, `board`, `endlessVariety`, `fanFeed`, `lockerRoom`,
`mediaDays`, `eventFormats`. `previewTools` and the type lab (`TYPE_LAB`)
follow staging/dev; `playtest` only with `NEXT_PUBLIC_PLAYTEST=1`. Which flags
ship in 2.1 is Miguel's call; he has said the Pro player career does not.

## Open in rc.9

- Not checked on a phone or in the browser after integration: the held-mood
  marks on Squad, the mood sheet, the goal deadline lines, the dialog focus
  fallback. Phone widths of the TRAIN-MARKET screens were never checked.
- A React "state update before mount" error on the Saves screen (dev only)
  was reported but not reproduced here (no browser run at integration).
- The `/duel` share image still shows the old duel's wording: its text and
  alt are updated, the art needs `node scripts/build-og-duel.mjs`.
- `docs/sql/v2.2-referrals.sql` not applied (Miguel's step).

## Miguel's pending decisions (from the rc.9 handoffs)

- Which staging flags ship in 2.1 (Pro: no).
- LOCKER: the positive match effect (+0.25, brief said +1.0), the Hard
  dynasty lean, "more load" asks about 3 a season.
- STORIES: about one post offer a season for weak clubs; the effect sizes.
- ORG: the inherited deal's profile per tier; the signing cap as the one
  standing figure. CLUB-NEWS: founded items in the Club's Progression for an
  org; the 50/50 mark twice in the newsroom.
- DS: Industry or Chakra Petch (`?type=chakra` on staging).
- SHARE: the "Share frame" cosmetic slot (#262); whether a podium counts as
  "went well" for the invite.
- BUGS: the challenge-reset copy (not applied).
- Carried: Etapa 1 gate items (ETAPA-1-STATUS.md), MATCHDAY-SPEC §11 P1–P4,
  org-less stacks, the DEPLOY-CLOUDFLARE §9 zone rule, PENDING-COSMETICS.md.

## The staging line

Staging accumulates stages; `main` moves only when Miguel decides. Publish:
`git fetch`, merge `origin/staging` if it moved, re-run the checks, then a
fast-forward `git push origin HEAD:staging` (never force; Workers Build,
~11 min). Never a local deploy (`.env.local` holds the Supabase keys), never
`public/fonts-trial/`. After any career engine or store change: the soft-lock
probe (`P1_SOFT=1`, alone) and the Pro probe with every staging flag on.

## Standing contracts

Player saves stay on rocketdraft.app; staging is a separate origin. Persist
keys/versions frozen, repairs additive. Pure static export, assets-only
Worker. Generated art and manifests follow the asset build pipeline.
