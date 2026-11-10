# Road to Worlds — rc.42

Card composition revision, 10 November 2026, based on staging rc.41.

| Request | Result |
|---|---|
| Chasing History | Standard kicker, quiet rows/counts and two independent filters: Organization/Player and Major/Worlds. HQ keeps three leaders and a fixed user-club line; the complete table is in Standings, linked to its history anchor. Explicit empty state before any titles in a competition. |
| Club | Identity banner uses only the left-column width, above trophies/Records. Reputation starts at the right top; Records and Progression stretch to the same lower baseline. |
| Rewards | Shared house icons for trophy, cash and points; numbered placement marks, restrained champion highlight. Field and reward/seed columns stretch together and end at the same baseline. |
| 50/50 | Shared partner mark capped at 40 × 40, above the invitation/event heading, matching Duds. Aspect ratio retained with object-contain. |
| Finance summary | Three equal-height cards: cash/chart/runway/debt; weekly statement/net/payday; Monday forecast/income/outgoings/split projection. Removed repeated net total. Chart is bounded to 96px and fits the recorded balance range; the full chart remains accessible. Long statement detail scrolls within its card. |
| Loans | Always visible below Progression in the left column, at its width. Sponsors and Movements stay on the right; the last cards align at the bottom. |

R112 records this display composition. BALANCE_VERSION 19, save keys,
versions and game rules unchanged. No asset or manifest replacements.

## Automated verification

Full Vitest suite: **2,139 passed, 31 skipped** (153 files passed), two workers.
ESLint and TypeScript passed. Existing engine/honors/payout/persist regressions
remain green. Static staging export passed: **2,017 files / 51.01 MB**, all
**1,074** manifest image URLs present; career ON, noindex,
accounts/analytics DISABLED. Generated asset manifest unchanged.

## Visual verification

Reviewed HQ summary, full Standings history and both independent filters,
Club, Finance and the live community-cup lobby in the browser. Measured equal
bottom edges for Club Records/Progression, all three finance tiles,
Loans/Movements, and event Field/Rewards. The finance preview includes real
recorded Mondays after advancing the isolated QA career to its first cup.

At 320 px, Club, Finance, event lobby and the full history fit without page
overflow. At 768 px the three finance cards fit and keep equal heights;
the existing global desktop header remains outside this revision's scope.
Screenshots: hq-history-rc42.jpg, history-rc42.jpg, club-rc42.jpg,
finances-rc42.jpg and rewards-rc42.jpg. Temporary browser tab closed and
development server stopped. No new Lighthouse score or balance battery claimed.
