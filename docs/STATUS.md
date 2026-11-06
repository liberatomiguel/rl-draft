# Project Status — current state only

> Last updated: **2026-11-05**. History: `CHANGELOG.md`; plan of record:
> `ROADMAP.md`; this round: `ROADMAP-NEXT-2026-11-05.md`. Career map:
> `ROAD-TO-WORLDS-STATUS.md`.

## Where things are

- **Production:** `main` at v1.4.6, `rocketdraft.app`, assets-only Cloudflare
  static export. Season 1 is not approved for production.
- **Published candidate:** `staging`, **v2.0.0-rc.36.15** (RLCS 2027 rosters,
  draft edition tags, org logos/eras), career on, noindex, preview tools on,
  analytics off, `staging.rocketdraft.app`. Nothing ships to staging this
  round.
- **rc.37 (round 2):** `claude/rc37-integration`, **v2.0.0-rc.37**, from
  `origin/staging` rc.36.15 (`c680a89`). F1 market → F2 finance → F3 matchday
  → F4a battery tooling merged; F5 replay contract is docs only. Awaiting the
  battery report and Miguel's review: `HANDOFF-rc37-integration.md`.
- **Etapas 1–2:** built; Gate 2 still needs Miguel's play. ENG-03 real-save
  fixtures remain open.
- **Etapa 3 / Gate 3b:** integrated; progression/economy acceptance stays open
  until the battery report and Miguel's play. Regional timing, star
  affordability and historical Worlds titles are open (rc36-3/4/5 reports);
  infinite years do not satisfy the launch goal.

## rc.37 gates

- Typecheck and lint clean; full suite **1630 passed / 24 skipped** (154
  files). No build (not needed to integrate).
- **BALANCE_VERSION 14**, fingerprint `a7db5347`; package, lock and site on
  rc.37. Saves additive only; persist keys/versions frozen.
- F2's emergency sale honours F1's two-window resale lock and single
  valuation (R99, `careerRc37Integration.test.ts`). Every F1–F3 number is
  provisional until the battery.

## Battery: running, report pending

- Four shards from the integration worktree into
  `C:/Users/Miguel/CLAUDE/rc37-battery/run1`; command and resume rules:
  `src/store/auditHumanREADME.md`.
- 4,914 S10 controls (7 regions × 3 difficulties × 3 rosters × 39 profiles ×
  2 seeds), Worlds +0.5/+1 pairs on the 14 base profiles, S20 for titled
  tier-A controls. ~38–45 s per S10 career, ≈16 h on 4 processes.
- Until it ends, change no code under `src/{engine,config,data,lib,store}` in
  that worktree (resume refuses a changed simulation); docs are safe.
- `auditHumanSummary.mjs` reads only `shard-N.json`; the report needs a reader
  for the cohort JSONL.

## Open, in order

1. Battery report (funnel vs the 04/11 zip baseline), then **F6** tuning on
   the measured bottlenecks only.
2. Miguel's review of rc.37 and the handoffs' open points:
   - F1 10(a)–(g): wonderkid renewals at 2–6 % of market (probe: a developed
     90/98 at 1.3 %); u18 non-talents at 0.9; declineRate unpriced; decliners
     with pot > ovr −23 %; the readout reveals the reach gap; premium caps
     (−35 % at 95@rep-30); a floor ladder for developed players only?
   - F2 10(a)–(e): contract e2 kept (S4+ dominant season 1.56× three 85s'
     wages); emergency offers hold the clock; crisis bots sell at a discount;
     "next important income" = the first regional.
   - F3: the per-round briefing and the coach gate, in play.
3. **F5** (`RTW-REPLAY-CONTRACT.md`): approval before any code. Open: name,
   Academy age, ceiling/prize-share formula, order, rewards, real data.
4. Then Etapa 4, Etapa 5 and cutover (`ROADMAP.md`). Still Miguel's: event
   cards and Season Rating deltas (05/11 decisions 15–16).

## Still open before main

- Miguel's account/cutover actions: `V2-IMPLEMENTATION-PLAN.md` §6.
- Gate 3b progression/economy acceptance (the 05/11 decisions settled loan,
  wage budget, DEV-04 band and veteran roster).
- Etapa 4 collection/challenges/rewards; Etapa 5 integrated regression,
  accounts/sync, real saves, performance, EN/PT, launch notes and remaining art.
- Scripted historical news corpus remains partial; no partner-art blocker.
- Rerun opt-in matrices only when needed; never silently relax a release gate.

## Standing contracts

- Production saves stay on `https://rocketdraft.app`; staging is a separate
  origin. Persist versions/keys remain frozen; repairs are additive.
- Pure static export, assets-only Worker, no server code. Career routes stay
  noindex; production career enables only at the approved cutover.
- Supabase accounts are code-complete, not enabled in production. Analytics
  stays lazy, cookieless, EU and production-only. No hash-only asset churn.
