# v2.2 rc.6: the established-org mode (spec)

Integrator's spec, 27/11/2026, from Miguel's brief of that night. Target: `2.2.0-rc.6` on staging. The Pro stays out of this patch.

## Miguel's brief (PT, his words, condensed)

- "Ao clicar na carreira, devemos ter a opção de criar uma org nova ou escolher uma org existente, em dois cards lado a lado, bonitos."
- "Cada org deve ter suas metas por temporada, seu orçamento." "Os objetivos devem fazer sentido por season."
- "O sistema de reputação deve ser repensado, hoje ele só faz sentido no modo normal." "Os desbloqueios de progressão devem ser diferentes, afinal já estamos lidando com uma org consolidada."
- "O desafio deve ser mais em gerenciar o time, os treinamentos, o orçamento (bootcamps, psicóloga, coach, outros elementos novos de progressão que façam sentido com contratos)."
- "Todas as telas novas desse modo estão muito ruins, muito simples, feitas de qualquer jeito. O jogo não é assim: todas as telas são bonitas, bem pensadas, com boa hierarquia."
- "Ao escolher uma org, o logo não aparece nas cartas do elenco, aparece um logo aleatório."
- "Não é uma org zerada. É uma org consolidada, e o modo deve retratar isso."

## The two modes

| | Found a club (today's Road to Worlds) | Take over an org (this spec) |
|---|---|---|
| Start | Nothing: amateur scene, a founding roster | A real roster under contract, a coach, facilities, a budget, a board |
| The number that grows | Reputation, which opens the ladder | Standing (the org's tier in the scene) and the manager's own reputation |
| What is locked | Gear, staff, sponsors, signings, by reputation | Nothing by reputation. Money, the wage ceiling and the board's sign-off decide |
| The challenge | Growing | The board's season plan, the budget, the squad, the job |

**Predicate:** an org is *established* when `save.identity.realOrgRef` is set (a takeover or an accepted job offer). One helper, `establishedOf(save)`, in a new pure module `src/engine/career/established.ts`; every rule below reads it. A founded club (`board.kind === "owners"`) keeps today's rules untouched. With `FEATURES.realOrgStart` off nothing changes (the flag-off test must stay green).

## E. Engine rules (front ENGINE)

### E1. Standing replaces the reputation ladder

- `save.reputation` stays the engine's number. In an established org it is shown as **Standing** (PT "Prestígio"), on a four-tier track: Underdog, Mid-table, Contender, Elite. Starting values stay 14 / 24 / 36 / 50 (`CAREER_BOARD.profiles.*.rep`), so the sponsor tier, the fanbase income and the loan size start where rc.5 measured them.
- **Nothing is locked behind reputation in an established org.** Audit every read of `save.reputation` and every rep gate (`CAREER_UNLOCKS`, `CAREER_LADDER`, `CAREER_GEAR.*.repGate`, `psychologistRep`, `CAREER_STAFF.roles.*.repGate`, `coachHireRefusalFor`, invitational and contracted gates, relocation) and list each in the handoff as *scales* (kept) or *gate* (opened for established orgs). Standing may scale things (sponsor tier, coach quality cap, loan size); it never shows a lock.
- **Signing pull comes from the tier, not the formula:** `signableOverallCap` for an established org reads `CAREER_BOARD.profiles.*.signCap`: underdog 86, mid 90, contender 95, elite 99. (Today an underdog on reputation 14 cannot sign anyone above 76 while its own starters are 79 to 85.)
- **The tier can change (the mode's long progression).** At the season review, after the verdict: `board.stature` is re-read from the standing with `CAREER_BOARD.standing = { mid: 20, contender: 32, elite: 45, hysteresis: 3 }` (promote at or above the line, relegate under the line minus the hysteresis), one step a season at most, never in the takeover season. On a change: patience, expectations and the calibration cell follow the new tier; `grantBase` and `wageRoom` step by `standing.budgetStep` (up 1.2, down 0.9); confidence +5 on a promotion; a board mail, a news line and a line on the season review. Measure how long a competent bot takes per starting tier and tune the lines so a good mid-table club reaches Contender in about two or three seasons. A job-offer move reads the new org's own tier as today.

### E2. Operations replace the unlock ladder

- **Everything is on the shelf from day one:** installations, both bootcamp tiers, the psychologist, the four staff roles, every coach type. Price and upkeep are unchanged.
- **The org arrives with a structure** (`CAREER_BOARD.profiles.*`): installations as today (elite 3, contender 2, mid 1, underdog 0) and retained staff: elite analyst + psychologist, contender analyst, mid assistant, underdog none. Retainers are a cost the manager may cut. Starting cash is unchanged (the retainers come out of it).
- **The board signs off capital projects.** Buying an installation needs confidence at or above `CAREER_BOARD.approval.capital` (50); the performance centre needs `approval.flagship` (65). Never during a hiring freeze. Staff, coaches and bootcamps are the manager's call: money only. The refusal is a typed reason the UI can show ("the board will not fund this while its confidence is under 50").
- A pure view for the UI: `operationsOf(save)` in `established.ts`, three departments (facilities, staff, camps), each item with `state: "owned" | "retained" | "available" | "needsApproval" | "frozen" | "cantAfford"`, its price, its upkeep, its effect key, and the confidence it needs.

### E3. The budget is the org's, and it is a plan

- The season budget no longer follows the current wage bill. It is `board.grantBase` (fixed at the takeover: the tier's weeks of the inherited bill, as today) × the money index ratio × `budgetMult` × the plan's `grantMult`. Cutting wages no longer cuts next season's budget, and raising them no longer raises it. The wage ceiling stays.
- A pure view: `seasonBudgetOf(save)` in a new `src/engine/career/budget.ts`:
  - `allocation` (the board's money this season: budget + upfront), `bonusAtStake`;
  - `committed` for the rest of the season by line: squad wages, coach, staff retainers, upkeep, loan;
  - `spent` so far by line (from the ledger kinds): wages, staff, facilities, camps, transfers, other;
  - `income` so far and still contracted: sponsor, prizes, fanbase, sales;
  - `free` = balance + contracted income still to come − committed; `projectedEnd`; `wageBill`, `wageCeiling`, `overCeiling`;
  - `weeksCovered`.
  No new money rule: this is a reading of the books the screens can draw. If the founded club's Finances already compute a line, reuse that function.

### E4. Season objectives that read as that org's season

- The three plans stay (cautious, expected, ambitious), with their measured chances and bands (R154). What changes is which goal each plan picks:
  - a tier prefers its own competitions (`CAREER_BOARD.objectiveKinds`): elite: Major and Worlds finishes and Worlds qualification; contender: Major qualification and finishes, Worlds qualification, winning a regional; mid: Major qualification and regional finishes; underdog: regional finishes and main-event appearances, a Major qualification as the ambitious plan;
  - an established org is never asked for a local cup, and never for a count above `objectiveMaxCount` (5) of regionals;
  - a preferred goal wins when its chance is within 0.15 of the plan's aim, else the nearest of the rest;
  - the three plans are three different goals, in order of difficulty (test it across every org of NA, EU and SAM on seasons 0 to 2).
- **The season brief** (`board.season.brief`, optional and additive): why the board asks this, from last season: `takeover`, `met`, `missed`, `title`, `promoted`, `relegated`, `ultimatumSurvived`, with the facts the copy needs (last objective, last regional rank or best finish). EN and PT strings, one or two sentences each, broadcast-desk tone.
- Goal copy shows the total where a count needs it ("top 4 in 3 of the 9 regionals"): add what `C.goals.season` needs, without changing the founded mode's strings.

### E5. What the pick screen needs

`RealOrgChoice` gains (all optional-safe): `gear: string[]`, `staff: string[]`, `signCap`, `sponsorLevel`, `standing`, `confidenceStart`. And a store-level pure helper `takeoverPreviewOf(input, seed)` that builds the same save `createCareer` would and returns the three plans, the secondary objective and the budget, so the screen shows the board's real first-season ask for the selected org (it is called for one org at a time, on selection).

### E6. Guard rails

- Save shape: additive and optional only; persist version 3 and saveVersion 5 stay; an rc.5 takeover save must load and play (no staff field, no brief). `persistContract.test.ts` untouched.
- Every number in `src/config/balance.ts`; every string in `copy.career.en.ts` and `copy.career.pt.ts`.
- Tests: the unit tests of each rule, `careerBoard.flagOff.test.ts` green, then with every staging flag on: `P1_SOFT=1` (SAM, NA, 7 seasons) and `BOARD_SOFT=1`, each alone, nothing else running.
- Measure, do not guess: a `BOARD_PROBE` run on the competent bot (Normal and Hard, the four tiers) before and after; report objectives met, dismissals, cash at season 6 and tier changes. Do not refit `goalRates` (the integrator decides after the screens are in).

## U. Screens (fronts UI-A, UI-B, UI-C)

Read `DESIGN.md` first. The bar is the rest of the game: open the founding wizard, the founding splash, the HQ, Finances and the Home in a browser and match their finish. One focal point per screen; figures set as figures; rows on a phone; a card next to the panel must look like it belongs. Every string in the career copy files, EN and PT. Check 1280, 375 and 320 px in a browser, both languages, and attach screenshots to the handoff.

### UI-A: the way in

1. **The door** (`/career/new`, first step): two cards side by side (stacked under 640 px): "Found a club" and "Take over an organization". Each is a thing the player enters: an art area (found: a crest being built; takeover: real org logos of the main regions), the title, one sentence, three facts set as figure rows (what you start with, what you chase, where the difficulty is), and its action. No Pro door on this screen (the Pro is the next patch; `/career/pro/new` stays reachable by address on staging).
2. **The pick** (replaces `TakeoverWizard`): region tabs; the region's orgs grouped by tier with the real logo, the squad's rating and rank. Desktop: the list on the left, the selected org's dossier on the right. Phone: the list, then the dossier as its own step with the action docked. The dossier: logo, name, tier; the three starters as the game's own player cards and the coach; "what you inherit" (cash, season budget, weekly wages against the ceiling as a meter, installations owned, staff retained); "what the board expects" (the expected plan's objective with its band in words, what a miss costs, the season of grace); difficulty; manager name; one filled action.
3. **The arrival splash** (the takeover's `FoundingSplash`): the real logo, "{manager}, manager of {org}", the board's first brief, the squad's cards, one action to the HQ.
4. **The logo bug:** wherever the user's own org mark renders (squad card tiles, `hub/SquadBlock`, `ClubScreen`, `SavesScreen`, the top bar, standings, events, the share card), an established org shows its real logo. One component or helper, not a patch per screen; a test that lists the call sites is welcome.

### UI-B: the board

1. **The season plan** (the pending package choice, on the HQ decision block and the Board page): three plans as cards (rows on a phone), the board's proposal marked and preselected; each shows the objective as a sentence, its band, the budget, the bonus, and what meeting or missing it does to confidence. One filled action.
2. **`/career/board`**: the season brief; the objective as the focal object with its progress and "then / now" bands; secondary and legacy objectives; an active ultimatum as its own orange-hairline board; confidence as a large figure with a labelled meter and its log; the standing track with the next tier's line; the manager (contract through, reputation, clubs managed); a budget strip that opens Finances.
3. **HQ:** the board's figure (confidence and objective progress) among the phone figures and as a desktop block. **Season review:** the verdict, a tier change, the dismissal with its offers (org rows with logo, tier, region, rank; "found a club"), an approach. The founded club's owners use the same pieces.

### UI-C: money and operations

1. **Finances, established org:** the season budget as the first block: the allocation as one bar split into spent, committed and free; the lines by department; the projection for the season's end; the wage bill against the ceiling. Then the existing ledger.
2. **Club, established org:** the standing track where the founded club shows the reputation ladder; operations by department (facilities, staff, camps) from `operationsOf`, each item with its state, price, upkeep, effect and, when the board must sign, the confidence it needs.

## Process

- One front at a time, each in its own worktree and branch from `release/v2.2`; the integrator merges. Nothing goes to `main`.
- Each front ends with: tests and typecheck green, a handoff in `docs/handoff-2.2/` (what was built, numbers measured, what was not verified), a commit on its branch. No push.
- One heavy job at a time on this machine (a probe, the full suite, a build, a dev server): never two together.
