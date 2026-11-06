# rc.37 integration handoff (`claude/rc37-integration`)

1. **Base**: `origin/staging` rc.36.15 (`c680a89`), not local `staging` (`ae0ff80`, 5 commits behind), so rc.36.11–15 (RLCS 2027 rosters, draft edition tags, NEW marker, org logos/eras), made on staging while the fronts ran, are kept. Local `staging` and the front worktrees untouched. Nothing pushed or published: staging stays rc.36.15.
2. **Merges** (all textually clean): F1 `claude/rc37-market` `e0cda5a` (84ac30c) → F2 `claude/rc37-finance` `13d4fa7` (a8cccf2) → F3 `claude/rc37-matchday` `63bedf5` (2b5af01) → F4a `claude/rc37-battery@3a94ccd` (8ca3a2f) → F5 `23a8c9f` as docs only (ce46c60: `RTW-REPLAY-CONTRACT.md`, `HANDOFF-rc37-F5.md`; not implemented).
3. **Integration code**:
   - `045d854`: F2's emergency sale honours F1's resale lock (`market.resaleLocked(p, seasonIndex, day)`: the signing window and the next, not rc.35's same window) and prices on F1's single valuation (`valueInputOf` + the career's growth model), in `engine/career/emergencySale.ts` and `careerFlow.rollEmergencySale` (R99). New `store/careerRc37Integration.test.ts` (3 cases).
   - Same commit: the battery bot on F2/F3 and the cohort runner; BALANCE_VERSION 13 → 14 (fingerprint `a7db5347`); 2.0.0-rc.37 (package, lock, site).
   - `2c21114` + `0d92803`: line-ending-proof simulation hash for resume.
4. **Gates**: typecheck and lint clean; full suite 1630 passed / 24 skipped (154 files). No build (nothing ships this round).
5. **Battery**: running, report pending. 4 shards, `HUMAN_AUDIT=1 HUMAN_MODE=matrix HUMAN_SHARDS=4 HUMAN_SHARD=i HUMAN_DIR=C:/Users/Miguel/CLAUDE/rc37-battery/run1 node node_modules/vitest/vitest.mjs run src/store/auditHuman.test.ts`. 4,914 S10 controls (tiers A–D), Worlds +0.5/+1 pairs on A/B, S20 for titled tier-A controls; ~38–45 s per S10 career, ≈16 h. Usage and resume rules: `src/store/auditHumanREADME.md`.
   - Until it ends, change no `.ts/.tsx/.json/.mjs` under `src/engine|config|data|lib|store` in this worktree (resume hash). Docs are safe.
   - `auditHumanSummary.mjs` reads only `shard-N.json`; the report needs a reader for `shard-N.jsonl` (the summary is outside the hash).
6. **Docs**: CHANGELOG rc.37 entry, STATUS, ROAD-TO-WORLDS-DECISIONS R99, `auditHumanREADME.md`, this file.
7. **For Miguel**:
   - (a) The F1/F2/F3 diffs and their open points: F1 10(a)–(g), F2 10(a)–(e) (listed in STATUS), F3's per-round briefing and coach gate in play.
   - (b) R99: a red balance never sells a signing inside the two-window lock; the first legal emergency offer comes two windows after the signing (~68 % of value in the probe).
   - (c) The F5 contract, before any code: name, Academy age, ceiling/prize-share formula, order, rewards, real data.
   - (d) The battery report, then F6's scope (only the measured bottlenecks).
