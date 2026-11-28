# rc.9 DRAFT-UI handoff

Branch `rc9/ui`. Decisions #280 to #287, CHANGELOG "DRAFT-UI front". No engine or store edits.

## Already done by the first agent (verified, not redone)
`OverallParts` shared by Review and Results, `runEnd.ts` and the game-by-game series, reset wording for challenge and Daily (EN and PT, `RunStepper`), copy passes over HOME, SETUP, ONBOARDING, TUTORIAL, HOWTO, NARRATION, COLLECTION, PROFILE, CHALLENGES, LEADERBOARDS, MISSIONS, QUIZ, SEASON_RECAP, NATIONAL, DAILY, RESEARCH, DATABASE.

## Changed here
- `OverallParts.tsx`: after Miguel's note (clean is not bare) the parts are drawn: bar out of 99 for the average, a centre-line bar and a signed green or red chip for each adjustment, one scale per team. Total large; on a phone the parts sit under it. The first agent's list was plain text, so this restores the visual. Sum checked: 87.7 + 0.6 + 2.2 − 0.5 = 90.
- `ResultsScreen.tsx`: lost series shows both teams' marks around the score, then the game strip; rival title wraps; "Played at N" on its own line; highlight and achievement names mixed case.
- `SetupScreen` (Worldwide key full row on a phone), `CollectionView` (tabs, locked card label), `ChallengesView` (Draft Lab tag), `AppShell` (bottom nav columns under 360 px), `TournamentScreen` (obvious hint out), `AchievementsView` (kicker out).
- Copy (EN / PT words, `rc9/int` to now): HOME 646/687 to 357/385; HOME_SEO 516/567 to 472/522; SETUP 160/173 to 123/137; ONBOARDING 350/364 to 203/206; TUTORIAL 132/149 to 90/102; HOWTO 270/299 to 233/241; RESULTS_UI 292/318 to 211/238; COLLECTION 92/98 to 59/62; PROFILE 277/293 to 192/206; ACH_UI (EN) 285 to 267; NARRATION 175/171 to 127/125; CHALLENGES 575/611 to 518/559; LEADERBOARDS 525/534 to 449/460; COSMETICS 1,615/1,614 to 1,559/1,560; MISSIONS 766/823 to 439/462; others smaller. Core total 8,477/9,866 to 6,985/8,302.
- The audit was wrong on COSMETICS `sources["grant-*"]`: read dynamically in `sourceLabel.ts`, kept.
- `CHANGELOG_PAGE` left for the owner (#287).

## Seen (draft.localhost:3210)
Normal classic, Hard region-only (EU), challenge reset modal, 375 and 320 walks of Home, Play, Results, Challenges, Collection, Profile, Settings with a DOM check (no sideways scroll, truncation, wraps). Shots in `.claude/rc9/shots/draftui/`. Review and Results show the same number. Hard: "??" until Results, then the "Overalls revealed" tag. The primary after the draft and the run is flat orange (`rgb(255,106,26)`), 44 px, docked at 375 and 320; the reported "dark brown" was the old faded disabled primary (#219) or the 0.4 s fade-in.

## Not verified
Legacy (locked on a new profile); three-99 team (the curve rows rendered only by engine test, not on screen); Daily draft screen; 1280 shots (the pane is narrower than 1280); keyboard order by hand; PT screens by eye (copy only); Review at 320. A 500 from another front's `careerShare.ts` interrupted the dev server once.
