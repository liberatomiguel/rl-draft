> Historical package notes, superseded for integration/validation by [handoff-rc53-polish.md](handoff-rc53-polish.md).

# Card review — local candidate

Prepared from v2/M1, f66d4f2. Not merged or deployed.

## Catalogue edits

- Royales: display title `NA Breakthrough`, no NRG-win claim. Preserve `sp-royales-nrg-beater` as a stable save/art key. The existing Plot Twist 2026 base is retained as the person's draft anchor; it does not claim that the pictured Fisher appearance was with Plot Twist. A separate Fisher roster is not invented in this patch.
- STL: `Worlds 2022: Moist Breaker`, assistant role, FURIA's 4–3 quarterfinal win over Moist and top four at Worlds 2022. Base corrected to `stl-coach-furia-2122`.
- Add source syntax `assistant coach: Name rating`. It emits a historical coach base, while `lineup.coachId` continues to reference the head coach. FURIA 2021–22 now contains STL's assistant base alongside Kairos; existing sub and head-coach records stay.
- Kairos nationality corrected BR → US. Competitive region remains that of each lineup.
- DudsMelow: FURIA 2025 substitute, base 76 as on his existing FIFAe substitute card. Community special 80, +2 team consistency/experience. The FURIA bench placement is Miguel's explicit catalogue choice, not independently verified as an official historic signing.
- Delete only `sp-gian-community`. Gian's base records are retained. Saved collection entries for the deleted special are handled by the existing catalogue pruning; collection completion totals will reflect the removal/addition.
- No other deletion. In particular Joyo's overlapping specials remain for Miguel's decision.

## Sources

- FURIA head coach/assistant: https://x.com/FURIA/status/1527761494737395713
- Kairos nationality: https://liquipedia.net/rocketleague/Kairos
- FURIA/Moist: https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/2021-22
- Royales at Fisher: https://www.fisher.edu/student-life/esports

## Photos and proposals

The photo review package is separate. Do not replace approved production art with its candidates automatically. Repi, Ninja23509 and Freedom are excluded from the search. Nine earlier proposals have candidate photos; Shad/Lachinio still need a matchday alternative. Kairos now uses Miguel’s supplied event coach photograph, cropped conventionally to 480 × 680. Prospective titles, rarity/OVR/effects for those nine are not added to the live catalogue in this patch.

## Validation

Run `npm run build:data`, `npm run validate:data`, the cards/draft/national engine tests and typecheck. The new regression tests cover sub-special ownership, Duds resolving as a FURIA substitute, and STL's assistant base without replacing Kairos.

Integration coordinator: apply the file changes to the current integration branch, regenerate data, review the supplied pictures with Miguel, then run the image pipeline for selected art. Do not deploy to main from this package.

## Authored-content revalidation

The data edits invalidate some recorded RNG-dependent actions. Refreshed all 365 daily witnesses and 12 challenge witnesses. Challenge seeds/objectives/gates remain unchanged. Ten FUTURE daily seeds were recalibrated after 2026-11-12: 2026-12-01, 2027-01-12, 2027-01-18, 2027-06-04, 2027-07-02, 2027-07-04, 2027-07-15, 2027-08-27, 2027-11-01, 2027-11-06. Every daily date and every past/current seed is preserved. The report contains old/new values. Integrate the catalogue and these witnesses together; review the future-seed changes before staging.

Repeatable authoring gates: `CHALLENGE_REFRESH=1` with the challenge-solvable test filtered to "refreshes challenge"; `DAILY_REFRESH=1`, `DAILY_REFRESH_AFTER=YYYY-MM-DD` with the daily playability audit. The daily refresh retains current seeds when a legal win+bonus path is found; the AFTER boundary is mandatory to allow any future-only recalibration. Never use these authoring flags in normal test runs.

Focused data/cards/draft/national: 155 passed, 1 skipped. Typecheck and changed-code lint passed before the last test-authoring addition. See the supplied final logs for the latest checks. The broad suite was interrupted after identifying stale witnesses; no full-suite pass is claimed.
