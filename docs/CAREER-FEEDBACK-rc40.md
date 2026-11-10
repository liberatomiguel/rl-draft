# Road to Worlds — rc.40

Miguel's 19-item feedback, 10 November 2026. Based on staging rc.39.1.

| Request | Result |
|---|---|
| 1 | Consistent opaque patterns, corrected ring field, narrower sash, clearer wolf, eight editable club-inspired combinations, revised kits/defaults, custom third field colour and primary/secondary emblem choice. Legible letter plate and improved band spacing. |
| 2 | HQ progression contains direct purchases only, including its expanded ladder. New purchase dot; coach unlock mail points to Coaches, which has its own unread dot. Sponsor mail points to Finances. |
| 3 | Left/easy/light green, middle/even/normal blue, right/hard/heavy orange; None has an explicit selected outline and background. |
| 4 | HQ and Inbox import the same mail glyphs and category colours. |
| 5 | Club and Profile share the achievement card and tier styles, with 15 distinct career glyphs. |
| 6 | Compact transfer wire below Inbox, initially three moves. |
| 7 | Loans always expanded below Movements in its narrower column; Weekly Statement moves into the old projection slot, keeping Monday/split projections and runway. |
| 8 | Ordinary credit and spend warnings arrive by mail, never interrupting the clock. Existing quotes remain accepted by the legacy API without reopening popups. Shared visual amount/repayment/term tiles; emergency notices prioritize deadline, repayment and career-ending consequence, with secondary terms expandable. |
| 9 | A direct regional seed with a coach gets the same Saturday-evening briefing as a qualifier winner. Reload keeps the choice; an old save already on Sunday answers without moving its date. Coachless direct entries keep their usual schedule. |
| 10 | Trophy room above Records in the larger left column; progression uses the smaller right column. |
| 11 | Attribute explanations use individual panels, current-value bars and clear effect/context lines. |
| 12 | HQ scrim results include weekly average overall growth, chemistry change and the best improver, measured from a saved weekly baseline. |
| 13 | Incoming bids and sponsor choices hold immediately until accepted or declined. Old parked IDs cannot bypass the hold. Sponsorship prompt now includes Decline. |
| 14 | Community-cup Pass sits beside Continue. |
| 15 | Complete pre-event prize/points table uses the settlement engine's actual format, season and difficulty. |
| 16 | Club's Organizations/Players title tables start from the real pre-X cutoff, then append simulated Major/Worlds winners with frozen rosters. Sources: CAREER-HONORS-SOURCES.md. |
| 17 | 50/50 art on its tournament/invitation, supplied Duds avatar, DudsMelow invitation copy, and Duds Cup Invitational added without removing other events. |
| 18 | Under-contract market and signing flow unlock at reputation 20; the overall cap still applies afterward. |
| 19 | My Deals includes the current squad player's overall and weekly wage. |

No production/account/hosting changes. Save keys and versions unchanged;
third colour, weekly baseline and title ledger are additive optional fields.
BALANCE_VERSION 18 covers the contracted-player gate and immediate-answer rule.

Validation: 2,137 tests passed, 31 optional audits skipped, across 171 files (four workers; run without a concurrent build). Lint and TypeScript passed. Static staging export passed: 2,016 files, 51.02 MB, all 1,074 manifest URLs present; career ON, noindex, accounts/analytics DISABLED. Browser review covered wizard, HQ, Club, Finances and Training; 320 px Training/Club/Finances had no horizontal page overflow. New flow regressions also cover an old save already on Sunday without moving its date. Local preview server stopped after review. No new Lighthouse/performance score or multi-season balance battery is claimed.
