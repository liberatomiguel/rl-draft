# ORGMODE UI-A: the way in (handoff)

Front UI-A of v2.2 rc.6, branch `v22/org-ui-a` (from `release/v2.2` at 8400770). Spec: `ORGMODE-SPEC.md`, "U. Screens", UI-A items 1 to 4. No engine file touched.

## Commits

1. `cdbf387` the logo bug (its own commit, usable alone).
2. `cec37b7` `takeoverPreviewOf` and its test.
3. `ab96ad1` the door, the pick, the arrival splash, the copy.
4. `0b8160b` polish from the browser pass.
5. this handoff and DESIGN-DECISIONS #187 to #189.

## 4. The logo bug (root cause and fix)

A takeover writes a procedural crest into `identity.crestId` (old readers need a crest id), and the HQ squad cards (`hub/SquadBlock`), the Club page, the top bar (a local `realOrgRef ?` patch) and the Saves list drew `identity.crestId` / `meta.crestId` directly with `UserCrest`. So an established org showed a random crest. `OrgMark "user"` was already right.

Fix: one component, `UserOrgMark` (in `components/career/OrgMark.tsx`), with the rule in a pure `userMarkOf(identity)`: `realOrgRef` set means the real logo (`TeamLogo`, era of the career season), else the crest. `OrgMark orgRef="user"` now delegates to it; SquadBlock, ClubScreen, CareerTopBar and SavesScreen call it. Standings, events, news and the market already go through `OrgMark` with `"user"`. No share card draws the player's crest (searched).

Saves list: `CareerSlotMeta` lives in `engine/career/types.ts` (an engine file), so it is not edited. `slotMetaFor` (store) now returns `CareerSlotView = CareerSlotMeta & { realOrgRef?, seasonIndex }`. The meta is derived at render from the saves in memory and never persisted, so `persistContract.test.ts` is untouched and green.

Test: `components/career/userOrgMark.test.ts` renders both cases and scans every `.tsx` under `src/components` and `src/app` for `identity.crestId`, `meta.crestId` or `<UserCrest` outside an allow-list (the crest builder, its splash, the dispatcher, the door's art).

## The dossier's data: `src/store/takeoverPreview.ts`

`takeoverPreviewOf(input, seed)` runs `createCareerSave` and reads the save through `takeoverViewOf(save)`: stature, the three plans (objective, `chanceBandOf` band, budget = grant, bonus, hit, miss), the proposed plan (`expected`), the secondary objective, the brief (when `board.season.brief` exists), confidence, cash, weekly wages (squad + coach, `weeklyWageBill`), the wage ceiling (`board.wageRoom`), installations owned (`finances.gear`), staff retained (`finances.staff` if the ENGINE front puts it there, else `finances.gear.staff`, plus the psychologist), coach, starters, reserve. Every optional field falls back, and an rc.5 save (no board, no staff, no brief) reads (tested).

The pick builds one input with `takeoverInputOf(choice, difficulty, managerName)` for the preview and for `createCareer`, with the same seed, so the save is the preview. The preview uses a default manager name; the button uses the typed one. No rule reads the manager's name (checked by the test comparing objectives, cash and starters).

Cost: one `createCareerSave` per selection (world build included), about 100 to 150 ms in the test runner; it is memoized on org, difficulty and seed.

## 1. The door (`components/career/takeover/WayInDoor.tsx`)

Two solids side by side (stacked under 640 px), each a button: found a club on blue, take over an organization on orange. Each has a picture window (the card's dark stock cut into the solid), then the title, one sentence, three facts as label / value rows under hairlines, and the action set as the solid's inverse. Found's window shows the crest builder's own crests in three stages (bare shield, with its symbol, finished with band and tag). Takeover's window shows the current logos of the two most storied organizations of EU, NA and SAM among the first season's lineups (Vitality, Dignitas, NRG, Spacestation, FURIA, True Neutral with today's data). Why: Miguel asked for "dois cards lado a lado, bonitos"; DESIGN.md allows solids for things the player enters, so the door reads like the Home's mode cards. Deviation recorded as DESIGN-DECISIONS #187.

With every slot taken, a notice with a link to Careers sits under the title and both doors are disabled.

Wiring in `WizardScreen`: the door when `FEATURES.realOrgStart` (unchanged when off: straight into the founding wizard); the founding wizard's step 1 now has Back to the door; the Pro door (`ProDoor compact`) is not shown on step 1 when the takeover is on (it still is when off; `/career/pro/new` and the Saves screen's Pro card are untouched). A linked quick start (`?start=quick`) now passes the door (it used to stay on it).

Saves: with the takeover on, an empty slot reads "New career / Found a club or take over an organization" (it said "Found a new org").

## 2. The pick (`components/career/takeover/TakeoverPick.tsx`, replaces `board/TakeoverWizard.tsx`, deleted)

- Title slab and one line. Region tabs (underlined, `role="tablist"`), only for regions with an organization to take over (APAC and SSA have none in the first season, so they are not shown). The default region follows the browser's locale (pt-BR opens on SAM), else EU.
- The list: one board of rows per tier (Elite, Contender, Mid-table, Underdog), the tier's name and its one line above. Row: real logo, name, regional rank, the squad's rating as the figure. `role="radiogroup"` with `role="radio"` rows, roving tabindex, arrow keys move the pick. Chosen row: tint plus the orange inset rule (DESIGN-DECISIONS #188). Under four orgs, a line says how many there are (MENA has one).
- The dossier: logo, name, tier, region, rank, the tier's line; the roster as the HQ's own squad cards (`SquadCard`, now exported from `hub/SquadBlock.tsx`; a card with no `onOpen` is a plain face), wearing the real logo; the coach as one row or "No coach under contract"; what you inherit (cash and the expected plan's budget as figures, weekly wages against the ceiling as a meter, installations and staff as rows); what the board expects (the proposed objective as the sentence, its band in words, confidence if missed / met and the bonus as a figure trio, the grace line, the secondary objective, the brief when present); difficulty and manager name.
- Desktop (lg, 1024 px and up): list left, dossier right; the action bar (Back, "Take over {org}") sticks to the bottom of the dossier column. Under lg: the list is a step; a tap opens the dossier as the next step (title hidden, "All organizations" on top), with Back and "Take over" docked (`.action-dock`).
- The region's first organization is selected until the player picks, so the desktop dossier is never empty.

## 3. The arrival (`components/career/takeover/ArrivalSplash.tsx`)

Portal on `<body>`, full screen: the real logo, "First day at the club", "{manager}, manager of {org}", the board's first ask (the brief if the save has one, then the proposed objective and its band), the starters as squad cards, one action "Go to HQ" (sticky at the bottom on a phone). It waits for the player (the founding splash auto-closes; the takeover's day one has the board's plan waiting).

## Copy

New top-level group `takeover` in `copy.career.en.ts` and `copy.career.pt.ts`: `door` (title, kicker, found / takeover with title, body, facts, action, slotsFull, openSaves, savesHint), `pick` (title, kicker, regions, orgs, tierCount, rank, rating, empty, fewOrgs, none, back, allOrgs, go, goShort, loading), `dossier` (...), `splash` (kicker, title, ask, askLine, squad, action). `board.door` and `board.pick` are no longer read by any screen; they are left in place (the ENGINE front owns `board`), and can be deleted at integration. Reused: `board.stature`, `board.statureNote`, `board.bandWord`, `board.secondaryLabel`, `goals.season` (via `goalText`), `finances.gear`, `finances.staff`, `finances.psychologist`, `wizard.presets`.

## What I checked in the browser (dev server, all staging flags on)

- Door: 1280 (PT and EN), 375 (PT), with free slots and with all three slots full (notice, doors disabled). Not opened: 320 for the door, 375 in EN.
- Pick: 1280 (PT on SAM, EN on NA, MENA with one org, OCE), 375 (PT: list, then FURIA's dossier), 320 (EN: list, Spacestation's dossier). No sideways scroll at 320 or 375 after the fix (`scrollWidth` 320 / 375). Keyboard: focus on the chosen row, ArrowDown moved the pick and the focus (checked). An org with no coach: Sandrock Gaming and Team Envy (the row reads). A long name: "Spacestation Gaming" at 320 (wraps on words; the list row truncates).
- Arrival: 375 (PT, FURIA), 1280 (EN, Team Envy). Then HQ: the squad cards and the top bar show FURIA's logo; Club and Saves show the real logos (three takeovers in the Saves list).
- Not checked: the arrival at 320; the founding path's new Back button in the browser (code only); with `FEATURES.realOrgStart` off in the browser (covered by code and `careerBoard.flagOff.test.ts`); a save from before rc.5; the brief (no save carries one until the ENGINE front lands).

## Tests

Typecheck clean; lint: no new warnings. Full suite once (heavy-lock held): 247 files passed, 40 skipped; 3209 tests passed, 62 skipped.

## For the ENGINE front / the integrator

- The brief: the screens render `board.season.brief` only when the copy has a line for its kind under `C.board.brief[kind]` (a string, or a function of the brief object): `components/career/takeover/briefLine.ts`. If the ENGINE front's copy has another shape, wire it there (one function).
- Retained staff: read from `save.finances.staff` or `save.finances.gear.staff` (either works).
- The door's phone layout: the second door's title shows in the first screen at 375 x 812, its action needs a scroll.
- `board.door` / `board.pick` copy keys are dead after this branch.
