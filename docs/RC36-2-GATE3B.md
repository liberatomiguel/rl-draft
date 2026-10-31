# rc.36.2 — Gate 3b playtest

Miguel's second playtest pass restores selective accents and improves HQ,
training, coaches, club creation, calendar, notifications and spectator boards.
The detailed changes are in CHANGELOG.md and decision R90.

## Rules approved for this playtest

- Target +1 and stretch +2 reputation, independently, once at season review;
  normal reputation cap/unlocks, no retroactive payout on settled seasons.
- Sunday: Continuity +0.10 throughout; Recovery −0.15 opener/+0.35 later;
  Preparation +0.60 opener/−0.15 later. Negative opener now works.
- Requested economy candidate: 15% common seasonal money growth, renewal
  multiplier 1.75/market floor 60%, retaining the core 2.5 breakout guard;
  coach wage curve 1.14. Signed amounts remain frozen.
- Six matched eight-season Normal careers (SAM/EU, three policies) continued
  without endings or softlocks. Tight Mondays 166/1530 → 179/1530. Scope and
  limits: ECONOMY-RC36-2-PLAYTEST.md. This is not a new global pacing calibration.
- Region examples use the initial RLCS X rosters, as Miguel chose. SAM FURIA
  ranks fourth in that dataset; later dominance does not boost its initial
  roster. Every-org entry was fixed in rc.33 and remains covered by regression.

## Verified

- Full suite: 1,447 passed, 13 opt-in checks skipped; 127 files passed.
  Typecheck clean; lint clean. Focused checks after the final wizard/news
  integration: 14 passed and typecheck clean.
- Independent review found the legacy-cup future-stop bug; fixed and covered.
  Randomize now uses the curated wizard palette/shapes, preserving old saves
  and the frozen procedural catalog.
- Final static staging-like export passed: career on, noindex,
  accounts/analytics off; data, persist contracts and assets validated.
- 56 browser checks: desktop/mobile × EN/PT across HQ, calendar navigation,
  market filter, squad, long standings banner, Swiss/results, sponsorship,
  direct training repeat, cup day and crests. Eight additional checks exercised
  bootcamp purchase, coach hire/current card and real bilingual beat toasts.
  No page overflow or browser errors; bracket scroll remains internal.
- Two complete Classic request checks: 62 each against 75; cold home 27
  against 28. Prior rc.36.1 profile/leaderboard effects measurements remain
  the reference; those screens/animations were not retuned.

## Play next

Check the accent balance, training/results and compact coaches; buy a bootcamp
and an unlocked item; try crest patterns; follow Swiss into playoffs; inspect
cup dates, notifications, sponsor weekly comparison and a developed renewal.
Confirm the goal reward and Sunday trade-offs in play.

The prior full Normal baseline was 0.4562 Majors/season and 17.12% Worlds
against the 0.44/16% target. The six-career smoke does not remeasure that global
target or all economy guardrails. Broader loan, wage-budget, scouting and
older-roster decisions remain in ROADMAP.md.

Stop at Gate 3b: Etapa 4 and main still await Miguel's playtest approval.
