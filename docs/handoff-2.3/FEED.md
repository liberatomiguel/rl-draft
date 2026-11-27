# v2.3 wave 1, front FEED: the fan feed (rules and text, no screen)

Branch `v23/fan-feed`, base `v23/base`. Flag `FEATURES.fanFeed` (`NEXT_PUBLIC_FAN_FEED=1`, staging only). Decisions R195 to R199 in `ROAD-TO-WORLDS-DECISIONS.md`.

## What it is

- `src/engine/career/fanFeed.ts`: `fanFeedFor(save, { limit })` returns the recent posts, newest first. Pure, seeded (`deriveSeed(careerSeed, "gen:fanFeed:<event>")`), derived on every call, never stored. A post is data: `{ id, kind, variant, slots, author, likes, seasonIndex, week }`.
- `fanFeedVariants.ts` (the variant tables), `fanFeedText.ts` (`feedTextOf(post, copy.feed)` drops the slots into the copy's `{slot}` templates), `fanHandles.ts` (the handle bank), `fanFeedTypes.ts`.
- `src/store/fanFeedFlow.ts`: `recordFeedSeries` (the hook), `postToFeedFlow(save, tone | "skip")` (the one action), `pendingFeedPostOf(save)`, `followersOf(save)`.
- `src/config/balance.fanFeed.ts` (`CAREER_FEED`), `src/content/copy.career.feed.{en,pt}.ts` (`feed.*`).

## What the save holds, and what it does not

The save did **not** record the user's series one by one (opponent, score, upset); only totals and the event placement. So the feed adds one optional field, `save.fanFeed` (`series` ring of 40, `posts` of the manager, `answered`, `followers`), written by the hook from the finished tournament. Everything else is read from what exists: `eventResults` (titles, lost finals), `honors` (the title ledger for the dynasty claim), `transferLog` (signings, sales), `world.orgs` (names of the other org). A save without the log gets no series posts; a title from an older season is in the ledger but has no event name, so it counts toward claims and is not posted.

## Event kinds and variants

seriesWon 7 · seriesLost 6 · upsetWin 6 · upsetLoss 6 · winStreak 8 · loseStreak 6 · signing 8 · sale 8 · titleWon 9 · finalLost 6 · managerReply 9 (3 per tone) · receipt 6 · managerPost 3 (one per tone, his own words). Streak posts replace the plain post at lengths 3, 5, 8 and 12. Claim variants: seriesWon.7 and winStreak.7 (best team in the region), winStreak.8 and titleWon.7 (dynasty), titleWon.8 (first title).

## Hooks in shared files (all marked `// v2.3 FEED`)

| File | Lines | Purpose |
|---|---|---|
| `src/config/balance.ts` | `fanFeed:` entry in `FEATURES` | the flag |
| `src/config/balance.ts` | `export * from "./balance.fanFeed"` at the end | the tunables |
| `src/config/balance.ts` | `BALANCE_VERSION` 53 to 54 | the fingerprint test requires it |
| `src/config/balanceVersion.test.ts` | `FINGERPRINT` | new hash; **recompute at merge**, every front changes it |
| `src/config/stagingFlags.test.ts` | `"fanFeed"` in FLAGS, `NEXT_PUBLIC_FAN_FEED` in PROBE_VARS | staging-only list |
| `src/engine/career/types.ts` | `fanFeed?:` on `CareerSave` | the additive optional field |
| `src/store/careerFlow.ts` | one import and `recordFeedSeries(save, ev.tournament, def)` in `finishEvent`, after `accumulateBoxStats` | logs the series |
| `src/content/copy.career.en.ts` / `.pt.ts` | one import and one spread each | the `feed` group |

## Tests

`src/engine/career/fanFeed.test.ts` (28): determinism, cap independence, no write, old save gives nothing, different results give different text, different seed gives different variants and handles, kind from result (win, loss, upset, streak), six variants per kind, copy keys equal the variant keys in EN and PT, every variant uses at least two slots and exactly its declared ones, no placeholder left, no repeat inside the window over 120 seeds (more than 5000 posts), claim words only in tagged variants (EN and PT), no claim variant without its data over 60 seeds, dynasty and first-title and best-in-region gating on built saves, lost final names the champion, signings and sales drop missing slots, no handle (bank words and 20 000 generated) equals a dataset or catalogue player or org name, receipt and reply in the feed, likes scale. `src/store/fanFeedFlow.test.ts`: the log, ring, side events, followers moves and floor, the action (tone, opponent, week stored, one answer per series, skip, refused tone, cap), the receipt (provoke then lose, provoke then win, other opponent, other tones, settles once, window), one real event played through the flows. `src/store/fanFeedFlow.flagOff.test.ts`: hook, action and readers inert, a real event leaves no `fanFeed`. Plus `stagingFlags` and `balanceVersion`.

## Not verified

No browser, no full suite, no `npm run build`, no soft-lock probe, no battery. The hook is exercised by one real event per flag state, not across a season. The action is not wired into `careerStore` (wave 2 with the screen). Persist round-trip and cloud copy of the new field are untested (it is plain JSON, additive). The Portuguese has not had a native read beyond mine.

## Samples, rendered from a test save (EN, then the same in PT)

Org "Kestrel Gaming", a SAM career with a 19-series run, a Major won in season 2 (third Major or Worlds title on the ledger), a lost regional final, one signing and one sale, a provocative post settled as a receipt and a confident post. Opponents are world orgs and appear only as subjects.

| Kind | Author | Likes | EN |
|---|---|---|---|
| winStreak | @hotseat.gremlin | 347 | 3-1 over Avidity Esports makes it 5 in a row. |
| managerReply | @lobby_dad45 | 128 | Kestrel Gaming on Avidity Esports: confident. Confidence is cheap, results are not. |
| managerPost | Manager (you) | 257 | Kestrel Gaming is ready for Avidity Esports. We trust our work. |
| seriesWon | @ceiling_dad91 | 143 | SAM Regional 6 notes: 3-1 over FURIA, and the rotations were sharp all series. |
| sale | @boost_fan92 | 48 | $800k for Zenith. Kestrel Gaming cashed in, now let us see how they spend it. |
| finalLost | @open_veteran13 | 404 | Kestrel Gaming fall in the SAM Regional 3 final. Proud of the run anyway. |
| seriesLost | @ceiling_critter46 | 38 | SAM Regional 5: 3-1 to FURIA. We go again. |
| loseStreak | @hotseat.corner | 195 | That is 5 in a row, the latest 3-1. Time to rethink the rotations? |
| receipt | @reboundstats | 423 | True Neutral win 3-1. Funny, I remember a post about this matchup. |
| signing | @flip_vods82 | 280 | Marvel in Kestrel Gaming colours. The roster talk starts today. |
| titleWon | @carry.main | 1663 | Kestrel Gaming win Fall Major. A whole season of work paid off. |
| upsetWin | @pinchveteran | 157 | 3-1. Kestrel Gaming just flipped the bracket upside down. |
| upsetLoss | @bracket_spirit94 | 67 | A shock at SAM Regional 3: 3-1. The bracket just got messy. |

| Kind | Autor | Curtidas | PT |
|---|---|---|---|
| winStreak | @hotseat.gremlin | 347 | 3-1 contra Avidity Esports e já são 5 seguidas. |
| managerReply | @lobby_dad45 | 128 | Kestrel Gaming encara Avidity Esports com a confiança lá em cima. Confiança é barata, resultado não é. |
| managerPost | Manager (você) | 257 | Estamos prontos pra encarar Avidity Esports. Kestrel Gaming confia no trabalho. |
| seriesWon | @ceiling_dad91 | 143 | Anotações do SAM Regional 6: 3-1 contra FURIA, rotação afiada a série inteira. |
| sale | @boost_fan92 | 48 | $800k por Zenith. Kestrel Gaming fez caixa, agora quero ver onde vai gastar. |
| finalLost | @open_veteran13 | 404 | Kestrel Gaming cai na final do SAM Regional 3. Orgulho da campanha mesmo assim. |
| seriesLost | @ceiling_critter46 | 38 | No SAM Regional 5: 3-1 contra FURIA. A gente volta. |
| loseStreak | @hotseat.corner | 195 | São 5 seguidas, a última por 3-1. Hora de repensar as rotações? |
| receipt | @reboundstats | 423 | True Neutral vence por 3-1. Engraçado, lembro de um post sobre esse confronto. |
| signing | @flip_vods82 | 280 | Marvel assina com Kestrel Gaming. A conversa sobre o elenco começa hoje. |
| titleWon | @carry.main | 1663 | Kestrel Gaming leva o Fall Major. Uma temporada inteira de trabalho que compensou. |
| upsetWin | @pinchveteran | 157 | 3-1. Kestrel Gaming virou a chave de cabeça pra baixo. |
| upsetLoss | @bracket_spirit94 | 67 | Susto no SAM Regional 3: 3-1. A chave ficou bagunçada. |

The score is always the series score, winner first. The claim lines (dynasty, best team in the region, first title) were eligible only where the data allowed and were simply not drawn in this sample; their texts are in `copy.career.feed.en.ts` / `.pt.ts` under `winStreak.7`, `winStreak.8`, `seriesWon.7`, `titleWon.7` and `titleWon.8`.
