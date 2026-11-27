# ORGMODE UI-B: the board (handoff)

Front UI-B of v2.2 rc.6, branch `v22/org-ui-b` (from `release/v2.2` at 0a876f2). Spec: `ORGMODE-SPEC.md`, "U. Screens", UI-B items 1 to 3, plus the brief wiring and a pass on UI-A's screens. No engine, flow or balance file touched. Design decisions #190 to #195.

## The season plan (`board/BoardParts.tsx`, `BoardPackageChoice`)

The season's opening decision, on the HQ decision block and on the Board page. Title "The season plan" ("As metas da temporada"), one line, the board's brief (established orgs), then the three plans as a radiogroup: cards at 640 px and up (`sm:grid-cols-3`), one board of rows on a phone (`.phone-rows`), from the same markup. Each plan: its name, the "board's proposal" tag on Expected (preselected), the objective as a sentence with the season's total (`objectiveText`: "Top 4 at 2 of the 3 Majors", via `C.goals.seasonTotal` and `goalTotalOf`), the band in words, the budget and the bonus as figures, confidence as one line ("+12 if met · −15 if missed"). A phone row sets those terms as one line so three rows and the action fit in about two screens at 320 px. The chosen card takes the orange hairline; the chosen row the inset rule. One filled button: "Accept the expected plan". A founded club reads "The owners' proposal" and the owners' body line.

## `/career/board` (`board/BoardScreen.tsx`)

One object, not a stack of equal panels (#191). Title slab with the org's real logo, name and tier on the right (desktop only; the top bar carries it on a phone). Two columns from `lg`:

- Left: the object. While the plan is pending it is the plan (in a strong board). During the season it is `ObjectiveBoard`: "Season objective · Expected plan", the objective large, progress as a figure ("1 / 3") with its bar and what is left or its status tag, the band at the start and now (green or red when it moved, "Unchanged since the start" otherwise), the bonus and confidence terms as a sentence. Above it the brief (`BoardBrief`, a paragraph, established orgs only). Under it an active ultimatum (`UltimatumBoard`, its own board on an orange hairline, the mission and its progress as a figure), then the other asks (`AlsoAsked`, a list on the floor with status tags), the season's money (`BudgetStrip`, from `seasonBudgetOf`: board's budget, wages a week with the ceiling and a meter, projected end and with the bonus; it opens Finances) and the standing terms (freeze, title protection, next season's multiplier) when there are any.
- Right: confidence (`ConfidencePanel`: the figure at 60 px, its state word, the meter with the warning and ultimatum lines drawn and named in place, the sentence, the log with reason and season / week), the standing (`StandingTrack`, from `standingOf`: four tier cells with the org's on the orange hairline, the track with the marker, the next tier's line and the relegation floor, each said in a sentence, #193), the manager (`ManagerPanel`: contract through, reputation, clubs managed as a strip of figures, then the record), the board-funded upgrade when offered (blue hairline).
- At the season review the review panel leads (verdict, dismissal and offers, approach). With the verdict showing, the objective board is not repeated.
- Phone order: object, ultimatum, upgrade, confidence, standing, other asks, money, manager.

## HQ and the season review

- Phone: `HubGlance` has a board row between the four figures and the progression row: "Board" ("Owners"), the confidence figure with its state, and one line (choose the plan, ultimatum open, objective n of N, met or missed). It opens the Board page.
- Desktop: `BoardLink` (under the season goal rows in `SeasonGoalBlock`) is now a block: confidence as a figure, its state, a small meter with the two lines, the same line as the phone and "Open the board". Hidden under 640 px (the glance row replaces it there).
- Season review (`BoardSeasonPanel`): the verdict as a board (title, met / missed tag, the objective large, confidence at the review as the figure, the tier change as "Promoted / Relegated" with "Mid-table > Contender" and its consequence, the link to the board); the dismissal on an orange hairline with the offers as org rows (`OrgMark`, real logo, tier, region, squad rank, rating, Accept) and "Found a new club" as its own row under "Or start again"; the approach on a blue hairline with the org row and "Stay". On HQ, a pending job choice is the decision block with one filled link to the season review.

## The brief (`board/briefLines.ts`)

`briefLinesOf(C, brief, org)` turns an engine `SeasonBrief` into `{ reason, facts }`: `C.board.brief[reason]({ org, tier: standing.phrase[tier], goal })` and the `lastRank` / `bestFinish` lines. Used by the plan choice, the Board page, the pick's dossier and the arrival splash. `takeover/briefLine.ts` is deleted (it looked up `brief.kind`, which the engine never writes, so the brief never showed). `store/takeoverPreview.ts` now types the brief as `SeasonBrief` and checks `reason`. `objectiveText` (same file) is the objective with its season total; `goalText` in BoardParts now returns it, so every board objective reads "of N".

## UI-A's screens (pass)

- **Door** (`WayInDoor.tsx`): at 375 x 812 the takeover's action was behind the bottom bar. Now both doors and both actions fit the first screen (measured: the takeover action ends at 750 px, the bar starts at 755): slimmer picture window on a phone, the one-sentence body from 640 px only, tighter fact rows, smaller card padding. Desktop unchanged. Decision #195.
- **Pick dossier** (`TakeoverPick.tsx`): "What you inherit" now sets installations ("3 / 4") and staff retained ("2") as figures with their names under them, the same rhythm as cash and budget above; it used to be two text rows. The brief now shows (it never did: wrong field), via `briefLinesOf`.
- **Arrival** (`ArrivalSplash.tsx`): the brief shows; the board's ask is set as the objective in display type with its band under it, instead of one sentence of body text at the brief's size. `takeover.splash.askLine` removed.
- Not changed: the pick's list and layout, the door at desktop, the splash's roster.

## Also changed outside the board folder

- `hub/HubGlance.tsx`: the board row.
- `hub/DayCard.tsx`: `overflow-hidden` to `overflow-clip` on the day card (one class), so the plan's action can stick on a phone (#194). Same clipping.

## What I saw in the browser (dev server on 3210, all staging flags; saves injected from a scratch fixture test, not committed)

| State | 1280 | 375 x 812 | 320 x 640 | Language |
|---|---|---|---|---|
| Fresh takeover, plan pending: HQ decision block | yes | via the real flow (below) | yes (HQ and Board page, action docked) | EN, PT |
| Fresh takeover, plan pending: Board page | yes | no | yes (season 2 save) | EN, PT |
| Plan chosen mid-season, checkpoint logged: Board page | yes | yes | no | EN |
| Same: HQ phone glance row / HQ desktop block | desktop block yes (PT, day one after accepting) | glance row yes | no | EN, PT |
| Ultimatum (fixture: confidence 22, mission set by hand) | yes | no | no | EN |
| Season review, verdict with tier change (Mid-table > Contender, set by hand) | yes | no | no | EN |
| Dismissal with offers (Dignitas, Mindfreak, Team Singularity, found a club) | yes | no | no | EN |
| Approach (Team Vitality) on the Board page | yes | no | no | EN |
| Founded club's owners (plan pending, Board page) | yes | no | no | EN |
| Season 2 brief ("title" reason, last rank fact) | yes | no | yes | PT |
| Door | no (unchanged on desktop) | yes, both actions on the first screen | no | EN |
| Pick dossier (True Neutral) | no | yes | no | EN |
| Arrival splash | no | yes (before the type change; the change itself not seen) | no | EN |

No sideways scroll at 320 or 375 on the pages measured (`scrollWidth` 320 / 375).

Not seen: the season review screens on a phone; the verdict's "Relegated" variant (only "Promoted"); an accepted job offer (`manager.accepted`); the board-funded upgrade on a phone (seen at 1280, PT); `FEATURES.board` off in the browser (with no `save.board` every piece returns null; `careerBoard.flagOff.test.ts` is green); the arrival splash after its last edit; the door at 320.

## For the engine / the integrator

- On a takeover's day one, Cautious asked "Top 4 at 2 of the 3 Majors" (Likely) while Expected asked "Win a Major" (Likely) at True Neutral (EU elite, seed of the browser session): the cautious plan reads harder than the expected one. The objective ordering is the engine's.
- The HQ season-goal rows still read "+1 reputation at review" for an established org, whose reputation is now its standing; the wording belongs to the season-goal copy (UI-C or the engine front).
- `seasonBudgetOf` before the plan is chosen: the money strip adds the proposed plan's grant to `projectedEnd` and shows "–" for the allocation, as the engine handoff suggested.
- The fixtures in `public/qa-fixtures/b-*.json` (git-ignored) were made by a scratch test that is not committed; the ultimatum, tier change, dismissal and approach were set on real saves by hand.

## Copy

Removed: `board.door`, `board.pick`. Changed: `board.packages.title/body/recommended`. Added (EN and PT, keyed identically): `board.ownersTitle`, `ownersKicker`, `ownersConfidence`, `seasonOf`, `packages.{ownersBody, acceptPlan, ownersRecommended, budgetLabel, bonusLabel, hitLabel, missLabel, confidenceLabel, plan}`, `verdict.{confidenceLabel, tierUp, tierDown, tierNote}`, `warnLine`, `ultimatumLine`, `logWhen`, `outOf`, `progressOf`, `bandStart`, `bandNowLabel`, `bandSame`, `planTerms`, `alsoAsked`, `alsoNote`, `managerTitle`, `contractLabel`, `contractValue`, `reputationLabel`, `clubsLabel`, `money.*`, `glance.*`, `dismissed.{orgsLabel, orLabel, rankLine}`.
