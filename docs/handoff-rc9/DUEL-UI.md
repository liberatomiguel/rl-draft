# DUEL-UI handoff (rc.9)

DESIGN-DECISIONS #294 to #300, CHANGELOG "DUEL-UI".

## What changed
- `/duel`: `app/duel/DuelView.tsx` (light router on the hash; broken links explained before data loads) and the lazy `components/duel/DuelStage.tsx` with `DuelStart`, `DuelAnswer` (+ `DuelAnswered`), `DuelSent`, `DuelMatch` (face-off, live via `LiveGameView`, end), `DuelResume`, `DuelLinkError`, `DuelParts`, `DuelNameField`, `duelTeam.ts`, `duelNav.ts`.
- Run store: `startDuelMatch`, `finishDuelDraft`; pick/reroll/restart route to the duel engine; `RunState.duelMatch` (types.ts). Wiring: ReviewScreen (Lock the team / Play the match), RunStepper, PlayView (redirect, old run dropped), AppShell (/duel keeps a duel draft), Home friends board links to /duel.
- Removed: `engine/duel.ts` + test, four old duel components, Setup's duel button, ResultsScreen panels, run-share duel branch, `DUEL_UI`, `SHARE_UI.titleDuel/textDuel`. `store/duelStore.ts` rewritten: `trackDuel`, the local duel record.
- Analytics: `duel_played` replaces `friend_duel` (catalogue, test, ANALYTICS doc).

## The old duel's stored key
The old duel store had no persisted key. Its run field `RunState.duel` stays as a deprecated `unknown`, never written; a stored run carrying it is dropped on /play and `finishRun` refuses it. Persist contract unchanged (`persistContract.test.ts` green). New plain keys: `rocket-draft:duels:v1` (≤20 link codes, which side this browser is), `rocket-draft:duel-name:v1`.

## Verified
- Played a whole duel: challenger at `duel.localhost:3210` (hidden overalls, 7 rerolls, one reroll spent), friend at `duel2.localhost:3210` (375 px, PT, resumed a half draft from the challenge link), friend watched (auto-advance G1 to G3, pause, speed, skip series), challenger opened the reply: same series both sides (Ana 4-0; 3-0, 4-2, 3-2 OT, 4-2; MVP zen). Rematch started a new draft with the same rules. Drop, tampered / old-format / cut links checked.
- No sideways scroll at 1280, 375, 320 on the screens shot. Shots in `.claude/rc9/shots/duel/` (01 to 14).
- Tests: duel engine (4 files), `runStore.duel.test.ts` (new: boards, reroll, challenge→reply→same series, grants nothing, refusals, restart), `sharedPath`, `persistContract`, `analyticsCatalog`: 147 green. `tsc` clean on my files (one error in `fanFeedFlow.ts`, not mine). ESLint clean on my files.

## Not verified
- A real phone, the native share sheet and the clipboard (automation has no user activation).
- Every screen at every width: no shot of the live game at 1280 or 320, the send screen at 375/320, the Home friends board.
- Keyboard: reachability and focus checked by code and DOM (native buttons, `aria-pressed`, focus moves to New match); not a full Tab walk.
- The full suite. Screenshots look dimmed: the entry animation is caught mid-way in the pane.

## For Miguel
- The OG image `/landing/duel-share.jpg` still shows the old duel's wording; it needs new art.
- The first-run tutorial shows in a duel's draft for a brand-new player (the friend from a link). Kept: it teaches the draft.
