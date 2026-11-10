# Road to Worlds — current state

> Updated **2026-11-10**. Candidate **v2.0.0-rc.41**, staging.
> Decisions R1–R111. BALANCE_VERSION **19**. Feedback: CAREER-FEEDBACK-rc41.md.

## Current candidate

rc.41 revises Miguel's feedback over rc.40. The crest builder uses manual
shape/pattern/emblem combinations, two-colour kits and a conditional third
colour picker. Patterns are inset; the striped, curved-band and diagonal
fields and emblem silhouettes are revised. Existing IDs remain valid.
Region cards show relative difficulty. HQ limits progression to direct purchases, shares Inbox
glyphs and moves the compact transfer wire below Inbox. Coach unlock emails
point to Coaches and its unread dot; direct purchases retain novelty markers.

Training selections use green/blue/orange and a visible None state; attribute
panels carry current values and context. HQ records weekly overall/chemistry
change for the active cycle beside scrims. Club puts trophies above framed
Records in its larger left column, Reputation above Progression on the right,
and shares Profile achievement cards, with distinct career glyphs.

Net/week contains Weekly Statement; Projected has its own card and Balance
uses a taller chart. Next Season Books uses numeric tiles. Loans stay expanded below Movements. Normal credit/spend
offers arrive by email without popup/calendar hold; emergency notices use
numeric tiles, visible deadline/repayment/risk and expandable secondary terms.

Bids and sponsors require accept or decline before advancing, including old
parked saves. Direct regional seeds with a coach receive the Sunday briefing;
old saves already on Sunday answer without moving the clock. Contracted
signings unlock at reputation 20 and keep the overall cap. My Deals shows
the player's overall and weekly wage. Pass sits beside Continue.

Pre-event tables read the actual prize/points settlement, above the direct-seed
notice. HQ's title ledger sits below Inbox with ranked counts. It
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

## Run and verify

Dev: Home → Road to Worlds → wizard → HQ. Staging uses
NEXT_PUBLIC_CAREER_MODE=1 and NEXT_PUBLIC_NOINDEX=1. Production remains off
until the approved cutover. Final regressions, static-export and browser
evidence are recorded in CAREER-FEEDBACK-rc41.md. This release makes no new
economy/growth/title-pacing claim.

rc.39's F6 balance remains apart from rc.40's explicit gates and rc.41's
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
