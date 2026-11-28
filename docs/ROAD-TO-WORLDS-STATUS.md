# Road to Worlds — current state

> Updated **2026-11-28**. Production **v2.0.36**; staging candidate
> **2.1.0-rc.9** (branch `rc9/ui`). Decisions R1–R259 (rc.9 used R211–R259,
> some numbers unused). BALANCE_VERSION **58**. rc.9 handoffs:
> `docs/handoff-rc9/`. Earlier gates: V2.2-STATUS.md, V2.3-STATUS.md.

## On staging, each behind its staging-only flag

**Real organisations and the board** (`realOrgStart`, `board`; R151–R180,
R220–R226). Two doors on `/career/new`: found a club, or take over a real org
in RLCS 2027 (`clock.seasonIndex` is the era, `startSeasonIndex` where the save
began). An established org has its Standing (four tiers), the board's mandate
of three goals each season (`engine/career/mandate.ts`), confidence with
reasons, dismissal without ending the save, and since rc.9 its own catalogue
(`orgCatalogue.ts`: facility levels, departments with people, the event camp),
each mapped onto an existing effect (balance unchanged). A founded club keeps
the ladder and the three plans.

**Locker room** (`lockerRoom`; R211–R219, rc.9). Each Monday morale moves 30 %
toward a target set by results against expectation, box-score form against
teammates and training load; bench, promises and the market stay one-off
shocks. The shown mood is held 3 points past a bound. Four player requests
through the talk machinery. A bounded match effect by mood (per player −1.5 to
+0.25, team mean clamped −1 / +0.25), never written to a rating. Screens read
`lockerRoomView.ts` (mood, trend, reason). STORIES adds the reason
`managerPost`.

**Media days, fan feed, the manager's post** (`mediaDays`, `fanFeed`;
R253–R257). The post is offered only after a big moment, at least 21 days
apart, as an HQ decision; tone moves followers, morale and board confidence.

**Matchday** (`matchdayStyles`, `matchdayDecisions`, `matchdayBoxScore`;
R240–R247). The series room: plan (approach, risk, shut down), live games,
the end; one optional timeout when the opponent has momentum.

**Endless variety and the end game** (`endlessVariety`, `worldLife`;
R155–R156, R230–R235). From season index 7 drawn cups and invitationals; from
season 8 late rival projects (a 100+ team wins 35 % of Worlds, was 23 %).
Coaches retire between 28 and 35 from the first rollover.

**Event formats** (`eventFormats`, R210). Majors and Worlds take each season's
RLCS shape; same points and prize total per event.

**Pro, the player career** (`proCareer`; R157–R161; PRO-SPEC.md §15). Own
save `rocket-draft:pro:v1`. Miguel: **does not ship in 2.1**.

## Probes (each alone, every staging flag on)

Soft lock founded `P1_SOFT=1`; takeover `P1_SOFT=1 P1_SOFT_ERA=6
P1_SOFT_REGIONS=NA,EU,SAM P1_SOFT_SEASONS=4`
(`store/careerSoftlock.probe.test.ts`); Pro `PRO_CAREER=1`
(`store/proCareer.probe.test.ts`). rc.9 integration run (28/11, all twelve
staging flags on): founded passed with no finding (675 s); takeover 6 careers
(NA, EU, SAM x autopilot, tuned; 4 seasons, 89 to 94 lobbies each), 0
findings; Pro 4 runs (NA, EU, SAM Normal, NA Hard), no problem (315 s).

## Open

- LOCKER (Miguel): the positive match effect at +0.25 (brief +1.0), the Hard
  dynasty lean, "more load" asks about 3 a season.
- STORIES (Miguel): about one post offer a season for clubs that win nothing
  (aim was 3 to 6); effect sizes (R256).
- ORG (Miguel): the inherited deal's profile per tier; the signing cap as the
  standing's one figure.
- Not measured: title odds per event format; a balance battery for the
  matchday mark (−0.08); the locker room's effect on title odds beyond the
  LOCKER probe; the board's stated chances hold within one band only.
- Pro: Worlds played in 92 % of average careers (spec about 40 %).

## System map

| System | Engine → flow → screen |
|---|---|
| Calendar/weekend | calendar/sunday → careerFlow/careerSunday/careerDecisions → Calendar, SundayCard, Event |
| Series/matchday | matchday/matchdaySeries/matchTimeline → careerFlow (MATCHDAY blocks) → event/SeriesRoom, match/LiveGameView |
| Fields/results/titles | worldSim/careerResults/honors/eventLayouts → careerFlow → Event, Standings |
| Training/coaches | development/training → careerTraining → Training |
| Money/market | economy/sponsorDeals/market/transferList → careerFlow/careerHq → Finances, Market, MoneyNoticeModal, TradeSheet |
| Locker room | lockerRoom/lockerRoomFacts/lockerRoomView → lockerRoomFlow → locker/*, Squad |
| Feed/media | fanFeed/mediaDays → fanFeedFlow/mediaDaysFlow → feed/*, News (Fans) |
| Board / real orgs | era/board/mandate/orgCatalogue/established → boardFlow/orgFlow/takeoverPreview → takeover/*, board/*, finances/* |
| Endless / Pro | endless → endlessFlow → EventScreen; career/pro/* → proFlow/proStore → career/pro/* |

## Contracts

Persist version 3, saveVersion 5, unchanged; every rc.9 save field is
optional and additive; flag off writes nothing. The Pro has its own key and
no account copy.
