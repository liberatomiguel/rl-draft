# Road to Worlds — implementation status & handoff

> **For the next session.** The career mode (design: `docs/ROAD-TO-WORLDS-DESIGN.md`,
> read the **v0.2 + v0.3 adjustment headers** first) is BUILT and playable
> end-to-end behind `FEATURES.careerMode` (`true`). v0.3 (Miguel's second
> playtest list) is implemented and committed on `staging`.
> Last updated: 2026-07-11 (v0.3 pass). Gates: `tsc` clean, **284 vitest
> tests**, golden-master locks the existing modes byte-identical.

## How to run / verify
- `npm run dev` → home has a "Road to Worlds" card; nav has a **Career** entry.
  `/career` → creation wizard → hub (HQ).
- `npm test` (284 green). Career-specific: `npx vitest run src/engine/career
  src/store/careerFlow.test.ts src/store/careerV03.test.ts src/engine/regression.golden.test.ts`.
- Kill switch: `FEATURES.careerMode = false` in `src/config/balance.ts`.

## v0.3 PASS (2026-07-11) — what changed on top of v0.2

Full narrative in CHANGELOG `[1.5.0-alpha]` → "v0.3 adjustment pass". Summary:

1. **Autoplay** — TopBar ▶/⏸ (primary) drives `advanceDay` on a timer
   (`CareerAutopilot` in the career layout, `CAREER_PLAYBACK.autoAdvanceDayMs`);
   pauses itself at stop states; "Skip ahead" = old batched advance. Training
   gained its own advance footer.
2. **Toasts** — `CareerToaster` + store queue mirrors fresh mail / priority-2+
   news after every action (bids, contract expiry, unavailability, unlocks,
   scrim results, window report).
3. **Scrims v2** — opponent shortlist + engine-truth benefit preview
   (`scrimShortlistFor` / `scrimProjection`), booking (`scheduleScrimFlow`,
   runs on day arrival, calendar-marked), per-game result log
   (`save.scrimLog`), same-day rematch guard (indexed streams
   `scrim:{s}:{d}:{n}`).
4. **Negotiation** — deterministic hidden reserve per (player, season, window)
   (`CAREER_NEGOTIATION`, `negotiationAccepts`); honest odds UI
   (`SalaryNegotiator`, used by Market sign + Squad renew); rejections harden
   +4%, 2 rejects → full ask only; counters tracked in
   `save.negotiationTries`.
5. **Rep-gated signings** — `signableOverallCap(rep)` (74 + 0.3·rep, free at
   84); locked rows visible in Market with the rep needed; coach hiring gated
   at rep 10 (`CAREER_UNLOCKS.coachRep`).
6. **Economy** — unified `marketValueFor` anchors ALL fees (AI↔AI band,
   AI bids ×1.0-1.35, user buys via bounded `contractedFeeFor`); prizes
   ×1.12^season, sponsors ×1.10^season; training weeklyBase 0.13 /
   headroomSoftK 2.5 / matchPrepShare 0.5 / floor4 quantization (the
   stagnation fix); early rep floor (regional swiss exit +1, unofficial
   finals +1).
7. **Living market** — needs pass shops lower-rated orgs (org↔org trades,
   `orgBuyChance` 0.4), scavenger pass drains the FA pool, bids land on ANY
   window day (`incomingBidForDay`, attractiveness-weighted targets incl.
   prospects), all moves logged to `save.transferLog` → HQ transfer-wire
   panel (region filter) + window-close report mail.
8. **Backer fix** — sales amortize 50% of the fee (`applyTransferIncome`),
   manual pay-down (`payDebtFlow` + Finances UI), "debt cleared" beat.
9. **Fictional players** — ALL fic/rook ids develop each rollover; wonderkid
   8%; headliner slots (10% → 77-84) at creation.
10. **Org sheets** (`OrgSheet`) — rosters viewable from standings, event
    lobby, deals tab, transfer wire.
11. **Wizard** — classic 22-tone palette (navy/gold/burgundy/ivory…; length
    22 is load-bearing for `contrastingSecondaryIndex`), +2 shapes
    (badge, banner), +4 symbols (lion, comet, anchor, trident), +2 patterns
    (sash, quarters).
12. **Save v3** (`migrateSaveToV3`; persist version 3): scheduledScrims,
    scrimLog, transferLog, negotiationTries, bid bookkeeping.
13. Mobile: scroll resets to top on route change (career layout effect).

## REMAINING / NEXT (post-v0.3)
- **Real player ages** (v0.1 item B — still open): add `born:` rows for
  modern-era players; `development.deriveBirthYear` stays the fallback.
- **Pacing harness** (`CAREER_ARC` bands) — the 120-career difficulty sweep is
  still to build. Re-validate economy bands after Miguel plays v0.3 (prize/
  sponsor growth + the value-anchored fees moved the whole money surface).
- **Perf watch**: the living market ~doubled per-season sim cost (full-season
  integration tests now run with explicit 20-30s timeouts; one bot season
  ≈ 3.5s). `aiWindowMoves` already memoizes views; next lever would be
  memoizing `playerViewById` per (world.version) globally.
- Balance watch: scrim chemistryCredit 0.05 / xpWeeks 0.5, poach daily rates,
  negotiation reserveFloor 0.88 — first guesses, need playtests.
- `upcomingStops` never emits kind "payday" (UI handles it defensively).
- Club "Edit crest" needs a store action for identity colors/crest re-edit
  (wizard-only today; `wizard.quickStartHint` still promises re-tinting).
- OrgMark procedural crests reshuffled cosmetically (palette hex swap + array
  length changes) — expected, cosmetic only.

## Guardrails (do not break)
- Engine pure/deterministic; randomness via `deriveSeed` streams; seed-stream
  ids are a compatibility surface (scrim streams gained an index suffix in
  v0.3 — additive).
- Every tunable in `balance.ts`; every string in `copy.career.en.ts` + `.pt.ts`
  (type-enforced parity).
- Existing modes byte-identical — `regression.golden.test.ts` is the tripwire.
- Saves migrate additively forever (`migrateSaveToV2` → `migrateSaveToV3`
  chain; persist version 3).
- `CREST_PALETTE` length (22) and existing crest/symbol/pattern ids are
  compatibility surfaces (procedural crests + saved crestIds).
