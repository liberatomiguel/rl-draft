# Road to Worlds — implementation status & handoff

> **For the next session.** The career mode is BUILT and playable end-to-end
> behind `FEATURES.careerMode` (env-driven: on in dev/tests, off in production
> builds unless `NEXT_PUBLIC_CAREER_MODE=1`), shipped on `staging` through
> **v1.5.0-alpha.2** (the v0.3 pass). This file is **current-state + remaining
> work**. The other career docs:
> - **Spec of record:** `ROAD-TO-WORLDS-DESIGN.md` (read the v0.1/v0.2/v0.3
>   adjustment headers first).
> - **Decisions log (why):** `ROAD-TO-WORLDS-DECISIONS.md` (R1–R19) — kept
>   SEPARATE from the draft game's `DESIGN-DECISIONS.md`.
> - **Per-version narrative:** `CHANGELOG.md` `[1.5.0-alpha]`.
>
> Last updated: 2026-07-11 (v0.3 pass). Gates: `tsc` clean, **284 vitest
> tests**, golden-master locks the existing draft modes byte-identical.

## How to run / verify
- `npm run dev` → home has a "Road to Worlds" card; nav has a **Career** entry.
  `/career` → creation wizard → hub (HQ).
- `npm test` (385 green). Career-specific: `npx vitest run src/engine/career
  src/store/careerFlow.test.ts src/store/careerV03.test.ts src/engine/regression.golden.test.ts`.
- **Flag (env-driven, R19):** `FEATURES.careerMode = NODE_ENV !== "production" ||
  NEXT_PUBLIC_CAREER_MODE === "1"` in `src/config/balance.ts`.
  - **Dev and tests:** always on.
  - **Production builds:** off unless `NEXT_PUBLIC_CAREER_MODE=1` is set at *build*
    time — inline, for a local preview build only (`NEXT_PUBLIC_CAREER_MODE=1 npm run
    build`). Never in `.env*` files or the production Worker's build variables (that
    ships the alpha on rocketdraft.app); a shareable preview needs a separate staging
    Worker (DEPLOY-CLOUDFLARE §5). Off hides the home card and nav entries.
  - **Flag off in a build:** the server `src/app/career/layout.tsx` returns
    `notFound()`, and `scripts/postexport.mjs` deletes `out/career*` (it fails
    instead if the home page still links `/career`). The routes are not shipped at
    all.
  - **`/career` is always `noindex, nofollow`**, even with the flag on, while the mode
    is alpha.
  - Preview career on a static build: `NEXT_PUBLIC_CAREER_MODE=1 npm run build`, then
    `npm run preview:static`.

## What's BUILT (the whole mode, v0.1 → v0.3)

Everything below is implemented, tested and on `staging`.

**Core loop & world**
- 5-step creation wizard (identity → crest/colors → region → starter roster →
  difficulty/style) + quick-start; "Found [ORG]" splash.
- Deterministic 7-region AI world from the dataset (`buildWorldAtCreation`),
  every region padded to 16 orgs with procedural fillers; free-agent pool.
- **Day clock** (`clock={seasonIndex,day}`, 224 days/season, real calendar
  dates): weekly world tick on Mondays, training Mon-Fri, matchdays Saturday.
  `processDayArrival` is the heart; `advanceDayFlow` / `advanceToNextStopFlow`.
- 6 config-identical seasons (RLCS X → 2026) → endgame (credits / Final
  Whistle / Insolvency) + minimal infinite mode.

**Competition** — regionals/Majors/Worlds on the shipped Swiss+DE formats via
`simulateSeries`; Season Points + slot tables + Major/Worlds qualification;
t3 Community Cup + t2 Invitational unofficials; roster-stability penalty on
fielded new faces; the career playback suite (`CareerEventScreen`,
`CareerMatchCenter`, live standings/bracket, goal-by-goal, AI ticker,
speed/skip/sim, instant→digest).

**Players & development** — CareerPlayer layer (age, potential band, archetype
offsets) derived from real trajectories; daily training ticks with
focus/intensity, coach + gear multipliers, truthful engine projections;
season-rollover aging/decline/retirement; match XP scaled by field quality;
AI world development (anchored reals snap to real cards, off-anchor + all
fictional ids develop each rollover). Scout reports + potential bands.

**Economy & market** — garage-org rescale (budgets 20k/12k/8k); salary curve,
one unified `marketValueFor` for every fee, per-season prize (×1.12) + sponsor
(×1.10) growth; gear/staff ladder + coach market (real retired pros); sponsors
with objectives/patience/perks; reputation ratchet (+ early floor) gating the
unlock ladder; Emergency Backer (one rescue, now repayable). AI transfer
windows: anchor drift + needs pass with **org↔org fee trades** + scavenger
pass; daily incoming bids for user players (targets stars AND prospects);
scripted-beat transfers. Salary **negotiation** (hidden reserve, honest odds).

**UX** — persistent TopBar with the **▶/⏸ autoplay** as the primary control +
"skip ahead"; HQ (NOW hero, week strip, quick actions, the news wire, the
**transfer wire** panel, season goal, points race, budget, inbox, next
unlock); Calendar (month grid, scrim markers, day detail); Squad; Training
(sparring partners + advance footer); Market (search/sort **with direction
toggle**, rep-locked rows, coaches gate, negotiation modal); Finances (gear
ladder, sponsor cards, Backer pay-down); Standings; Inbox (mail); Club; **org
sheets** (any AI roster) from standings/lobby/deals/wire; **career toast
layer** narrating mail/priority news; mobile scroll-reset on route change.
Crest builder: 22-tone classic palette, 14 shapes, 18 symbols, 7 patterns.

**Persistence** — `careerStore` (3 slots, persist v3); additive save migration
`migrateSaveToV2` → `migrateSaveToV3`; `save.mail` / `news` / `transferLog` /
`scrimLog` ring buffers; scheduled scrims + negotiation/bid bookkeeping.

## Latest pass — v0.3 (2026-07-11)

Miguel's second playtest list; full detail in CHANGELOG + `ROAD-TO-WORLDS-DECISIONS.md`
R13–R18. Headline changes: FIFA-style day **autoplay** + **toasts**; **scrims
v2** (schedule/opponent/results); salary **negotiation**; visible **rep cap**
on signings + coach gate at rep 10; **unified fee value** + prize/sponsor
escalation; **living market** (org↔org trades, scavenger, daily bids); **Backer
debt** repayable; fictional players fully develop; **org sheets** + **transfer
wire**; market sort direction; mobile scroll reset; classic crest palette +
new shapes/symbols/patterns. Training **anti-stagnation** (the "players stop
growing" root cause was a 2-decimal quantization bug, fixed to 4 decimals).
New engine/store test file `careerV03.test.ts` (19 cases).

## REMAINING / NEXT (what still needs doing)

**Content (biggest asks — Miguel-owned):**
- **Scripted beats** — the ~30 hand-written flagship beats (EN+PT) for launch
  is only partially seeded; the world's liveliness rides on the template layer
  until then.
- **`born:` rows** for the ~150–200 modern-era players (ages are inferred via
  `development.deriveBirthYear` today) + the §21.13 PT glossary tone pass.
- Filler-org identities / name-bank / sponsor-brand growth as regions fill out.

**Validation (should run before any launch call):**
- **`CAREER_ARC` pacing harness** — the 120-career difficulty sweep is NOT
  built. v0.3 moved the whole money surface (value-anchored fees + prize/
  sponsor escalation), so the economy bands need a fresh Monte-Carlo pass.
- **Balance watch (first-guess tunables):** scrim chemistryCredit 0.05 /
  xpWeeks 0.5, the daily-poach rates, negotiation reserveFloor 0.88, the
  filler headliner band 77–84 — all need playtest confirmation.

**Engineering follow-ups:**
- **Perf:** the livelier market ~doubled per-season sim cost (bot season
  ~1.3s → ~3.5s; full-season integration tests now carry explicit 20–30s
  timeouts). `aiWindowMoves` memoizes views per pass; the next lever is a
  global `playerViewById` memo keyed on `world.version`.
- **Club "Edit crest"** — colors/crest are wizard-only today; a store action is
  needed (the wizard copy already promises "re-tint colors later").
- `upcomingStops` never emits kind `"payday"` (UI handles it defensively).

**Deferred by design (telegraphed where visible):** org relocation · t1 Circuit
LAN · negotiation sliders/counter-rounds · transfer-listing UI · Quick playback
digest · spectate broadcast · additional random-event families · beats beyond
the floor.

## Guardrails (do not break)
- Engine pure/deterministic; randomness via `deriveSeed` streams; seed-stream
  ids are a compatibility surface (scrim streams gained an index suffix in
  v0.3 — additive only).
- Every tunable in `balance.ts` (`CAREER_*`); every player-facing string in
  `copy.career.en.ts` + `.pt.ts` (type-enforced parity), read **only** through
  `useCareerCopy()` / `getCareerCopy()` (`src/content/careerCopy.ts`).
  `useCopy().CAREER` no longer exists, so career strings stay out of the core copy
  chunk every page loads. The 4 home-card strings are core copy (`HOME.career*`).
  Beat/news-template content is co-located EN+PT in the data files, not copy.
- Existing draft modes byte-identical — `regression.golden.test.ts` is the
  tripwire; career results never flow through `applyRunResults`.
- Saves migrate additively FOREVER (`migrateSaveToV2` → `migrateSaveToV3`;
  persist version 3).
- `CREST_PALETTE` length (22) and existing crest/symbol/pattern ids are
  compatibility surfaces (procedural filler crests index by hash; saved
  crestIds must keep parsing).
- **Career-mode decisions go in `ROAD-TO-WORLDS-DECISIONS.md` (R#), never the
  draft game's `DESIGN-DECISIONS.md`.**
