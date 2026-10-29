# Module audit — rc.32 (ENG-01)

> The inventory of every module: its job, persistence, tests, findings and
> status, audited in eight packages (ROADMAP Etapa 2a, ENG-01). Audited on
> `staging` at **rc.31 (`a187654`)** plus front C's rc.32 commits; the economy,
> growth and age-clock modules are being rewritten by fronts A and B right
> now, so their findings are read against rc.31 and marked **for the rc.32
> integration**. Hand-maintained: update a row when its module changes.
>
> **Severity** (ROADMAP's scale): **P0** integrity — saves, money, softlocks,
> impossible states; **P1** a visible wrong result or a 2.0 redesign item;
> **P2** a real defect with a narrow case or a workaround; **P3** hygiene — a
> tunable outside `balance.ts`, a missing direct test, a stale comment.
> **Status:** ok · listed (P2/P3, not scheduled) · rc.32 integration (the
> owning front fixes it in this rc) · Miguel (needs a decision).
> **Tests** name the test files that import the module directly; a dash means
> it is covered only through its callers.

## Summary

| Package | Modules | Findings (P0 / P1 / P2 / P3) | Closed by | 
| --- | --- | --- | --- |
| Data | 14 | 0 / 0 / 0 / 6 | `7beb72e` |
| Shared engine | 33 | 0 / 0 / 0 / 4 | `a187654` |
| Stores and sync | 18 | 0 / 0 / 1 / 4 | `849c4d0` |
| Economy | 2 | 1 / 3 / 0 / 1 | `a187654` |
| Growth | 1 | 0 / 2 / 0 / 1 | `a187654` |
| Calendar | 11 | 0 / 2 / 1 / 3 | `7beb72e` |
| UI | 164 | 0 / 0 / 1 / 2 | `a187654` |
| Export, perf and SEO | 15 | 0 / 0 / 1 / 3 | `a187654` |

Every P0 and P1 sits in the economy, growth and calendar packages (fronts A
and B, or Miguel's call). Front C fixed nothing there; in its own packages
(data, stores and sync, analytics) it found nothing at P0 or P1, so it
changed no behaviour beyond the OBS-01 build. One bug in that build was
caught and fixed before its commit: a national card found in the first offer
of a run read as owned before the run (`runStore.startRun` now stamps
`startedAt` before the first offer).

**For Miguel:** C-1. R31 keeps 16 orgs a region and an entrant needs a
filler's seat, so EU (no filler at creation), most of SAM and part of NA
never see their later scene: Karmine Corp, the example R31 cites, never
enters a career. Options: (a) an org with no lineup that season or later
yields its seat to an entrant (history-faithful: a defunct org leaves); (b)
let a region grow past 16 (an engine-contract change: fields and Majors read
the top 16); (c) keep it as it is and say so in R31.

## Data — the dataset and its gates

**Closed by:** `7beb72e` (DATA-01: the report + the flow-level era test). **Evidence:** `npm run validate:data` (45 + 1 opt-in skipped); `cardAliases` + `chemistry` + `careerOrgEntry` tests: 62 passed; `DATA-AUDIT-rc32.md` regenerated; no production id lost (only the 6 D01 renames, aliased).

| Module | Job | Persistence | Tests | Findings | Status |
| --- | --- | --- | --- | --- | --- |
| `data/career/achievements.ts` | Road to Worlds — permanent career achievements (v2.0, R32). | — | achievements, careerStore.achievements | — | ok |
| `data/career/beats.ts` | Road to Worlds — scripted historical beats (hand-maintained, like specialCards.json). | — | careerEco03 | — | ok |
| `data/career/inserts.ts` | Road to Worlds — WEEKLY INSERTS (v2.0, R33): small mid-week decisions that break the "skip to the next tournament"… | — | careerClosed | — | ok |
| `data/career/names.ts` | Road to Worlds — fictional name banks (career-only data). | — | calendar, development, localScene +2 | — | ok |
| `data/career/sponsors.ts` | Road to Worlds — fictional sponsor brands (career-only data). | — | — | D-4 P3 | listed |
| `data/catalog.ts` | Light catalog (rc.26, #60): the lookups the SHARED path needs — the root layout (profile store, achievement toasts,… | — | integrity | — | ok |
| `data/cosmetics.ts` | Cosmetics catalog (v2.0 · rc.20: the FINAL Season 1 set) — titles, badges and profile banners. | — | cosmetics, cosmeticUnlocks.playtest | — | ok |
| `data/counts.ts` | Light dataset totals for the shared path (home denominators), national-id test. | — | — | — | ok |
| `data/index.ts` | Runtime data layer: typed casts of the JSON, lookup maps, derived national cards, career history per player. | — | ChallengeScreen.names, dataAudit.report, integrity +24 | D-1 P3 · D-2 P3 · D-3 P3 | listed |
| `data/previewLeaderboard.ts` | Preview leaderboard fixture (rc.2) — DEV / STAGING ONLY (`FEATURES.previewTools`). | — | — | D-5 P3 | listed |
| `data/schemas.ts` | Zod schemas for every JSON file (build/CI only). | — | — | — | ok |
| `data/validate.ts` | Dataset validation — schema + referential integrity (build/CI time only). | — | integrity | — | ok |
| `scripts/build-dataset.mjs` | The generator: `teams.md` → the JSONs (identity de-dup, era aliases, derived strengths). | — | via `validate:data` | — | ok |
| `generated/asset-manifest.json` | Which art exists in production (written by `build:images`). | — | `cosmetics.test.ts`, postexport | D-6 P3 | listed |

Findings:

- **D-1 (P3)** 5 overall swings over 8 points between consecutive seasons (ajg, caard, kuxir97, luk, marcby8) — curation candidates in `teams.md` (DATA-AUDIT §Anomalies).
- **D-2 (P3)** 230 of 594 players have no birthday, so the career infers their age (`development.ts:203` `deriveBirthYear`).
- **D-3 (P3)** Thin playable pools in some era × region cells (e.g. MENA and OCE 2022-23: 3) — fillers complete career fields; Region-only Draft modes read the same pools (DATA-AUDIT §Era × region).
- **D-4 (P3)** No direct test (fictional brand list; read through the sponsor offers).
- **D-5 (P3)** Bundled in every build; gated at runtime by `FEATURES.previewTools` (dev / staging).
- **D-6 (P3)** A local `npm run build` rewrites badge/banner hashes here (platform rasterization) — never commit hash-only changes (STATUS).

## Shared engine — the Draft game's rules, tuning and helpers

**Closed by:** `a187654` (rc.31, audited, nothing to fix) + `849c4d0` (`BALANCE_VERSION` + its fingerprint test). **Evidence:** `npx vitest run src/engine --exclude 'src/engine/career/**' src/config src/lib/{rng,daily,runLabels,loginCalendar}`: 255 passed (+2 opt-in); the golden master (`regression.golden.test.ts`) and the design anchors (`balance.test.ts`, `match.test.ts`) green.

| Module | Job | Persistence | Tests | Findings | Status |
| --- | --- | --- | --- | --- | --- |
| `config/balance.ts` | BALANCE CONFIG — every tunable number in the game lives here. | — | careerUi.weekend, clockPlayback, lobbyField +40 | — | ok |
| `config/season.ts` | Season calendar constant (Season 1 id and dates). | — | season, profileSync, persistContract | E-3 P3 | listed |
| `config/site.ts` | Site constants: domain, version (= package.json), credits, links. | — | — | E-3 P3 | listed |
| `engine/achievements.ts` | Achievement evaluation (v1.4 — rebuilt around Miguel's set, grouped by theme). | — | achievements | — | ok |
| `engine/cards.ts` | Card resolution — turns raw data references into display-ready card views. | — | dataAudit.report, cardAliases, cards +7 | — | ok |
| `engine/challenges.ts` | Challenges (v1.4) — rank-unlocked authored puzzles. | — | ChallengeScreen.names, challenges, challenges.tune +4 | — | ok |
| `engine/challengeStars.ts` | Challenge stars (v2.0): the bit masks a profile stores per challenge and the counts read from them. | — | — | E-4 P3 | listed |
| `engine/chemistry.ts` | Chemistry system (base doc §22; reworked to ADDITIVE in v1.4). | — | dataAudit.report, chemistry | — | ok |
| `engine/cosmetics.ts` | Cosmetics (v2.0) — pure derivation of what a profile OWNS and what it SHOWS. | — | cosmetics, profileSync | E-2 P3 | listed |
| `engine/counterAchievements.ts` | Lifetime counter / collection / rank achievements (v1.4), evaluated against the PROFILE after a run's results are… | — | achievements | — | ok |
| `engine/draft.ts` | Draft state machine (base doc §4-§6, revised in v0.2, v0.5). | — | challenges, challenges.tune, difficulty.matrix +10 | — | ok |
| `engine/match.ts` | Match simulation (base doc §25). | — | matchTimeline, match, matchVariety +1 | E-1 P3 | listed |
| `engine/missions.ts` | Missions + login streak (v2.0) — pure engine. | — | missions, profileSync | E-2 P3 | listed |
| `engine/opponents.ts` | Tournament opponent generation (base doc §26). | — | national, regional | — | ok |
| `engine/playoffs.ts` | Playoffs (v0.2): 8 teams, DOUBLE ELIMINATION, Bo7, plus a dedicated third-place series between the lower-bracket… | — | regression.golden | — | ok |
| `engine/progression.ts` | Rank progression — XP thresholds → Rocket League inspired ranks. | — | progression | — | ok |
| `engine/quiz.ts` | Daily Quiz — "Guess the Player" (v2.0). | — | quiz | — | ok |
| `engine/quizState.ts` | Daily Quiz — the player's side (v2.0): puzzle/result types, guesses, the day fold and the cloud merge. | — | quiz, profileSync | — | ok |
| `engine/rating.ts` | Team rating (base doc §18). | — | challenges, challenges.tune, difficulty.matrix +1 | — | ok |
| `engine/results.ts` | Run results compilation: placement, highlights, special unlocks, achievements and the XP breakdown (base doc §27, §30). | — | results.labels, tournament | — | ok |
| `engine/season.ts` | Seasons (v2.0) — pure helpers that move a profile across season resets. | — | cosmetics, season, profileSync +1 | E-2 P3 | listed |
| `engine/statEffects.ts` | What each attribute actually does in the match sim (v2.0, career R28) — the same SIMULATION constants `match.ts`… | — | — | E-4 P3 | listed |
| `engine/swiss.ts` | Swiss stage (base doc §24): 16 teams, Bo5, 3 wins advance / 3 losses out, max 5 rounds. | — | weekendView, TournamentScreen.spoiler, careerResults +3 | — | ok |
| `engine/teams.ts` | Team assembly — converts a user roster or a historical lineup into a TournamentTeam (rating + chemistry +… | — | ChallengeScreen.names, cardAliases, challenges +8 | E-1 P3 | listed |
| `engine/tournament.ts` | Tournament orchestration: Swiss stage → playoffs → finished. | — | balance, careerResults, difficulty.matrix +5 | — | ok |
| `engine/types.ts` | Core domain types for Rocket Draft. | — | CareerMatchCenter, clockPlayback, ChallengeScreen.names +40 | — | ok |
| `lib/daily.ts` | Daily Challenge generator. | — | daily | — | ok |
| `lib/dailyPlan.ts` | Daily Challenge — the date half (rc.26, #60). | — | daily, runLabels | — | ok |
| `lib/format.ts` | Shared display formatters (Road to Worlds, v1.5). | — | — | E-4 P3 | listed |
| `lib/loginCalendar.ts` | The login calendar's focus for a streak (rc.29, E2E DRAFT-03): today's cell, the next milestone day, and the days… | — | loginCalendar | — | ok |
| `lib/rng.ts` | Seedable deterministic RNG (mulberry32). | — | ChallengeScreen.names, TournamentScreen.spoiler, balance +22 | — | ok |
| `lib/runLabels.ts` | Draft-run labels in the active language (rc.29, E2E DRAFT-10). | — | results.labels, runLabels | — | ok |
| `lib/util.ts` | Small shared helpers (cx, clamp, uid, country names). | — | — | E-4 P3 | listed |

Findings:

- **E-1 (P3)** Shared-sim multipliers inline, outside `balance.ts`: `match.ts:100-102` (×0.4), `teams.ts:173,181` (org ×1.0, coach ×2.0). The golden master locks them; moving them is a no-op refactor.
- **E-2 (P3)** Clock defaults in engine signatures (`now = new Date()`): `missions.ts:194-374`, `season.ts:84-170`, `cosmetics.ts:270` — injectable, deterministic when callers pass `now`.
- **E-3 (P3)** Stale `TODO(launch)` (`site.ts:7`: both links are set); `season.ts:22` `TODO(Miguel)`: the real season dates.
- **E-4 (P3)** No direct unit test (covered through its callers).

## Stores and sync — persistence, cloud sync, analytics

**Closed by:** `849c4d0` (OBS-01: the analytics catalogue and the persist wrappers). **Evidence:** the store / lib suites (persist contract, account sync, profile merge, Supabase client, analytics, career + Draft analytics, lazy run store, overlay holds, reveal store, the closed-career guard, the save repair): 198 passed. Persist keys and versions unchanged (contract test).

| Module | Job | Persistence | Tests | Findings | Status |
| --- | --- | --- | --- | --- | --- |
| `lib/analytics.ts` | Game-event analytics (OBS-01) — the typed catalogue of `docs/ANALYTICS-EVENTS-2.0.md`, sent to PostHog product… | — | analytics, careerAnalytics, careerClosed +4 | — | ok |
| `lib/profileSync.ts` | Profile sync — pure merge logic (v1.4). | — | profileSync, accountStore | — | ok |
| `lib/supabase.ts` | Supabase accounts + cloud sync + leaderboards (v1.4) — client wrapper. | Supabase (auth in localStorage) | supabase, accountStore | — | ok |
| `store/accountStore.ts` | Account session state (v1.4) — one shared place for "am I signed in, who am I, am I syncing". | reads the profile key | accountStore | — | ok |
| `store/achievementToastStore.ts` | Global achievement-toast queue (v1.4). | — | — | — | ok |
| `store/careerAnalytics.ts` | Road to Worlds analytics (OBS-01, DESIGN-DECISIONS #145) — the career events of `docs/ANALYTICS-EVENTS-2.0.md`,… | — | careerAnalytics | — | ok |
| `store/careerArcBot.ts` | Road to Worlds — the long-career bot manager (rc.30, ROADMAP Etapa 2a OBS-02). | — | careerArc, careerEconomy.probe | — | ok |
| `store/careerRevealStore.ts` | Road to Worlds v2.0 (R40 review) — session-only reveal state, never in the save. | sessionStorage | careerRevealStore | — | ok |
| `store/careerStore.ts` | Road to Worlds — the career store (v1.5). | `rocket-draft:career:v1` | careerAnalytics, careerClosed, careerEco02 +3 | S-1 P2 · S-3 P3 · S-4 P3 | listed |
| `store/cosmeticUnlockStore.ts` | Cosmetic unlock queue (rc.20): the ids of titles / badges / banners the player just earned, in order. | — | cosmeticUnlocks.playtest | — | ok |
| `store/lazyRunStore.ts` | Lazy access to the run store (rc.26, #60). | reads the run key | lazyRunStore | — | ok |
| `store/overlayHoldStore.ts` | Overlay holds (rc.29, E2E DRAFT-02 / DRAFT-13): while a full-screen moment is in front, the quieter pop-ups behind… | — | overlayHoldStore | — | ok |
| `store/persistStorage.ts` | OBS-01 quality events for the four persisted stores (#145): `quality_save_error` (a write that failed — the quota —… | the four keys' storage | draftAnalytics | S-2 P3 | listed |
| `store/profileStore.ts` | Persistent player profile: XP, wins, collection, achievements, run history. | `rocket-draft:profile:v1` | accountStore, careerStore.achievements, cosmeticUnlocks.playtest +6 | S-1 P2 · S-5 P3 | listed |
| `store/rewardToastStore.ts` | Generic reward toasts (v2.0): missions completed, the all-three bonus, login streak XP, quiz solves. | — | runStore.national | — | ok |
| `store/runStore.ts` | Active run store — the state machine for one game: setup → draft → review → tournament → results. | `rocket-draft:run:v1` | draftAnalytics, lazyRunStore, persistContract +3 | S-1 P2 · S-2 P3 | listed |
| `store/settingsStore.ts` | Player settings (v1.0): sound, visual effects, animation speed, language. | `rocket-draft:settings:v1` | persistContract | — | ok |
| `store/useMounted.ts` | SSR gate: persisted state renders after the first client mount. | — | — | — | ok |

Findings:

- **S-1 (P2)** Two tabs, guest player: the profile, run and career stores never rehydrate on a `storage` event (the only listener is `supabase.ts:136`), so a stale tab's next write overwrites the other tab's progress. Signed-in players are covered (the sync folds stored progress, `accountStore.ts:188-196`). Fix sketch: rehydrate the profile on its key's `storage` event (quiet unlocks); mark a run / career tab stale.
- **S-2 (P3)** A failed localStorage write (quota) throws out of the action after memory changed (zustand writes synchronously); `runStore.finishRun` then re-applies the run in memory on a retry (nothing persists). Now reported as `quality_save_error` (#145). Quota risk is low: a career save peaks near 300 KB, three slots under 1 MB.
- **S-3 (P3)** Every career write serializes the whole store (three slots, up to ~1 MB); the autopilot pays it each day tick.
- **S-4 (P3)** `createCareer` overwrites an occupied slot if asked (the wizard always picks an empty one).
- **S-5 (P3)** The privacy text still names Vercel Web Analytics, removed in v1.4 (`copy.en.ts:836` and its PT twin): name PostHog only, and the career events at launch.

## Economy — money, the market (audited at rc.31; front A rewrites it now)

**Closed by:** `a187654` (rc.31, audited read-only: every finding is for the rc.32 integration). **Evidence:** `economy.test.ts`, `careerEco02`, `careerEco03`, `careerV03`, `careerV2`: 107 passed; the money probe `CAREER_ECON=1` (ECONOMY-CONTRACT §8, rc.31, not re-run here).

| Module | Job | Persistence | Tests | Findings | Status |
| --- | --- | --- | --- | --- | --- |
| `engine/career/economy.ts` | Road to Worlds — economy leaf functions (design doc §9). | — | lobbyField, weekendView, careerResults +9 | X-1 P0 · X-3 P1 · X-5 P1 · X-6 P3 | rc.32 integration |
| `engine/career/market.ts` | Road to Worlds — the transfer market + AI world roster moves (design §10). | — | careerDev02, careerEco03, careerEconomy.probe +2 | X-4 P1 · X-6 P3 | rc.32 integration |

Findings:

- **X-1 (P0)** Newcomers go broke: 76 % of Normal careers end insolvent on rc.31 (founders ~$500 a week against ~$19 guaranteed); the Backer buys 4–5 weeks (`weeklyPayroll`, `economy.ts:772`; ECONOMY-CONTRACT §4a, §8). For the rc.32 integration.
- **X-3 (P1)** The money streams drift: by season 7 asks ×1.72 and prizes ×2.21 while the fanbase, Backer, bank and prices stay ×1.00 (§4b). For the rc.32 integration.
- **X-4 (P1)** Renewal shock: developed founders renew at ×2.9 (`renewalAskFor`, `market.ts:194`; §4d, §8). For the rc.32 integration.
- **X-5 (P1)** NA and EU careers end insolvent in 100 % of runs on every difficulty (§4f). For the rc.32 integration.
- **X-6 (P3)** Tunables inline: the rep tier width (`economy.ts:58-59`, rep / 20), fallback ratings (`market.ts:292` 70 + prestige × 6, `:471` 70).

## Growth — development, potential, scouting, ages (audited at rc.31; fronts A/B rewrite it now)

**Closed by:** `a187654` (rc.31, audited read-only: every finding is for the rc.32 integration). **Evidence:** `development.test.ts`, `careerDev02`, `careerNames`: 62 passed; the curves `CAREER_CURVES=1` (baseline `CAREER-BASELINE-rc30.md`).

| Module | Job | Persistence | Tests | Findings | Status |
| --- | --- | --- | --- | --- | --- |
| `engine/career/development.ts` | Road to Worlds — player development & derivation (design doc §8). | — | development, national, careerAnalytics +10 | G-1 P1 · G-2 P3 · G-3 P1 | rc.32 integration |

Findings:

- **G-1 (P1)** Ages jump two years at the 2022-23 → 2024 rollover: `seasonYear` (`development.ts:171-177`) maps 2022-23 → 2022 and 2024 → 2024, and `ageOf` (`:179-181`) reads it (Miguel's bug (a)); re-check R48's retirement rule with the fix. For the rc.32 integration (front A, age clock).
- **G-2 (P3)** Archetype attribute offsets inline (`development.ts:74-78`), outside `balance.ts`.
- **G-3 (P1)** DEV-01 (growth) is the open 2b package: the shown band, the ETA and the curves are re-measured on the same seeds (front B). For the rc.32 integration.

## Calendar — the career season, events, fields, standings, the world

**Closed by:** `7beb72e` (DATA-01's flow-level era test) — the findings are reported, not changed. **Evidence:** `calendar`, `careerResults`, `raceTable`, `worldSim`, `localScene`, `matchTimeline`, `achievements` engine tests + `careerWeekend`, `careerRace`, `careerFlow`, `careerArc` (smoke): 167 passed (+4 opt-in); `careerOrgEntry.test.ts`.

| Module | Job | Persistence | Tests | Findings | Status |
| --- | --- | --- | --- | --- | --- |
| `engine/career/achievements.ts` | Road to Worlds — career achievement evaluation (v2.0, R32). | — | achievements, careerStore.achievements | — | ok |
| `engine/career/calendar.ts` | Road to Worlds — the season clock (design doc §7). | — | careerUi.weekend, lobbyField, weekendView +16 | — | ok |
| `engine/career/careerResults.ts` | Road to Worlds — placements, points, qualification, roster stability and grades (design doc §7 "Points &… | — | careerResults, raceTable, worldSim +2 | C-5 P3 | listed |
| `engine/career/inserts.ts` | Road to Worlds — insert rolling (v2.0, R33). | — | careerV2 | — | ok |
| `engine/career/localScene.ts` | Road to Worlds — the LOCAL AMATEUR SCENE (v2.0, R23). | — | lobbyField, careerResults, localScene +5 | — | ok |
| `engine/career/matchTimeline.ts` | Road to Worlds — the Match Center goal timeline (GAME-04, R41). | — | CareerMatchCenter, clockPlayback, matchTimeline | — | ok |
| `engine/career/raceTable.ts` | Road to Worlds — the two race tables (RTW-01, R49), per region: - the MAJOR table: that split's regional points… | — | raceTable, careerRace | — | ok |
| `engine/career/seeds.ts` | Road to Worlds — deterministic seed derivation (design doc §13). | — | lobbyField, calendar, careerResults +1 | — | ok |
| `engine/career/types.ts` | Career domain types; the `CareerSave` shape (saveVersion 5). | — | careerUi.weekend, CareerMatchCenter, lobbyField +22 | — | ok |
| `engine/career/worldSim.ts` | Road to Worlds — world simulation (design doc §7 calendar sims, §10 living world, §12 filler world). | — | lobbyField, worldSim, careerArc +6 | C-1 P1 · C-2 P2 · C-4 P3 | Miguel |
| `store/careerFlow.ts` | Road to Worlds — the DAY machine (store-layer orchestration, v0.2). | — | careerUi.weekend, lobbyField, weekendView +16 | X-2 P1 · C-3 P3 | rc.32 integration |

Findings:

- **C-1 (P1)** Seat starvation: R31 keeps 16 orgs a region and an entrant takes a filler's seat; EU starts with 0 fillers (18 real Season X orgs), so none of its 23 later orgs ever enter (Karmine Corp — R31's own example — Gentle Mates, Oxygen…); SAM fits 3 of 31, NA 4 of 10 (`worldSim.ts:1856-1860`; DATA-AUDIT §Who finds a seat; `careerOrgEntry.test.ts`). Miguel to decide (below).
- **C-2 (P2)** Which entrant takes the last seats follows the dataset's file order, not strength (`worldSim.ts:1852-1860`): in SAM 2021-22, Team Secret is among the seven left out.
- **C-3 (P3)** Split weeks as literals: `careerFlow.ts:551` (3 / 13 / 23) and `:793` (11 / 21), duplicated from the calendar; `careerAnalytics.ts` derives them (`SPLIT_BOUNDARY_WEEKS`, pinned 11 / 21 / 31 by a test).
- **C-4 (P3)** Tunables in module constants: `worldSim.ts:144-153` (`FILLER_PRESTIGE_ONE_CHANCE` 0.15, `FA_POOL_CAP` 300, `COACH_BONUS_STRONG` 85).
- **C-5 (P3)** `eventResults` holds every region's compact results: ~140 KB of a season's ~300 KB save (archived at the rollover).
- **X-2 (P1)** The cash warning fires only at exactly `runwayWarnWeeks` (`careerFlow.ts:1243`, `runway ===`), so a renewal or a rescue jumps past it: 38 / 24 / 13 % of rescues were warned (§4a). For the rc.32 integration.

## UI — routes, screens, components, copy

**Closed by:** `a187654` (rc.31, audited; findings are P2/P3 for Etapa 5 or front E). **Evidence:** `npm run lint` 0 errors / 0 warnings (ESLint enforces `AppLink` over `next/link`); `npm run typecheck` (the PT copy is typed against EN: `PT: Copy`, `CAREER_PT: CareerCopy`); `npx vitest run src/components`: 62 passed. A scan of the `.tsx` for hard-coded text found only U-2.

| Module | Job | Persistence | Tests | Findings | Status |
| --- | --- | --- | --- | --- | --- |
| `app/achievements/AchievementsView.tsx` | Achievements album — discoverable straight from the home screen. | — | — | — | ok |
| `app/challenges/ChallengesView.tsx` | /challenges (v1.4) — the rank-unlocked puzzle grid. | — | — | — | ok |
| `app/changelog/ChangelogView.tsx` | Client view so the notes follow the EN/PT language switch (v1.1.0). | — | — | — | ok |
| `app/collection/CollectionView.tsx` | Collection album (special cards). | — | — | — | ok |
| `app/collection/NationalAlbum.tsx` | National-team album (v2.0) — the FIFAe national rosters, one crest per team, grouped by edition (newest first). | — | — | — | ok |
| `app/HomeMenu.tsx` | Home menu v3 (rc.2) — a bento with a real hierarchy. | — | — | — | ok |
| `app/how-to-play/HowToPlayView.tsx` | Rules explainer. | — | — | — | ok |
| `app/leaderboards/LeaderboardsView.tsx` | /leaderboards v2 (v2.0) — boards that show who people ARE, not just a number: every row carries the player's… | — | — | — | ok |
| `app/missions/MissionsView.tsx` | Missions page view (the daily and weekly panels). | — | — | — | ok |
| `app/play/PlayView.tsx` | /play — the run flow router. | — | — | — | ok |
| `app/privacy/PrivacyView.tsx` | Client view so the prose follows the EN/PT language switch (v1.1.0). | — | — | — | ok |
| `app/profile/page.tsx` | Profile v3 (rc.2): the screen that makes the player want the next reward. | — | — | — | ok |
| `app/quiz/QuizView.tsx` | /quiz (v2.0) — "Guess the Player". | — | — | — | ok |
| `app/settings/page.tsx` | Settings screen: sound, effects, animation speed, language. | — | — | — | ok |
| `components/career/screens/CalendarScreen.tsx` | Road to Worlds — Calendar (v0.2 day clock, FIFA-style month view). | — | — | — | ok |
| `components/career/screens/ClubScreen.tsx` | Road to Worlds — the Club dashboard: identity, reputation track, the Progression Track (design v0.1 — everything… | — | — | — | ok |
| `components/career/screens/EventScreen.tsx` | Road to Worlds — the EVENT screen (v0.2 full rebuild). | — | — | — | ok |
| `components/career/screens/FinancesScreen.tsx` | Road to Worlds — Finances (v0.2 rebuild): the org's financial dashboard. | — | — | — | ok |
| `components/career/screens/HubScreen.tsx` | v2.0 hub rebuild (R26), re-cut in rc.2: HQ is a day you can read at a glance. | — | — | — | ok |
| `components/career/screens/MarketScreen.tsx` | Road to Worlds — the transfer Market (v0.2 rebuild, day clock). | — | — | — | ok |
| `components/career/screens/NewsScreen.tsx` | Road to Worlds — the INBOX (v0.2): an email client over `save.mail` only. | — | — | — | ok |
| `components/career/screens/SavesScreen.tsx` | Road to Worlds — the saves picker (design §11: 3 slots, slot meta rendered from slotMetaFor without hydrating full… | — | — | — | ok |
| `components/career/screens/SeasonScreen.tsx` | Road to Worlds — the season review / ceremony screen (the payoff moment). | — | — | — | ok |
| `components/career/screens/SquadScreen.tsx` | Road to Worlds — Squad (v0.2 rebuild). | — | — | — | ok |
| `components/career/screens/StandingsScreen.tsx` | Road to Worlds — Standings: the two race tables, per region (RTW-01, R49). | — | — | — | ok |
| `components/career/screens/TrainingScreen.tsx` | Road to Worlds — Training (v0.2 rebuild). | — | — | — | ok |
| `components/career/screens/WizardScreen.tsx` | Road to Worlds — career creation wizard (design doc §6). | — | — | — | ok |
| `components/screens/ChallengeScreen.tsx` | Challenge match (v1.4) — the "challenge" phase. | — | ChallengeScreen.names | — | ok |
| `components/screens/DraftScreen.tsx` | Draft screen v4. | — | — | — | ok |
| `components/screens/FirstRunTutorial.tsx` | First-launch feature tour (v1.3.1) — a short full-screen, multi-step intro to what each part of the game is (draft,… | — | — | — | ok |
| `components/screens/ResultsScreen.tsx` | Results screen v2: celebratory placement hero (rays + confetti for a title), run highlights, team reveal in two rows… | — | — | — | ok |
| `components/screens/ReviewScreen.tsx` | Team review v0.3: field + analyst column on the left, numbers column on the right, the six cards in a compact strip… | — | — | — | ok |
| `components/screens/RunOnboarding.tsx` | First-run onboarding. | — | — | — | ok |
| `components/screens/RunStepper.tsx` | In-run header: back-to-menu, phase progress, run badges, reset. | — | — | — | ok |
| `components/screens/SeasonRecap.tsx` | Pre-season → Season 1 recap (v2.0): "Your Legacy Lives On". | — | — | — | ok |
| `components/screens/SetupScreen.tsx` | Game setup: mode (Classic / Quick), difficulty and overall visibility. | — | — | — | ok |
| `components/screens/TournamentScreen.tsx` | Tournament screen v3 — automatic simulation, focused on YOUR games. | — | TournamentScreen.spoiler | — | ok |
| `app/career/* (route shells, layout, CareerShell)` (15) | Career routes: thin pages delegating to the career screens; the layout gates `FEATURES.careerMode` (noindex). | — | — | — | ok |
| `app/pt/* (PT twins)` (7) | The `/pt` content and home twins (hreflang). | — | — | — | ok |
| `app/{about,faq,ratings,sam,strategy,special-cards,changelog,privacy,how-to-play}/*` (9) | Content pages: metadata + a client view over the copy. | — | — | — | ok |
| `app/{page,layout,error}.tsx` (3) | The root layout (providers, metadata, JSON-LD), the home page and the error boundary. | — | — | U-1 P2 | listed |
| `app/{achievements,challenges,collection,leaderboards,missions,play,quiz}/page.tsx` (7) | Game route shells: metadata + the client view. | — | — | — | ok |
| `components/ui/* (primitives)` (13) | Buttons, modal + the one dialog lock (`dialog.ts`, #144), badges, icons, `AppLink`, logos, rank badge. | — | dialog | U-2 P3 | listed |
| `components/cosmetics/*` (3) | The locker, the unlock pop-up, the cosmetic views. | — | — | — | ok |
| `components/content/*` (5) | Content-page layout, locale switch, home SEO block. | — | — | — | ok |
| `components/layout/*` (4) | AppShell (nav, leave-run guard), footer, settings effects (reduce effects, lang). | — | — | U-2 P3 | listed |
| `components/cards/*` (3) | GameCard (the documented special-photo exception), field view, roster view. | — | — | — | ok |
| `components/career/event/*` (14) | Event screens' parts: lobby field, Swiss table, bracket, Match Center, playback cursors (`eventPlayback`, `clockPlayback`, `weekendView`). | — | CareerMatchCenter, clockPlayback, eventPlayback, lobbyField, weekendView | — | ok |
| `components/career/hub/*` (6) | HQ blocks: day card, squad, race tables (R49), now cards (inserts), training. | — | — | — | ok |
| `components/career/{wizard,news}/*` (4) | Wizard parts (countries, founding splash) and the news text. | — | — | — | ok |
| `components/career/* (shared career UI)` (14) | careerUi (the screens' read helpers), top bar, toaster, autopilot, sheets, crest, negotiator. | — | careerUi | U-3 P3 | listed |
| `content/copy.{en,pt}.ts` (2) | The Draft game's copy, EN and PT (PT typed against EN). | — | copy.en, copy.pt | — | ok |
| `content/copy.career.{en,pt}.ts` (2) | Career copy, EN and PT (career routes only). | — | — | — | ok |
| `content/{copy,careerCopy,pages,pageRoutes}.ts` (4) | Runtime copy access (`useCopy`, `useCareerCopy`) and the content-page registry. | — | copy | — | ok |
| `components/* (shared widgets)` (10) | PostHog provider, toasters, missions panel, login streak modal, achievement grid, account section. | — | — | — | ok |
| `lib/{sfx,useOsReducedMotion}.ts` (2) | Sound layer and the OS reduce-motion preference. | — | — | — | ok |

Findings:

- **U-1 (P2)** `/pt` first paint shows English chrome and `lang="en"` (DRAFT-11 → Etapa 5 WEB-01; front E is on it).
- **U-2 (P3)** English-only accessibility labels: `AppShell.tsx:139,203,277`, `HomeMenu.tsx:159`, `Modal.tsx:42,66`, `SiteFooter.tsx:41`, `RunStepper.tsx:60`, `TournamentScreen.tsx:559`; `app/error.tsx:19` ("Unexpected stoppage").
- **U-3 (P3)** `careerUi.ts:6` says screens never import engine internals; 12 career screens do (e.g. `MarketScreen.tsx` → `economy`, `development`).

## Export, perf and SEO — the static build, assets, metadata

**Closed by:** `a187654` (rc.31, audited; P-1 is front E's). **Evidence:** `npm run build` on this branch: green (Turbopack, 48 static pages; postexport OK — career OFF, analytics DISABLED without a key; no tracked file changed); `sharedPath.test.ts` (the shared path never loads the dataset); the postexport guards (career / playtest strip, prefetch names, image URLs, endpoint guard, Cloudflare limits); metadata routes are `force-static`; `wrangler.jsonc` has no `main`.

| Module | Job | Persistence | Tests | Findings | Status |
| --- | --- | --- | --- | --- | --- |
| `app/manifest.ts` | Web app manifest (`force-static`). | — | — | — | ok |
| `app/robots.ts` | robots.txt: disallow all on `NEXT_PUBLIC_NOINDEX` builds (`force-static`). | — | — | — | ok |
| `app/sitemap.ts` | sitemap.xml, EN + `/pt` with hreflang; never lists `/career` (`force-static`; postexport checks it). | — | — | — | ok |
| `components/seo/JsonLd.tsx` | Renders a JSON-LD <script> for structured data. | — | — | — | ok |
| `lib/assets.ts` | Image URL helpers for the static art in public/ (org logos, special-card photos, rank emblems, flags). | — | — | P-1 P2 · P-3 P3 | listed |
| `lib/contentMeta.ts` | Metadata helpers for the content pages. | — | — | P-2 P3 | listed |
| `lib/imageLoader.ts` | next/image custom loader (next.config.ts → images.loaderFile). | — | — | P-3 P3 | listed |
| `lib/jsonld.ts` | Structured-data (schema.org / JSON-LD) builders — pure, server-safe helpers. | — | — | — | ok |
| `lib/shareCard.ts` | Share card generator — renders a 1200×630 result image on a canvas (no dependencies) for preview / download / native… | — | — | U-4 P3 | listed |
| `next.config.ts` | `output: "export"`, the React compiler, the custom image loader; no headers / redirects / rewrites. | — | build | — | ok |
| `wrangler.jsonc` | Assets-only Worker (production, staging, playtest); no `main`. | — | build / deploy | — | ok |
| `public/_headers` | Cache rules per path (never `Cache-Control` under `/*`). | — | manual (deploy runbook) | — | ok |
| `scripts/postexport.mjs` | Post-build guards and fixes (Windows segments, career / playtest strip, image URLs, endpoints, limits). | — | every build | — | ok |
| `scripts/build-images.mjs` | PNG / SVG → hashed WebP + the manifest (prebuild). | — | every build | — | ok |
| `scripts/perf-probe.mjs` | Request / effect budget probe (`npm run perf:probe`, #130). | — | opt-in | — | ok |

Findings:

- **P-1 (P2)** A whole Classic run from a cold home makes 77–80 requests against a 75 budget (org logos and flags in the draft and the bracket; Etapa 5 WEB-02, front E).
- **P-2 (P3)** Backlog (STATUS): `specialCards.json` (~10 KB gz) on every page, the PT dictionary not lazy, no `og:image` on content pages, lazy PostHog can miss UTMs, deploy-skew 404s.
- **P-3 (P3)** No unit test; the build's postexport `checkGeneratedImages` verifies every URL the helpers can return.
- **U-4 (P3)** The share card's text (mode, difficulty) is English in PT (deferred to the Etapa 5 PT pass).
