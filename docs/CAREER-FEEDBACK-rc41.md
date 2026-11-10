# Road to Worlds — rc.41

Second feedback revision, 10 November 2026, based on staging rc.40.

| Area | Result |
|---|---|
| Crest | Removed club inspirations. Manual shape/pattern/colour combinations, regular stripes, clean tricolour fields, curved central fifth pattern, reversed sash and inset fields. Removed emblem stroke/shadow artefacts, added Maltese cross and third-colour emblem role. Two-colour kits preserve the third colour (white initially); one red/black pair and restored purple/gold. Third picker appears only when the active emblem/pattern uses it. |
| Regions | EU/NA hard, SAM/MENA/OCE intermediate, APAC/SSA easier, with coloured difficulty bars and EN/PT labels. |
| Club/HQ | Records framed like adjacent cards; Reputation above right-column Progression. Chasing History below HQ Inbox, ranked rows and emphasized title counts. Growth recap reads the active training cycle baseline. |
| Finances | Larger balance chart, Net/week and Weekly Statement combined, separate Projected card. Next Season Books uses four numeric sections instead of long prose. |
| Calendar/Skip | Every open week has an optional cup/invitational. Future cups appear before their offer is raised; declined events do not reappear. Spectator Major/Worlds remain coloured and stop Skip on Sunday for viewing; Worlds follow options remain available during season review. |
| Events | Rewards table emphasized in the right column above Already Through. Duds title: “Duds Melow invited you to play a showmatch on stream”. Other events retained. |
| Squad/Market | Coach multiplies the training-wear absence risk by 0.8; base illness risk unchanged. No Substitute explains the player, tournament and cause. Closed-window signing sheets show an explicit window restriction. |

R111 records the cadence and coach-risk decisions. BALANCE_VERSION 19.
Save/persist versions remain frozen; absence reason is optional for old saves.
No production/account/hosting changes. No new multi-season pacing or
affordability battery is claimed; open-week prize frequency needs playtesting.

## Verification

Full Vitest suite: **2,139 passed, 31 skipped**, 153 files passed. Final run
uses two workers; the default parallel run exceeded the existing 5-second
limit in filesystem scanning tests on this Windows checkout. No assertion
failure remained. TypeScript and ESLint passed. Added regressions cover the
coach modifier, future/declined cup visibility and third-colour emblem
round-trip; calendar/spectator regressions follow the new cadence.

Static staging export passed: **2,016 files / 51.01 MB**, all **1,074**
manifest image URLs present, career ON, noindex, accounts/analytics DISABLED.
No generated-art or manifest churn.

Browser review: wizard symbols/patterns, conditional third picker and absence
of club presets; Club columns/cards; Finance layout; calendar cup forecasts.
Finances at 320 px has no horizontal page overflow. Screenshots:
crest-rc41.jpg and finances-rc41.jpg (local review deliverables).
Preview server stopped after review.
