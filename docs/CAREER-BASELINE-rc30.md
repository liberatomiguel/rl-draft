# Career baseline — rc.30 (the "before" of Etapa 2b)

> Measured on `staging` at v2.0.0-rc.30 (2026-10-29) with the long-career
> harness (ROADMAP Etapa 2a, OBS-02). These are the numbers Etapa 2b changes:
> it re-runs the same seeds and the same commands for the "after". Nothing
> here is a target; the targets are `CAREER_ARC` (balance.ts) and the plan's
> acceptance criteria. Regenerate, never hand-edit.

**How it was measured**

- Careers: `src/store/careerArcBot.ts` plays whole careers through the real
  flow functions (the store's calls), deciding only from what the screens
  show. Seven policies × 7 regions × 3 difficulties × 2 seeds = 294 careers,
  8 seasons each (into the infinite era), stopping early on insolvency or a
  softlock.
  ```bash
  for i in 0 1 2 3; do CAREER_ARC=1 ARC_SLICE=$i/4 ARC_OUT=arc$i.json npx vitest run src/store/careerArc.test.ts -t sweep & done; wait
  ARC_REPORT=1 ARC_IN=arc0.json,arc1.json,arc2.json,arc3.json ARC_MD=arc.md npx vitest run src/store/careerArc.test.ts -t report
  ```
- Model curves (no career needed, seconds): `CAREER_CURVES=1 CURVES_MD=curves.md npx vitest run src/store/careerArc.test.ts -t curves`.
- The policies (`ARC_POLICIES`): **autopilot** (the median hands-off manager:
  best sponsor, renews everyone at the ask, never shops), **tuned** (title
  run: upgrades the weakest starter, coach, scrims, renews only what the
  books carry, sells when the runway is under eight weeks), **youth**
  (prospects roster, young high-potential signings), **spender** (stars
  first, borrows), **badSponsor** (autopilot with the poorest deal),
  **losingStart** (the weakest roster, hands-off), **coachChurn** (tuned with
  a new coach every season). A bot is simpler than a player: read the
  numbers as the shape of the system, not as exact player outcomes.

Careers: 294 · seasons per career: 8 · seeds per cell: 2

## 1. The competitive arc and insolvency

Overall, 173 of 294 careers (59 %) end insolvent: 38 % on Easy, 63 % on
Normal and 76 % on Hard, three quarters of them in their second to fourth
season. No softlock. By difficulty × policy (14 careers each: 7 regions × 2
seeds):

| Difficulty · policy | n | first Major by S2 | first Worlds by S4 | Worlds title by 2026 | insolvent | softlock |
|---|---|---|---|---|---|---|
| easy · autopilot | 14 | 7% | 0% | 0% | 43% | 0 |
| easy · badSponsor | 14 | 7% | 0% | 0% | 43% | 0 |
| easy · coachChurn | 14 | 50% | 57% | 0% | 29% | 0 |
| easy · losingStart | 14 | 14% | 43% | 0% | 36% | 0 |
| easy · spender | 14 | 43% | 36% | 7% | 43% | 0 |
| easy · tuned | 14 | 50% | 64% | 0% | 29% | 0 |
| easy · youth | 14 | 57% | 64% | 21% | 43% | 0 |
| hard · autopilot | 14 | 0% | 0% | 0% | 79% | 0 |
| hard · badSponsor | 14 | 0% | 0% | 0% | 100% | 0 |
| hard · coachChurn | 14 | 7% | 21% | 0% | 64% | 0 |
| hard · losingStart | 14 | 7% | 36% | 0% | 64% | 0 |
| hard · spender | 14 | 0% | 7% | 0% | 93% | 0 |
| hard · tuned | 14 | 7% | 14% | 0% | 64% | 0 |
| hard · youth | 14 | 50% | 50% | 0% | 64% | 0 |
| normal · autopilot | 14 | 0% | 0% | 0% | 50% | 0 |
| normal · badSponsor | 14 | 0% | 0% | 0% | 93% | 0 |
| normal · coachChurn | 14 | 7% | 21% | 0% | 43% | 0 |
| normal · losingStart | 14 | 0% | 21% | 0% | 64% | 0 |
| normal · spender | 14 | 0% | 0% | 0% | 79% | 0 |
| normal · tuned | 14 | 7% | 21% | 0% | 43% | 0 |
| normal · youth | 14 | 43% | 36% | 0% | 71% | 0 |

Targets (normal unless noted): first Major by S2 ≥ 70%, first Worlds by S4 ≥ 60%, Worlds title by 2026 easy 45–70% · normal 20–45% · hard 8–25%, insolvency ≤ easy 2% · normal 10% · hard 25%.

## 2. Money by season

Balance at season end, p10 / p50 / p90, every policy (careers still alive at
that season).

| Difficulty | S0 | S1 | S2 | S3 | S4 | S5 | S6 | S7 |
|---|---|---|---|---|---|---|---|---|
| easy | $2.1k / $18.6k / $30.7k | $3.0k / $36.5k / $78.0k | −$6.4k / $45.6k / $139.3k | $14.7k / $118.6k / $284.9k | $10.4k / $158.2k / $416.2k | $47.6k / $235.7k / $674.0k | $17.7k / $271.1k / $782.2k | $52.7k / $355.7k / $1025.3k |
| hard | −$4.1k / $3.2k / $10.5k | −$5.9k / $9.4k / $47.0k | −$5.7k / $13.7k / $48.5k | −$6.7k / $31.4k / $108.7k | −$7.1k / $43.6k / $144.0k | −$5.1k / $108.3k / $279.5k | $1.6k / $161.1k / $381.0k | $65.8k / $182.6k / $526.2k |
| normal | −$0.7k / $8.1k / $15.9k | −$5.2k / $15.1k / $48.1k | −$5.7k / $12.7k / $57.1k | −$5.6k / $47.6k / $106.3k | −$6.3k / $45.9k / $154.8k | $9.5k / $75.8k / $220.0k | $21.2k / $84.8k / $260.3k | $8.2k / $139.9k / $260.4k |

## 3. Money health by policy

Every season of every career. "Payroll ÷ guaranteed income" = squad wages +
coach over sponsor base + fanbase; "prize share" = prizes over all income.

| Policy | season-rows | below $0 at season end | Backer owed at end | bank loans / career | low point p10 | payroll ÷ guaranteed income p50 | prize share of income p50 | star signing by S4 |
|---|---|---|---|---|---|---|---|---|
| autopilot | 214 | 22% | 23% | 0.0 | −$5.3k | 2.95 | 41% | 2% |
| badSponsor | 172 | 33% | 31% | 0.0 | −$5.6k | 4.46 | 57% | 0% |
| coachChurn | 258 | 10% | 5% | 0.0 | −$4.6k | 3.78 | 38% | 14% |
| losingStart | 229 | 13% | 12% | 0.0 | −$5.0k | 2.90 | 54% | 0% |
| spender | 156 | 26% | 29% | 1.1 | −$5.4k | 3.46 | 47% | 7% |
| tuned | 258 | 9% | 6% | 0.0 | −$4.5k | 4.00 | 39% | 21% |
| youth | 229 | 12% | 9% | 0.0 | −$5.3k | 4.00 | 54% | 17% |

## 4. Regions

Normal difficulty, every policy.

| Region | n | first Major by S2 | Worlds by S4 | title by 2026 | insolvent | balance S3 p50 |
|---|---|---|---|---|---|---|
| APAC | 14 | 29% | 36% | 0% | 14% | $74.9k |
| EU | 14 | 0% | 0% | 0% | 100% | −$5.2k |
| MENA | 14 | 7% | 0% | 0% | 64% | $33.3k |
| NA | 14 | 0% | 0% | 0% | 100% | −$5.7k |
| OCE | 14 | 14% | 36% | 0% | 43% | $48.6k |
| SAM | 14 | 0% | 0% | 0% | 86% | $76.9k |
| SSA | 14 | 7% | 29% | 0% | 36% | $56.8k |

## 5. Development

**5.1 The user's squad** (trained, through the real flow): overall gained over
a season, by age at its start, and the gap to potential at its end.

| Age | n | gain p10 | gain p50 | gain p90 | gap to potential at season end p50 |
|---|---|---|---|---|---|
| 13 | 2 | 0.0 | 7.0 | 7.0 | 3.1 |
| 14 | 3 | 0.1 | 0.1 | 1.5 | 0.0 |
| 15 | 85 | 2.3 | 6.4 | 7.0 | 4.6 |
| 16 | 148 | 0.0 | 4.5 | 7.0 | 1.5 |
| 17 | 353 | 0.0 | 3.5 | 6.9 | 1.0 |
| 18 | 386 | 0.0 | 1.6 | 5.7 | 0.4 |
| 19 | 330 | 0.0 | 0.6 | 4.0 | 0.1 |
| 20 | 261 | 0.0 | 0.4 | 3.1 | 0.2 |
| 21 | 266 | -0.1 | 0.1 | 2.2 | 0.2 |
| 22 | 241 | -0.4 | -0.2 | 0.1 | 0.4 |
| 23 | 208 | -0.4 | 0.0 | 0.5 | 0.6 |
| 24 | 186 | -1.1 | -0.7 | -0.2 | 1.4 |
| 25 | 149 | -1.1 | -0.3 | 0.1 | 2.3 |
| 26 | 73 | -2.1 | -1.1 | -0.2 | 3.9 |
| 27 | 18 | -0.3 | -0.1 | 0.2 | 4.5 |
| 28 | 7 | -0.8 | -0.1 | 0.2 | 3.8 |
| 29 | 1 | -0.8 | -0.8 | -0.8 | 1.8 |
| 30+ | 2 | -0.6 | -0.4 | -0.4 | 2.8 |

**5.2 Rookie classes (DEV-01a)**, intake age and potential, dataset era vs
infinite (40 seeds × 7 regions × 8 rookies a season).

| Era | rookies | age 13 | 14 | 15 | 16 | pot ≥ 88 | pot 93–95 | pot 96–98 | 13–15 with pot ≥ 93 | max pot |
|---|---|---|---|---|---|---|---|---|---|---|
| dataset (S0–S5) | 13440 | 24.5% | 25.5% | 24.7% | 25.3% | 14.8% | 0.0% | 0.0% | 0.0% | 88 |
| infinite (S6–S9) | 8960 | 24.5% | 24.7% | 26.0% | 24.8% | 15.1% | 3.0% | 1.6% | 3.8% | 99 |

**5.3 The season-0 world**, generated players and the free-agent pool a new
career sees (12 seeds).

| Pool | players | age ≤ 15 | age 16–19 | pot ≥ 88 | pot ≥ 93 | max pot |
|---|---|---|---|---|---|---|
| fillers (rosters + free agency) | 2592 | 0.0% | 50.3% | 7.8% | 2.9% | 95 |
| free agents (real + fillers) | 1152 | 3.3% | 47.1% | 15.1% | 3.0% | 99 |

**5.4 Real players against their special cards (DEV-01c).**

Players with a special card: 154. Potential (derivePotential, 5 seeds) sits BELOW the best special's overall in 75.8% of samples; special − potential p50 3, p90 17, max 32.

**5.5 The world's growth curve (DEV-01b/d)**, generated AI players over nine
season passes (6 seeds), by age at the start of the season.

| Age | n | overall p50 | gain over the season p50 | gap to potential p50 | within 2 of potential |
|---|---|---|---|---|---|
| 13 | 656 | 71.2 | 5.2 | 7.8 | 12.5% |
| 14 | 1178 | 73.2 | 5.1 | 5.9 | 23.5% |
| 15 | 1616 | 74.0 | 4.8 | 5.0 | 34.0% |
| 16 | 2181 | 74.5 | 3.9 | 3.4 | 42.8% |
| 17 | 1995 | 76.0 | 2.7 | 2.0 | 62.4% |
| 18 | 1900 | 77.0 | 1.8 | 1.9 | 74.5% |
| 19 | 1688 | 77.7 | 1.6 | 1.4 | 81.0% |
| 20 | 1539 | 78.0 | 1.2 | 2.0 | 86.6% |
| 21 | 1473 | 78.0 | 0.8 | 2.0 | 89.6% |
| 22 | 1308 | 76.5 | -0.7 | 2.0 | 83.3% |
| 23 | 1180 | 75.3 | -0.7 | 2.0 | 77.9% |
| 24 | 789 | 74.0 | -1.6 | 2.0 | 86.1% |
| 25 | 451 | 72.1 | -1.6 | 2.0 | 93.1% |
| 26 | 194 | 69.4 | -2.6 | 2.0 | 92.3% |
| 27 | 71 | 63.8 | -2.6 | 2.0 | 91.5% |
| 28 | 17 | 60.1 | -2.3 | 2.0 | 94.1% |
| 29 | 6 | 60.0 | 0.0 | 2.0 | 100.0% |
| 30+ | 1 | 60.0 | 0.0 | 2.0 | 100.0% |

## 6. Scouting bands (DEV-01e)

Where the true potential sits inside the band the market shows (0 = the
floor, 1 = the ceiling), every player of 12 season-0 worlds.

| Report level | headroom (pot − ovr) | players | mean position | at the floor (≤ 0.15) | at the ceiling (≥ 0.85) | ceiling − truth p50 |
|---|---|---|---|---|---|---|
| 0 | 0–2 | 4058 | 0.31 | 35.4% | 10.3% | 4.0 |
| 0 | 3–5 | 528 | 0.48 | 22.0% | 15.3% | 4.0 |
| 0 | 6–10 | 315 | 0.59 | 18.4% | 31.1% | 3.0 |
| 0 | 11+ | 277 | 0.56 | 16.6% | 28.5% | 4.0 |
| 1 | 0–2 | 4011 | 0.39 | 30.6% | 16.5% | 2.0 |
| 1 | 3–5 | 528 | 0.51 | 15.7% | 15.7% | 2.0 |
| 1 | 6–10 | 315 | 0.47 | 25.4% | 17.5% | 3.0 |
| 1 | 11+ | 277 | 0.55 | 14.4% | 20.2% | 2.0 |
| 2 | 0–2 | 3758 | 0.44 | 56.2% | 43.8% | 2.0 |
| 2 | 3–5 | 528 | 0.51 | 48.9% | 51.1% | 0.0 |
| 2 | 6–10 | 315 | 0.47 | 53.0% | 47.0% | 2.0 |
| 2 | 11+ | 271 | 0.46 | 53.9% | 46.1% | 1.0 |

## 7. What the numbers say (the brief for Etapa 2b)

1. **The career misses every `CAREER_ARC` anchor** (§1). On Normal, 43–93 %
   of careers go insolvent, depending on the policy (target ≤ 10 %); on Easy
   29–43 % (≤ 2 %); on Hard 64–100 % (≤ 25 %). No policy wins Worlds by 2026
   on Normal (target 20–45 %). The first Major by season 2 reaches ≤ 7 % on
   Normal for every policy but the youth core (43 %; target ≥ 70 %).
2. **The strong pools are traps, the weak ones the easy road** (§4). On
   Normal, EU and NA end insolvent in 100 % of careers, SAM in 86 % and MENA in
   64 %, while APAC (14 %), SSA (36 %) and OCE (43 %) survive. In EU and NA the
   founding roster ranks 17th–19th, earns no reputation, gets no sponsor and
   cannot pay its wages by season 1 or 2, whatever the policy. This is the
   reverse of the regional identity the plan keeps (SAM is meant to be the
   accessible pool).
3. **Why money fails** (§3, and the careers' ledgers):
   - The founders' contracts end after season 1. Renewal is at a fresh ask
     that grows ×1.2 per overall point (`CAREER_SALARY.growthPerPoint`), plus
     the reputation premium, so a founder who develops from 73 to 79 asks
     about three times as much.
   - Wages then run at 2.9–4.5× the guaranteed income (sponsor base +
     fanbase, p50), and prizes make up 38–57 % of all income. A team that does
     not win cannot pay its squad: developing your own players is punished at
     renewal (ECO-01, ECO-03).
4. **Winners snowball** (§2). The survivors' balances reach $0.5–1.0M (p90)
   by season 7, on payrolls of $100–260k a split: once a team wins, money
   stops being a decision (the plan's "nem acesso fácil demais").
5. **The Emergency Backer is how careers end** (ECO-02). It is still owed at
   season end in 5–31 % of season rows by policy, and the second breach ends
   the career; only the spender ever takes a bank loan. The harness gives
   the seeds to reproduce it in the real flow.
6. **Growth hits a wall early** (§5).
   - In the squad, the season's gain falls from 6.4 (age 15) to 3.5 (17),
     1.6 (18) and 0.4 (20), and turns negative from 22–24.
   - The gap to potential is under 1.5 from 16 and about 0 at 18–21: players
     reach their potential at 18–19 and stop there (it is a hard cap). With
     founders at potential 80–89, a career has no long development arc
     (DEV-01b/d). The AI world stalls 2 points under potential (5.5).
   - Rookies: 0 % at 93+ in the dataset era (max 88; DEV-01a).
   - Specials: potential sits below the player's best special in 76 % of
     samples (gap p50 3, p90 17; DEV-01c).
7. **Scouting leans to the floor for settled players** (§6). With no report,
   a player with little headroom (most of the world) has his truth at the
   band's floor 35 % of the time, and the ceiling promises about 4 points he
   will never reach. Prospects (headroom 11+) read fairer (mean 0.56). The
   best report's band is 1–2 points wide, so it reads as floor or ceiling
   (DEV-01e).
8. **Order for 2b.**
   - First, ECO-02 together with the renewal and ask curve (ECO-01/03), so a
     median career survives on every pool.
   - With it, DEV-01's growth contract, then BAL-02's presets.
   - Re-run these same 294 careers and the curves for the "after", against
     `CAREER_ARC` and the plan's bands.
9. **Caveats.** The bot does not negotiate signings, buy gear or bootcamps,
   answer the weekly inserts with their money options, or rotate lineups by
   form. A player can do better, but a hands-off manager should never go
   bankrupt in half of all Normal careers.
