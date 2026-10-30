# rc.36 hand-off (interrupted by the usage limit, 30/10)

Base: `origin/staging` @ 7833958. Plan: ROADMAP Etapa 3 "rc.36 — POL-01..04" + UX-02..05, CAL-01, SUN-01..03.

## State
- `rc36-int` = staging + fronts **H2, T2, A merged** (typecheck clean, targeted tests green;
  full suite not run on the merge yet). Conflicts resolved: R-entries kept in order,
  `e2e-smoke.mjs` labels unioned, fingerprint `{6, "2c85b6fb"}` (recompute after each merge:
  run `src/config/balanceVersion.test.ts`, keep balanceVersion 6, copy the hash it prints).
- `rc36-front-s2` @ 80514b4 — **committed, finished code**, but its report never arrived:
  verify gates (typecheck, lint, full suite) before merging.
- `rc36-front-m` @ f7e4219 — **WIP**, interrupted while updating two ECO-04 tests (seat's
  cheapest player; the listing's prospect rule). Unfinished: check what is done against the brief
  (POL-04: remove Merch & streams, equal start budget, FAs with 80s potential, pace back to
  0.44 Majors/season and Worlds 16 % on Normal via slower growth / later peak / season ceiling 8–9,
  the open decisions rc.34-1/2/4/5/7/9), R86.
- `rc36-front-b` @ 085e3d3 — **WIP**, interrupted at the visual check (scratch scenario saves).
  Check UX-04 creation, CAL-01, SUN-01..03 against the brief, R88.

## Still to do after the merges
Integration of S2, M, B → an independent review → full gates → `CAREER_ECON=1` in four
processes by `ECON_REGIONS` and `CAREER_ARC=1` alone (tune the pace keys to Normal 0.44 / 16 %)
→ E2E (`npm run build` staging-like, `wrangler dev`, `node scripts/e2e-smoke.mjs`,
`node scripts/request-budget.mjs`) → CHANGELOG / STATUS / ROADMAP / RTW-STATUS, version bump
(package, lock, site.ts) → commit v2.0.0-rc.36, push to `staging` → Gate 3b summary for Miguel.
Cleanup noted by H2: `hqFinanceOf` still returns unused `debt` and `guaranteed`. T2: a cycle started
by hand misses its first day (check). A: Easy stretch 37 % (band ≤ 35), EU/NA goals low.
Dev-server E2E needs `http://localhost:<port>` (Next 16 blocks 127.0.0.1 in dev).

## Front reports

### H2
H2 — rc36-front-h2 @ c29b605 (12 files, +574/-304). Suite 1359 pass / 10 skip.
- HQ squad: reserve + coach thin rows (stacked phone, side by side sm+); reserve OVR rarity frame, name, New, contract chip; coach whistle, OVR, training edge; empty seats dashed -> Market.
- Progression card: next unlock first, 3-rung track, icon rows, footer "See more" (opens full ladder modal) + Finances.
- HQ finances: balance, weekly net, chart, next payroll + runway lines. Debt tile and loan badge gone (loan keeps own HQ card).
- Unlock pop-up: Close only + "not bought yet: waits in Progression".
- Market: "Signable at my reputation" normal chip in filter row, icon + count.
- Finances arsenal: stacked steps with icon badge; Buy under text on phones.
- Club: stars only; "0.5-star org" words now sr-only label.
- Recommended: only T2's and B's tags exist.
Decisions R84: no Buy on pop-up (row tap still buys, Gate 3a 7-A); "weekly out" = weekly net; 3-rung track layout constant (no balance bump).
Outside: TeamStars.tsx (optional label), LadderParts.tsx, copy (3 keys added, 2 unused removed), Club grid 2px sideways scroll fix in PT.
Loose ends: hqFinanceOf still returns debt + guaranteed (unused) -> delete after merge. SquadCard contract lines share a helper near T2's growth bar edit.
E2E on dev: use http://localhost:PORT (127.0.0.1 blocked by Next 16 dev). Career mobile 15/15 EN+PT.
Not fixed: locked names in Club progression list truncate at 360px; some flag/org images 404 (as before).

### T2
T2 — rc36-front-t2 @ 0615ee4. Suite 1364 pass; smoke career mobile en 16/16.
- 28-day cycles; nothing runs until picked; picker 4 steps (objective, focus, intensity, scrims), empty, NewTag recommendation (Easy, Normal or a coach; none on Hard) -> "Start training". No coach: next cycle by hand; hired coach plans+starts each cycle unless switched off.
- Unpicked plan = nudge, not a decision (never in queue / never holds clock). HQ "No plan running · Choose a plan"; batched Advance stops once when a cycle ends with nothing started.
- Objectives Evolve / Gel / Recover (ids unchanged). Focus a choice again; without coach tag marks squad's weakest theme.
- Removed: "this cycle so far", "expected result", "use the base", season ceiling.
- Payout 85% along the way (never below base), rest on cycle's last day; progress bar Training + HQ; adjust keeps earned; stop/departure forfeits; never pays twice (tested).
- Prettier report modal; signing joins running cycle at once; unknown phase revealed after 5 training days.
- HQ green bar fills toward next overall the card shows.
- rc.35 save keeps its 14-day cycle to its end, then 28 (tested).
- Bot: each policy starts cycles as its player would.
Keys (BALANCE_VERSION 5->6, fingerprint aefcfa4a): periodDays 28, payout.alongShare 0.85, coachPlansByDefault true, phaseRevealDays 5, recommendedFocus "need", stopOnCycleEnd true; hard-scrim wear 2->0.5, easy -1->-0.25.
Measured (training probe, rc.35 base): band 1.14 / 1.16-1.17 / 1.20 / 1.20 / 1.33x (rc.35: 1.19, 1.32 for last two). Risk: Heavy +1.9 pts, Hard +2.8, both +4 cap, Heavy+Easy +0.5 (rc.35: Hard +4 alone, Heavy+Easy 0).
Outside: careerFlow.ts (2 hooks), careerStore.ts, careerUi.ts (agePhase), development.ts (trainingEta only), types.ts, careerArcBot.ts, e2e-smoke.mjs, copy (incl presetHelp).
Gate 3b: start a cycle, watch bar, report day 29; adjust midway; hire coach + toggle; Heavy/Hard; sign FA mid-cycle; load rc.35 save.
Risks: BALANCE_VERSION clash with M. A cycle started by hand misses its first day (!). next dev no hydrate on 127.0.0.1 -> localhost. mx.png flag 404 predates.

### A
A — rc36-front-a @ 36e3709. Suite 1380 pass (incl sharedPath; careerEco02 + weekendView 5 s load timeouts pass alone). Smoke 18/18 mobile EN, 16/16 desktop PT (localhost).
UX-02 season goals: set once at season start, never moves (tested over two seasons). Reads squad vs region, career stage, money, last season's goal. Goals count over the season, Community Cups as a rung for weak squads. HQ + season review: both goals with icon, meter, chances left, dated deadline, status, board's reasons. rc.35 saves keep current goal.
UX-03 news: HQ feed lead story + rows (crests, subject, one-line body, action link). Beats the save contradicts show "From the archive" and their forced transfer does not run. Vitality–zen needs both in world; FURIA to NA new archive beat. 50/50 behind CAREER_NEWS.brand = "wire" (default), logo drop-in public/partners/, plain fallback, never invented quote.
UX-05 achievements: general list All / Draft / Road to Worlds filter. Achievement words only in core copy. Profile careerMarks and career store mirror each other: never granted twice across devices, survives Season reset.
Decisions (R87, #155; BALANCE_VERSION 6): rc.35-(b) rejected by measurement: 252 seasons, "any split" met target 94 %, stretch 88 % -> rule = "season". Fitted: seasonForm 1.5, reachCurve mid -2 / scale 4.5, stretchAim 0.17, targetBand 0.40–0.75. Result: target met 63 % (Normal 56, Hard 63), stretch 29 %.
Outside: optional hook careerArcBot, build-images/postexport, assets.ts, grade badge on season review, e2e-smoke, wire code moved out of HubScreen.
Gate 3b: HQ goal card through a season (EU founding season, then strong NA), review met/missed, feed with archive beat, achievements filter.
Risks: SAM (78/47) and MENA high, EU and NA low; Easy stretch 37 % (> 35 % ceiling). HubScreen conflict risk with H2. Fingerprint recompute.
