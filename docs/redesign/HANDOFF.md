# Redesign handoff (paused 2026-11-17)

Branch: `design/broadcast-pilot`, cut from `staging` at v2.0.14. **Work in
progress: not merged, not pushed, not published to staging.** This commit
exists to save the state. Do not ship it as it is (see "State of the tree").

Goal (Miguel, 17/11): remove the generated look from the whole game and give it
one deliberate, high-quality identity, using the anti-slop rulebook
(github.com/miqdadbadjuber/anti-slop) as the filter. Mobile is out of scope
here: it gets its own session.

## Where the direction lives

- `DESIGN.md` (repo root): the approved direction. Read it first.
- `docs/DESIGN-DECISIONS.md` #164 to #167: how the direction was reached, pass
  by pass, with Miguel's feedback on each.
- `docs/CHANGELOG.md`, entry "[Unreleased] broadcast package pilot": what
  changed in each of the four passes.
- `docs/redesign/REFERENCES.md`: the fifteen reference images Miguel sent after
  the pause, read as ideas per screen (a stage for the main object, scoreboard
  blocks, match and transfer rows, quest rows, a month grid) and the patterns
  in them that we do not take. He restated the identity with them: RLCS
  broadcast desk, Industry, blue and orange, premium and minimal, every
  anti-slop principle.
- `docs/redesign/REVIEWER-BRIEF.md`: the brief given to each screen reviewer
  (the checklist to apply per screen). Its link to the rulebook's UI skill
  points at a temp folder that is gone: fetch the skill from the repository
  above (`skills/antislop-ui/SKILL.md`, and `skills/antislop-copywriting/SKILL.md`
  for copy).

## What is done and approved by Miguel

"A identidade geral ficou boa" (after the fourth pass). In short:

- Shared primitives: `Panel` (opaque night-blue board, hairline, 12px corner),
  `Button` (flat orange primary), `Badge` (flat tint), `SectionTitle` (paper
  slab with the orange chip, `.title-slab`; kicker under the title).
- Type: Barlow for text, Barlow Condensed as the shipped display face, Bold as
  the heaviest weight, italic only on the Home wordmark. Rajdhani and Geist
  Sans are out of the interface.
- Colour: the cards' night blue as floor and boards, orange for the one
  action, paper for title slabs and the key figure, `.solid-orange` /
  `.solid-blue` for the two modes on the Home.
- Home recomposed (wordmark, rank and rating scorebug, two solids, TODAY as a
  list, YOUR PROGRESS as a stat strip). Header nav with an orange rule.
- Career, first sweep: blurred orbs and state glows removed, career tab bar
  made solid, gradient buttons replaced by the primary.
- What's New dialog simplified (no eyebrow dot, glyph tiles, numbering, top bar).

## What was in flight when work stopped

Eight reviewers were applying `REVIEWER-BRIEF.md` in parallel and all stopped
mid-task (usage limit). **Their edits are in this commit, unfinished and not
reviewed by anyone, not seen in a browser.** Treat each area as "started":

| Area | Files | Known progress |
|---|---|---|
| Career HQ | `career/screens/HubScreen`, `career/hub/*`, `CareerShell`, `CareerTopBar` | unknown, 1 hub file touched |
| Squad, Market, Training | `career/screens/{Squad,Market,Training}Screen`, `PlayerCardTile`, `PlayerSheet`, `OrgSheet`, `training/*` | was on OrgSheet rosters |
| Finances, Season | `career/screens/{Finances,Season}Screen`, `career/finances/*`, `sponsors/*` | 4 finances files touched |
| Club, Standings, Calendar, News, Saves | those screens, `ladder/*`, `news/*` | unknown |
| Events, wizard, tours | `career/screens/{Event,Follow,Wizard}Screen`, `career/event/*`, `wizard/*`, `tour/*` | tours done, wizard started, events not |
| Draft run flow | `components/screens/*`, `challenges/*`, `MissionsPanel` | was mid DraftScreen |
| Profile, collection, content pages | `app/{profile,collection,achievements,leaderboards,settings}`, root components, content pages | a few root components touched |
| Copy EN and PT | `src/content/*` | `copy.en.ts` and `copy.pt.ts` mostly done (13 and 4 em dashes left); `copy.career.en.ts` (282) and `copy.career.pt.ts` (270) not started |

`git show --stat HEAD` lists every file this commit touched.

## State of the tree at this commit

- `npm run typecheck`: source is clean (3 errors only in generated
  `.next/dev/types`, from a running dev server).
- `npm run lint`: 0 errors, 4 warnings (not looked at).
- `npm test`: **5 failing, 2468 passing.** Not investigated. Likely real:
  - `src/lib/runLabels.test.ts` (asserts the EN daily text exactly; the copy
    pass changed those strings: restore them or update the plan's text).
  - `src/components/career/event/weekendView.test.ts` (events review stopped
    half way).
  Possibly load timeouts, re-run alone before touching:
  `src/store/careerOrgEntry.test.ts`, `careerRtw05.test.ts`,
  `careerSponsors.test.ts`.
- No `npm run build` was run. Nothing was checked in a browser after the
  parallel reviews started.

## What is left, in order

1. **Get back to green.** Re-run the five failing tests one file at a time;
   fix or revert the cause.
2. **Review the in-flight edits.** For each area in the table: read the diff
   against `staging`, open the screen, keep what follows `DESIGN.md`, revert
   what does not. Then finish the area with `REVIEWER-BRIEF.md`. The career HQ
   matters most: about ten boards of equal weight, the day card must become
   the focal point. Do not remove content Miguel tuned in rc.40 to rc.50.
3. **Copy.** Finish `copy.career.en.ts` and `copy.career.pt.ts` (em dashes,
   staccato taglines, aphorisms), then the 17 left in the base files.
4. **Flows.** First visit stacks tour, What's New and the login calendar, and
   every career tab opens its own tour. Open question for Miguel: skip What's
   New for a player who has just seen the tutorial? (Today it shows to
   everyone on purpose.)
5. **Verify in a browser**, desktop, EN and PT: Home, setup, draft, review,
   tournament, results, profile, collection, achievements, leaderboards, every
   career tab, an event weekend, the wizard.
6. **Run the rulebook's Delivery Gate** and record the PASS / FAIL list.
7. `npm test`, `npm run lint`, `npm run build`.
8. **Publish to staging** (Miguel asked for it once the review is finished):
   version the commit, merge into `staging`, push `staging`. Workers Builds
   deploys `staging.rocketdraft.app` from that branch.
9. Mobile, in its own session.

## Decisions waiting on Miguel

- **Industry font.** Chosen as the display face, but the only files are the
  "IndustryTest" trial (personal-use licence, 66 characters, no accents). They
  are NOT in the repo: they sit in the git-ignored `public/fonts-trial/` on
  Miguel's machine and load in `npm run dev` only. Staging and production show
  Barlow Condensed (scaled 106% to sit closer). To ship Industry: buy the
  webfont licence (Fort Foundry), drop the woff2 files in `src/app/fonts/`,
  declare them with `localFont` in `src/app/layout.tsx`, remove the dev-only
  `<link>` there and the note in `globals.css`.
- **What's New for new players** (item 4 above).

## Things that are not part of this work

`docs/MATCHDAY-SPEC.md` and `docs/ROADMAP-RTW-2026-11-17.md` were untracked in
the tree and were left untracked: they were not written in this session.
