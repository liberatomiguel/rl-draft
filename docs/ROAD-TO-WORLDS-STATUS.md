# Road to Worlds — current state

> Updated **2026-11-11**. Candidate **v2.0.0-rc.47**, staging.
> Decisions R1–R129. BALANCE_VERSION **25**. Feedback: CAREER-FEEDBACK-rc42.md.

## Current candidate

rc.42 refines the career cards over rc.41. Crests use manual combinations,
two-colour kits and conditional third colours; existing IDs remain valid.
Region cards show relative difficulty. HQ progression lists direct purchases;
coach unlock emails point to Coaches. Shared Inbox glyphs and novelty markers
remain, with the compact transfer wire below Inbox.

Training selections use green/blue/orange and a visible None state; attribute
panels carry current values and context. HQ records overall/chemistry
change for the active cycle beside scrims. Club puts trophies above framed
Records beneath the identity banner in its larger left column; Reputation
starts above Progression on the right, with aligned column endings. Club
shares Profile achievement cards, with distinct career glyphs.

Weekly Statement contains Net/week; Projected has its own card and Balance
uses a bounded chart fitted to recorded balances. The three tiles share a
baseline; Loans sits beneath left-column Progression. Next Season Books uses numeric tiles. Normal credit/spend
offers arrive by email without popup/calendar hold; emergency notices use
numeric tiles, visible deadline/repayment/risk and expandable secondary terms.

Bids and sponsors require accept/decline. Direct seeds with a coach receive
Sunday briefings, including old saves already on Sunday. Contracted signings
unlock at reputation 20 and keep the overall cap. My Deals includes overall
and wage. Pass sits beside Continue.

Pre-event tables read the actual prize/points settlement, above the direct-seed
notice. Event columns share a baseline; placement, cash and points have icons.
HQ's compact title ledger sits below Inbox, showing three entries and the user
club. The full table is in Standings; both use separate entity/title filters. It
starts with real pre-X Worlds and zero Majors, then stores each simulated
Major/Worlds winner with its playing roster. Transfers/rollovers preserve it.
Legacy saves disclose missing past individual records. Historical sources:
CAREER-HONORS-SOURCES.md. Duds Cup joins the invitational rotation; 50/50 and
Duds events use their supplied art and the Duds Melow invitation copy.

Every open week offers a community/invitational event, forecast in Calendar
and Skip. Spectator Majors/Worlds remain visible and stop Skip on Sunday,
including Worlds at season review. Coaches reduce the training-wear portion
of absence risk by 20%; illness risk stays fixed. Absence notices name the
cause and unavailable player; Market explicitly explains closed windows.

rc.48 (R129, on the branch, not on staging): CAREER_TALENT.elite.gateShare 0, the reputation gate reads the overall alone; the elite price factor stays.
rc.47 (R122–R128): contract-long sponsor goals, database-driven region moves, no Worlds in Season X, headline pop-ups, automatic sponsor bootcamps, contracted players listed below reputation 20, coach contracts with renewal and growth, profile XP from the career, lineup swaps at HQ, the redesigned coach market, sponsor contract, season review, calendar and title race, milestone moments. Engine notes: docs/handoff-2.0/C1.md; screens: G1.md. None of it is measured in a battery.

## Run and verify

Dev: Home → Road to Worlds → wizard → HQ. Staging uses
NEXT_PUBLIC_CAREER_MODE=1 and NEXT_PUBLIC_NOINDEX=1. Production remains off
until the approved cutover. Final regressions, static-export and browser
evidence are recorded in CAREER-FEEDBACK-rc42.md. This release makes no new
economy/growth/title-pacing claim.

rc.46 prices and gates elite talent (CAREER_TALENT.elite; economy.eliteFactorFor, signingLevelOf).
rc.45 adds four support-staff retainers (CAREER_STAFF; economy.staffOn, careerFlow.setStaffFlow,
Finances and the ladder). rc.44 adds the dataset's real coaches to the coach market (market.staffCoachCandidatesFor),
lifts ex-pros, pays the bench 60 % of series XP and slows the squad's decline (R118–R119).
rc.43 retunes the middle of a career (R113–R117): Normal renewals back to ×2.5,
regional +25 %, ordinary loan in a shallow red, chemistry bond 0.20, AI bid premium
for youth and reach. rc.39's F6 balance otherwise remains apart from rc.40's explicit gates and rc.41's
open-week cadence/coach wear modifier (R111). R100–R109 and report
F6-EXPERIMENTOS.md Parts 7–8 remain the pacing evidence. RLCS 2027 lineups enter the
first infinite season. The 4,914-career battery is in docs/battery-rc37.

## System map

| System | Engine → flow → screen |
|---|---|
| Calendar/weekend | calendar/sunday → careerFlow/careerSunday/careerDecisions → Calendar, SundayCard, Event |
| Fields/results/titles | worldSim/careerResults/honors → careerFlow → Event, Standings, CareerHonorsTable |
| Training/coaches | development/training → careerTraining → Training, TrainingBlock |
| Money/contracts | economy/sponsorDeals/market → careerFlow/careerHq → Finances, Market, Toolbox |
| News/identity | communications/names → careerNew/careerFlow → NewsFeed, Inbox, Wizard/UserCrest |

## Open and frozen contracts

Gate 3b pacing/affordability and Miguel's playtest acceptance remain open;
see ROADMAP-NEXT-2026-11-05.md and the rc.37 handoffs. No production deploy.
Persist version **3**, saveVersion **5**, unchanged. New colour/weekly/title
fields are additive. Permanent achievements survive save/season resets.
Organization relocation as a player action, T1 and PvP remain deferred.
