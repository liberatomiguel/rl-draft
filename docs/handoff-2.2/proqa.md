# PROQA handoff (browser pass on the Pro screens)

Branch `v22/pro-qa` (from `release/v2.2`). Dev server on 3217 from the worktree, flags on. Played in PT first, then EN, at 375x812, 320x640 and a desktop pane. Run by hand and by clicking the real buttons through the page (a script pressed Continue / Play / Accept). No horizontal overflow and no tap target under 43 px at 320 or 375 on any Pro screen (checked by script). Console: no errors except one stale HMR error of my own.

## Fixed (UI and copy only)

- Wizard and week: the primary button now docks on phone (`.action-dock`); it sat at the end of a 3-screen form.
- Wizard: a double tap created two careers (found: two Zeno saves). Guarded with a ref.
- Hub: Continue and One day docked on phone; the figure top right is now labelled "Overall" and is a 44 px link.
- Hub: shows energy and the burnout line (auto-advance ran an unsustainable plan to burnout and nothing said so).
- Hub: no "Next for your team: nothing" under an open match report; no "no team yet" under an open invite; a line warns that an open offer closes if you keep going; an amateur offer says "Accepting means leaving X".
- Player screen: stale "next slices" copy replaced; new "Open career" button (the screen had no way to the hub).
- Card page: link at the bottom to start a career (dead end otherwise).
- Week: energy trace says what the last number is ("then 60 after the weekend"); "Train" label on the focus select is now "Focus"; a ranked block no longer lists six identical +0.02 lines ("Every attribute +0.02"); same grouping in the growth log; ranked sessions and the log say "week", like the hub, not "day 221".
- Mechanics hint rewritten ("needs 4 more training blocks on Mechanics and 5 more points of Mechanics").
- Season history: "No series played" instead of "average -"; the inbox date is "S5 · wk 17" instead of "5.17"; the season-over news handles zero series.

## Not fixed: engine, store or flow

1. **First Continue plays a whole season.** New career, Continue: week 1 to week 32, "The season is over", overall 50 to 53, no decision asked. Cause: `advanceProToNextStopFlow` only stops on a matchday, event, report, new offer or season end, and a ranked-stage player has none. Expected: stop at least at week boundaries or ask once for the plan.
2. **Offers can expire unseen.** An open offer lasts 1 to 2 weeks; Continue runs 4+ weeks at a time. The UI now warns, but the flow should stop on an offer that is about to expire.
3. **One saved plan repeats for 30 weeks.** `weekPlan` stays until changed. A plan that ends the week at 5 energy led to burnout and "Season 7: no series" with Continue only.
4. **Org stage is dead.** Signed to Team Secret as rotation (rotation, bench): no stop and no report for the whole season; history shows "No series played". Known (slice 5), but it is where a player will quit.
5. **Orgs leave the scene** within a season or two ("Team Secret left the scene. You are a free agent."), twice in one career. Known decision 3; it is common enough to feel like a bug.
6. **Amateur invites keep coming** every 4 weeks from sides near your level, including while signed to an org (a TIME AMADOR offer next to two org offers) and repeat names (La Gaming twice).
7. **Card "Orgs: None yet"** after signing with an org and playing a season in it (only orgs with played series count?). `cardFromSave`.
8. Card overall 71.5 ranks 490 of 503, fine; MMR 2880 (Supersonic Legend) at overall 71 looks inflated against the overall.

## Pacing and clarity, by quit risk in the first ten minutes

1. Item 1 above. Everything else is secondary.
2. After a Continue the player has no sign of what the plan did; the week result lives on another screen. A one-line "last week" on Today would help (hub is pro-spine's file; not touched beyond energy).
3. The door is the last thing on `/career/saves`, under three empty manager slots, 3 phone screens down.
4. Orgs say "Rotation / Team level 83" without saying what rotation means for playing time (the contract page does show the promised role; the offer does not explain it).
5. The country list is English in PT ("Brazil"); it is the shared wizard component.

## Not reached

Seasons 1 to 7 played in two careers (about 3 matchdays read in full; the rest by Continue). Not seen: a benched report ("You did not play"), a renewal offer, transfer request button used, burnout from the planner (seen on Today and week, not played through), MVP line, Worlds, awards on the card, the card with titles, Web Share, the PT card page, 320 px of the Offers and Team tabs, the real download file (button clicked, no error, file not opened).

## Rounds 2 and 3 (rc.2 merged; Pro playable, board, real-org start, endless)

Played in the browser at 375/320/desktop, PT and EN. Fixtures: `src/store/proQaFixtures.probe.test.ts` (PRO_QA_DUMP=1) and `src/store/careerQaFixtures.probe.test.ts` (CAREER_QA_DUMP=1, 84 s) write the persisted store JSON to `public/qa-fixtures/` (git-ignored); inject under `rocket-draft:pro:v1` / `rocket-draft:career:v1`.

Fixed: plan gate buttons play the week in one tap (it was accept then Continue, 2 taps a week); no duplicate Continue bar at the gate or season end; the live series screen is the series alone with a docked No-instinto / Play game / Sim bar; decision legend and locked-option text; call result says what it costs; card image no longer runs the legend into the footer (it now truncates lists with an ellipsis); board confidence figure wrapped at 375; the season review now shows the board's verdict.

Not fixed (engine/store): see the final report: card titles keep the first 10 chronologically (Worlds titles dropped); gala exists only as inbox lines; org names with a numeric suffix ("Team Carnaval 8"); project list holds duplicate entries.
