# Road to Worlds — current state

> Updated **2026-11-27**. Production **v2.0.36**; **2.2.0-rc.6** on staging (`release/v2.2`).
> Decisions R1–R172. BALANCE_VERSION **52**. Gate: V2.2-STATUS.md. Feedback: CAREER-FEEDBACK-rc42.md.

## v2.2 (staging only, each front behind its own flag)

**Real organisations and the board** (`realOrgStart`, `board`; R151–R154, R163–R172). `/career/new` opens on two doors: found a club, or take over a real org. An established org (`establishedOf`: `identity.realOrgRef` set) has its own rules: the reputation number is its Standing on four tiers (underdog, mid, contender, elite), nothing is locked behind it, the tier sets the signing cap and changes at the season review (promotion needs the line and the objective met); installations, staff and camps are all on the shelf (Operations), with the board's sign-off for capital projects; the org arrives with its tier's structure and a sponsor desk on day one; the season budget is fixed at the takeover, covers the season's committed costs, and is read as a plan (`seasonBudgetOf`). Each season the board offers three plans with objectives picked for the tier and a brief; confidence moves with a logged reason, then warning, ultimatum and dismissal at a review. Dismissal never ends the save. Stated chances are bands in words, refitted on the rc.6 rules (same band 69 %). Permanent achievements are not earned in an established org (R171, Miguel decides). A founded club keeps the ladder and every earlier rule.

**Endless variety** (`endlessVariety`, from season index 7; R155–R156). Drawn cups, a Legends Invitational, an Intercontinental, season hosts. Rival projects use the user's own toolbox and scale with the dynasty; elite promotions arrive stronger; a project may bid for the user's best starter. Worlds won by a 100+ team: 91 % to 64 %; the target of 3 AI sides within 3 points is missed (2.2 to 2.7). Per-season circuit formats are not built.

**Event formats** (`eventFormats`; R-FMT, branch `v22/event-formats`, not on staging yet; spec handoff-2.2/FORMATS-SPEC.md). Majors and Worlds take each season's RLCS shape (`CAREER_EVENT_LAYOUTS`: Swiss, groups of 4, double-elimination groups of 8, the 16-team double elimination; top-8 / 12 knockouts and 8 / 12 hybrids); 2027+ rotates through the six rows; Season X's Worlds stays cancelled. Same points and prize total per event. Engine `engine/eventLayouts.ts` and the career-only brackets in `playoffs.ts`. Probe `EVENT_FORMATS_PROBE=1`; screen fixtures `EF_FIX=1`. Title odds per shape not measured.

**Pro, the player career** (`proCareer`; R157–R161; spec PRO-SPEC.md, §15 is its state). Own save `rocket-draft:pro:v1`; the world runs on a hidden host save, not `worldTick.ts`. Week, ranked, one decision a game, offers, rotation, aging, gala, nicknames, a shareable card. Peaks: average managed 92.1, high 97.2, careless 82.2. Out of band: Worlds played in 92 % of average careers. The board is inert on the host (R162).

After any career engine or store change run the soft-lock probe (`P1_SOFT=1`) and the Pro probe (`PRO_CAREER=1`) with every staging flag on together, each alone.

## Earlier

rc.42 and before (cards, Club, Finances, Inbox, calendar, title ledger): CHANGELOG and CAREER-FEEDBACK-rc42.md. rc.43–rc.50 (R113–R132): mid-career retune, coaches, elite pricing, staff retainers, the season-3 soft lock fix. v2.0.27 (R135): transfer list and player-for-player trades (`engine/career/transferList.ts`, `SELLTRADE_PROBE=1`). v2.1 (R139–R149): Mundo vivo M1, M2.1, M3 (`worldLife`), Matchday, the Etapa 1 gate (ETAPA-1-STATUS.md). v2.2.0-dev.1 (R150): Pro slice 1.

## System map

| System | Engine → flow → screen |
|---|---|
| Calendar/weekend | calendar/sunday → careerFlow/careerSunday/careerDecisions → Calendar, SundayCard, Event |
| Fields/results/titles | worldSim/careerResults/honors → careerFlow → Event, Standings, CareerHonorsTable |
| Training/coaches | development/training → careerTraining → Training, TrainingBlock |
| Money/contracts | economy/sponsorDeals/market → careerFlow/careerHq → Finances, Market, Toolbox |
| Selling/trading | transferList/market → careerFlow (R135 section)/careerDecisions → Market (My Deals), ListPlayerSheet, TradeSheet, Squad |
| News/identity | communications/names → careerNew/careerFlow → NewsFeed, Inbox, Wizard/UserCrest |
| Cloud save / files (2.0.26) | lib/careerCloud, lib/careerSaveFile → careerCloudStore, careerSaveTransfer → Saves, components/career/cloud |
| Board / real orgs (v2.2) | orgProfile/seatSwap/board/boardTypes/manager/reputation, established (standing, operations, sign-off, signing cap), budget (`seasonBudgetOf`) → store/boardFlow, takeoverPreview → components/career/takeover (WayInDoor, TakeoverPick, ArrivalSplash), board (BoardScreen, BoardParts, StandingTrack, briefLines), finances (SeasonBudget, Operations), hub/OperationsBlock, `/career/board` |
| Endless variety (v2.2) | engine/career/endless (`CAREER_ENDLESS`) → store/endlessFlow (news through communications) → OrgSheet, OrgMark, EventScreen |
| Pro (v2.2) | engine/career/pro (week, ranked, moments, offers, aging, gala, nickname, card) → store/proFlow, proSeat, proMatch, proGala, proStore → components/career/pro (+ spine), `/career/pro/**` |

## Open and frozen contracts

Gate 3b pacing/affordability and Miguel's playtest acceptance remain open (ROADMAP-NEXT-2026-11-05.md). Persist version **3**, saveVersion **5**, unchanged; the Pro has its own key and the boards, endless and Pro fields are additive. Permanent achievements survive save/season resets. The Pro has no account copy yet. Organization relocation as a player action, T1 and PvP remain deferred.
