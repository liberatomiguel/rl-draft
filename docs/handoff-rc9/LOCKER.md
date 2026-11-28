# rc.9 LOCKER: player morale that moves

Branch `rc9/locker`. Decisions R211–R219. Flag `FEATURES.lockerRoom`.

**Diagnosis.** A starter had two drivers that cancelled out (+1 per event played, −1 per week back to neutral): 100 % of player-weeks read neutral in the probe. The arc bot never called `lockerRoomAfter`, so no battery had played the locker room.

**What changed.** `engine/career/lockerRoom.ts`, new `lockerRoomFacts.ts` and `lockerRoomView.ts`, `config/balance.lockerRoom.ts`, `store/lockerRoomFlow.ts`, marked blocks in `careerFlow.ts` (`lockerMatchBonusFor`), `worldSim.ts` (`moraleBonus`), `careerArcBot.ts`, the locker copy files, probe `store/lockerRoom.probe.test.ts`. Weekly pull toward a target (results against expectation, form, load), held mood, four player requests, bounded match effect, a view for the screens.

**Tunables** (`CAREER_LOCKER`): `pull`, `results` (with `favouriteUpShare` 0), `expectShift` (Hard −0.45), `favouriteTitleShare`, `form`, `load`, `moodHysteresis` 3, `view`, `asks`, `answers`, `sideEvent`, `match` (by mood −1.5 / −0.5 / 0 / +0.1 / +0.25, team −1 / +0.25, first season ×0.5 negative, recent Worlds champion ×0 positive).

**Measured** (probe, 5 careers a cell, arm on minus flag off; series win %):

| | NA | EU | SAM | bonus mean |
|---|---|---|---|---|
| S1 Normal | +1.7 ± 1.6 | −0.3 ± 0.3 | +1.2 ± 1.0 | −0.02..+0.01 |
| S1 Hard (vs zero arm) | +2.1 ± 1.1 | −1.3 ± 0.9 | +1.3 ± 1.2 | −0.05..0.00 |
| S6–8 top org, Normal | +1.0 ± 1.1 | +0.1 ± 1.5 | −1.2 ± 0.8 | +0.02..+0.05 |
| S6–8 top org, Hard | +1.5 ± 0.6 | +0.8 ± 0.8 | +3.0 ± 1.9 | +0.03..+0.06 |

Worlds titles S6–8: Normal 5/45 against 4/45, Hard 4/45 against 3/45. Moods change 1.2–3.5 times per player per season, 0 flaps. Season 1: 70–85 % neutral, the rest split between unhappy and content.

**Soft-lock probe** (takeover era 6, NA/EU/SAM, 4 seasons, every staging flag): 6 careers (autopilot and tuned), 4 seasons each, 528 lobbies, 0 findings.

**Not measured.** Title odds directly (too few careers); the "under a point" reading uses the earlier `LOCKER_PRICE` table (+0.17 team ≈ +3 title points for a Worlds favourite), not rerun. The bot has a three-player squad and trains on normal load, so the bench, start-the-regional and lighter-load paths run only in unit tests. The form driver was off in the season and dynasty runs (box score flag off). Easy and Very Hard expectation shifts. `balanceVersion.test.ts` fails on the new exports (expected).

**For the screens.** They read `moodOf(moraleOf())`; switch to `shownMoodOf` or `lockerPlayerViewOf` to show the held mood. `LockerTalk.tsx` should pass `talk.params` to the copy so the cup size shows.

**Miguel decides.** The positive side: the brief's +1.0 per player would be about +4 title points for a dynasty; it ships at +0.25. Whether the Hard dynasty lean is acceptable (levers `match.byMood.content`, `match.teamMax`). Whether "more load" asks (about 3 per season for a winning squad) are too frequent (`asks.moreChance`).
