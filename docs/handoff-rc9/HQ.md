# rc.9 HQ front: handoff

## What changed
- `hub/SquadBlock.tsx`: the type error (`C.training.auto`) fixed through `playerFocusLabel`; the bootcamp blurb cut.
- `hub/SeasonPlanChoice.tsx`: the three plans as cards (reach bars, goal, bonus as the large figure, budget and confidence), the board's proposal tagged, preselected and first on a phone (Miguel's "simplificamos demais" note).
- `hub/SeasonGoalBlock.tsx` + `HubScreen.tsx`: no season-goal board while a plan or mandate waits (confirmed on screen, founded and FURIA).
- `SeasonGoalRows.tsx`: the reward line said once when both read alike (org board).
- `screens/CalendarScreen.tsx`: rebuilt around the next stop and its action; month grid with tier hairlines and icons; later stops as rows; season progress per split.
- `screens/StandingsScreen.tsx`, `CareerHonorsTable.tsx`: user row in Demi between orange hairlines, no fill or tag; quiet form chips; a table on a phone; hero fixed at 375.
- `screens/SeasonScreen.tsx`, `SeasonStatistics.tsx`: rebuilt in order (outcome, grade, figures, podium cards, goal, what changes next, detail, action); career-titles zeros faint; no 800 weight.
- `tour/CareerTour.tsx`: Board in the tab list when the save has one.
- Copy (EN/PT): `ceremonies`, `sunday`, `standings`, `calendar`, `hub`, `tour`. Words rc9/int to now: hub 797 to 411, sunday 270 to 130, tour 516 to 445, calendar 101 to 84, standings 36 to 20, ceremonies 139 to about 110.
- DESIGN-DECISIONS #240 to #247, CHANGELOG.

## Seen
Shots in `.claude/rc9/shots/hq/` (`final-*`, `before-final-*`). No sideways scroll at 375 and 320 on HQ, Calendar, Standings, Season. Click-through: tour Next/Back/Skip/Got it (focus ring on Skip); plan cards pick and Accept label follows; mandate Start the season; Calendar day open/close, month arrows, later-stop rows open their day; Standings tabs, region keys, user row focus; Season review dock. Season review and the scored Standings were seen with a bot-played save injected in slot 3 of the hq origin. `tsc`: no errors in these files (3 in other fronts' files). Tests: `hqPolish`, `careerTourChapters` pass (17).

## Not verified
Insolvency, retired and Worlds-won endings; the Calendar's invite board and scrim rows; PT on screen; Calendar and Standings at 320 with points; keyboard on the month grid beyond Tab. Two edits in `SeasonScreen.tsx` were made with a short Python replace instead of the edit tool (exact strings, own file).

## For Miguel
The goals copy still prints "W32" in deadlines (`goals.deadline`, ORG-UI's group).
