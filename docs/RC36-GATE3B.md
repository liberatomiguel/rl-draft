# rc.36 — Gate 3b

> v2.0.0-rc.36 · 2026-10-30 · Etapa 3.
> Technical verification complete. Gate 3b awaits Miguel's playtest on staging.

## Delivered

H2, T2, A, S2, M and B are integrated on rc36-int. Decisions R83–R88 explain
the result; ROADMAP's Etapa 3 is complete for playtest. The six fronts cover:

- Training: selected 28-day plans, Evolve/Gel/Recover and focus, earned gain
  plus completion payout, coach planning, modest wear, signing into a cycle.
- HQ and progression: compact squad/sub/coach, finances and arsenal, Close-only
  unlock, next-overall growth bar, recommended style and reputation filter.
- Sponsors/talk: modal sponsor cards and deadline holds; only sent offers
  produce an answer, refusals raise the floor, every contract lever counts.
- Economy/world: equal budgets by difficulty, fitted founding wages, removed
  passive Merch & streams, seasonal prospects and readable market listings;
  slower growth to the same later peak, with an 8.5-point season ceiling.
- Season goals/news/achievements: fixed season-wide targets with progress and
  deadlines, honest archive labels, branded news behind a key, permanent
  career achievements in the general mode-filtered list.
- Creation/calendar/weekend: crest builder and contrast guard; blue windows,
  no payroll marker; Saturday HQ, optional briefing, explicit Sunday start,
  accessible once-only intro; follow/watch/sim/skip after elimination.

## Independent review

A reviewer separate from the completion work checked contract/refusal
persistence, cheapest-seat rules, signings and training, sponsor/clock holds,
goal migration, Sunday/following and reloads. Two findings were corrected:

1. A cycle started after Tuesday/Thursday's daily session could scrim before
   its displayed start. Scrims now obey packageFromDay, like sessions; tests
   cover both weekdays, repeated choices and unchanged base gain.
2. Sunday's full-screen intro focused its primary button but let Tab leave
   the modal. It now uses shared dialog focus trapping/restoration; keyboard,
   reduced motion, skip and once-only reload were browser-checked.

A profiled calendar-flow optimisation also removes a redundant deep copy
per advanced day. Day arrival retains its deep-clone boundary; a frozen-input
Monday regression and an identical eight-season trace verify ownership and
results. No clock hold or gameplay rule was changed.

No open integration blocker remained. The HQ finance view's unused debt and
guaranteed-income fields were removed. Saves/persist versions and the shared
match engine are unchanged.

## Measurements

Every long-career cell uses seeds 9100 and 17019, seven regions, three
difficulties, seven standard policies and eight seasons: 294 careers.
CAREER_ECON is split into four processes by region. ECON_ARC_OUT retains the
exact full ArcCareer returned by the same playArcCareer calls, alongside the
economy tap. Both sets check 294 unique cells, zero softlocks and matching
competitive counts per cell. ARC_REPORT runs separately after the sweep;
there is no duplicated simulation or concurrent report.

| Normal competitive line | rc.34 | rc.35 | rc.36 |
|---|---:|---:|---:|
| Majors qualified per season | 0.44 | 0.60 | 0.4562 |
| Worlds reached, season rows | 16% | 23% | 17.12% |

The measured Normal set is 98 careers, 765 season rows, 349 Majors and 131
Worlds, with zero softlocks. The 0.44 / 16% target is not exactly met: the
remaining difference is +0.0162 Majors per season and +1.12 percentage points
of Worlds. It is explicit for Gate 3b: confirm the progression feel rather
than treating the target as an already approved result.

Both reports contain 294 unique careers, 2,314 season rows and zero
softlocks; competitive counts match per cell. Insolvency is 1 / 6 / 6%
(Easy / Normal / Hard), newcomers 0 / 2 / 10%, and tight Mondays 13 / 24 /
31%. EU on Normal, the wealth tail and early star access remain outside
candidate bands; ECONOMY-CONTRACT.md §13 records both sides and other misses.

Reports: CAREER-ARC-rc36.md, ECONOMY-PROBE-rc36.md,
CAREER-GROWTH-rc36.md and CAREER-TRAINING-rc36.md. Economy guardrails and
remaining out-of-band cases: ECONOMY-CONTRACT.md §13. Exact counts and
unrounded rates are retained with the sweep records. The generated report
headings retain their instrument's original release; the rc36 files were
generated with the final balance keys recorded above and in §13.

Training used two prospect samples: 112 rookies across seven regions, with
12-season pure trajectories and the full two-season EU/SAM flow. Package/base
p50 gain ratios at ages 13–19 are 1.14–1.35; no player exceeds peak + tolerance.
Pure scrim share p90 is 17–18%, heaviest wear is capped at +4 event points,
and coach-market coverage is 91%. The flow has zero prompts/unavailability;
two SAM season rows report 26% scrim share against the 25% candidate band.
That one-point residual remains visible for Gate 3b.

Growth uses the default 24 samples, with its long arcs capped at eight
(448 model-2 players). All peaks remain within potential ±2. The median age
of reaching peak is 21.4: early 19.7, standard 21.5, late 23.1.

## Verification

| Gate | Result |
|---|---|
| Full suite | 1438 passed, 13 opt-in checks skipped |
| Typecheck / lint | Clean; 0 errors and 0 warnings |
| Dataset rebuild / validation | Unchanged; 45 validation tests passed |
| Save/shared-path contracts | Included in the full suite and prebuild |
| Staging-like static export | Passed; 1,697 files, 45.59 MB; career on, accounts/analytics off |
| Export browser smoke | 91/91 checks across 10 scenarios; desktop/mobile, EN/PT; zero errors |
| Weekend/crest visual checks | 21/21 weekend/crest checks; keyboard, reduced motion and reload included |
| Request budget | 6 runs: 61–64 requests per whole Classic run (budget 75); cold home 27 (budget 28) |
| Effects performance | Profile 65 ms/s (budget 80), leaderboard 16 (budget 60); zero non-composited animations |

The final suite was run with one worker and a 15-second default timeout on
this Windows host. One original 5-second loan test timed out during the
first parallel S2 run and passed alone; the integrated runs passed in full.
Runtime profiling reproduced the earlier flow's cost on the same host;
the duplicate calendar-flow clone was removed and validated against the
complete deterministic trace. Match difficulty, RNG and gameplay rules were
not changed for runtime or measurement results.

## Play and decide

Play new careers on staging in EN/PT, desktop/mobile, then load an rc.35
save too. ROADMAP "Waiting on Miguel" has the full sequence. Focus on:

1. Create a custom crest, test a low-contrast combination, compare the three
   founding rosters' equal budget, and carry veterans through a Normal split.
2. Start/adjust a cycle, see the bar and day-29 report, hire a coach and
   toggle planning, sign during training, finish an imported 14-day cycle.
3. Compare sponsor cards, Decide later through the deadline, and send an
   under-ask contract offer before adjusting every lever.
4. Carry the HQ goal through a season and review met/missed goals; archive
   news and achievements filters/persistence.
5. Play Saturday → HQ → briefing → Sunday, skip/reload the intro, lose or
   skip qualification and follow the event. Check the calendar on a phone.

Still Miguel's decisions: Hard's first-breach loan; loan terms/investor;
EU spending-policy endings; the wage budget/snowball; scouting-band width;
veteran retirement/rebuild timing; and the empty-seat waiver with an extra
bonus. Defaults are retained for this playtest. The 50/50 brand waits for
partner approval/material; The Wire remains the default.

Known presentation limits: optional missing org art uses fallbacks (two raw
PNG 404s were observed only in dev); long locked progression names at 360 px
remain an Etapa 5 polish item. The news corpus/partner material is incomplete.

Stop at Gate 3b. Etapa 4 is the next session after approval; production
cutover/account actions remain in V2-IMPLEMENTATION-PLAN.md §6.
