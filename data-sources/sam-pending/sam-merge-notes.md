# SAM Top-8 — merge notes & methodology

Companion to **`teams-sam.md`**. Everything you need to merge the SAM regional
Top-8 dataset into Rocket Draft later, cleanly. Researched from Liquipedia
(South America ranking pages + per-team/per-event pages). Sources at the bottom.

**Scope:** SAM Top 8 per season — S7, S8, S9, RLCS X, 2021-22, 2022-23, 2024,
2025. SAM debuted in S7; 2026 is in progress (no final ranking) and is omitted.
- **S7–S9:** the 8 Grand Series teams = the season Top 8.
- **RLCS X onward:** the Top 8 of the final SAM **regional ranking**.

**What's in `teams-sam.md`:** ONLY the Top-8 teams that did **not** reach
RLCS Worlds/Finals (45 new lineups), each flagged `flag: sam-only`. Teams that
DID reach Worlds/Finals are already in `data-sources/teams.md` and are **not**
duplicated. The general draft keeps showing only the Worlds/Finals teams; the
new `sam-only` teams appear only in the SAM regional mode.

---

## 1. How to merge (when you're back on the main repo)

1. **Wire the flag into the generator** (section 2) — do this FIRST, or the
   `sam-only` teams would leak into the general draft on the next `build:data`.
2. **Add the `COUNTRY` entries** (section 4) to `scripts/build-dataset.mjs`.
3. **Apply the dedup canonical spellings** (section 5) — the blocks already use
   the canonical spelling, but read section 5 for the cross-region collisions
   (`diaz`, `crr`/`dorito`, the `Complexity` org) that need a generator rule.
4. **Paste the `### SAM` blocks** from `teams-sam.md` into the matching
   `## Season …` sections of `data-sources/teams.md` (S7/S8/S9 already have a
   `### SAM` subsection; append to it). Order inside a season doesn't matter to
   the generator.
5. `npm run build:data` then `npm run validate:data`.
6. (Optional) review section 7 — small corrections the research surfaced in the
   EXISTING finals teams (e.g. FURIA's 2024/2025 coach). Not applied here.

---

## 2. The `flag: sam-only` mechanism (generator change for the patch)

Each new block has a line `flag: sam-only`. The current parser ignores unknown
lines, so nothing breaks before the patch. To make it real:

**a) Schema — `src/data/schemas.ts`**, add to `lineupSchema`:
```ts
samOnly: z.boolean().optional(),
```

**b) Parser — `scripts/build-dataset.mjs`**, in the `teams = rawTeams.map(...)`
block, read the flag and carry it onto the lineup:
```js
const flagRaw = get("flag");                 // "-" when absent
const samOnly = /\bsam-only\b/i.test(flagRaw);
// ...return { ...existing fields..., samOnly };
```
then where the lineup object is pushed:
```js
lineups.push({
  id: lineupId,
  // ...existing...
  ...(team.samOnly ? { samOnly: true } : {}),
  historicalStrength,
});
```

**c) Draft/opponent pool filter.** Wherever the draftable lineup pool and the
opponent pool are built from `lineups`, exclude `samOnly` unless the run is in
the regional SAM mode. Lineups already flow through `src/store` → engine; add a
mode-aware filter at the pool source (e.g. `engine/teams.ts` / wherever lineups
are selected) so:
- **general draft / existing modes:** `lineups.filter(l => !l.samOnly)`
- **SAM regional mode:** `lineups.filter(l => l.region === "SAM")` (this
  includes both the existing SAM finalists AND the `samOnly` teams = the
  "larger SAM DB" you described).

> Net effect: nothing changes for today's modes (the `!samOnly` filter removes
> the new teams); the new SAM mode is the only place the 45 new lineups show up,
> alongside the SAM finalists already in the set.

---

## 3. Overall methodology (reality-anchored, NOT guessed)

Every overall is anchored to facts, in this priority order:

1. **Existing dataset values for the same person.** Any player already rated in
   `teams.md` sets their curve; new-season cards interpolate/extrapolate along a
   realistic career arc (players rise, peak, plateau). Anchors used, e.g.:
   `yanxnz` 88 (21-22) → 91 (24-25); `caard` 81 (S7) → 84 (S9) → 83 (X);
   `tander` 77 (S7) → 81 (S9/X); `CaioTG1` 81 (S8) → 83 (S9) → 82 (X);
   `kv1` 79 → 84 → 85; `Lostt` 80 → 88 → 89; `drufinho` 85 → 86 → 87;
   `droppz` 81 (22-23) → 82 (25); `brad` 80 → 82; `Reysbull` 84 (X) → 86 (25);
   `Sadness` 79 → 83 → 85; `nxghtt` 78 → 82; `AztromicK` 79 → 81 → 84;
   `swiftt` 87; `Bemmz` 80; `matix` 77 (S7) → 75 (S8); `repi` 73; `PJ` 72;
   `renaN` 74 (S7) → 78 (S9); `Haberkamper` 79; `FirefoxD` 78.
2. **Final SAM rank that season.** Higher placement → higher overalls; the new
   teams (ranks below the Worlds qualifiers) sit below the finalists of the same
   season. So early-career stars on a low-placed team (e.g. `ajg` on an S8/S9
   bottom team) get a **rookie** value that GROWS into their later dataset
   value, not their peak.
3. **Era strength of SAM.** SAM was a developmental region: S7 (debut) tops out
   ~81 (`caard`); the regional ceiling rises over time. Pure-regional players
   stay in the 68–84 band; only SAM players who proved themselves at Worlds
   reach high-80s/low-90s (and those are already the finalists in the dataset).
4. **Role.** Subs ≈ starter level −3 to −8 (true benchwarmers floored to 50, the
   dataset's "vacant/inactive" value — matches existing `fAsi 50` S7,
   `Firewall154 50` S8). Coaches reflect stature and map to the generator's
   bonus tiers (overall ≥85 → `++`, ≥75 → `+`, else `~`): ex-pro coaches
   (`pekitas`, `tander`-as-coach, `STL`) 76–80; lesser-known 58–66.

Resulting `historicalStrength` (derived: avg ≥91 elite · ≥87 strong · ≥82 solid
· else underdog) lands almost all new teams in **underdog/solid** — which is
correct: these are the non-Worlds SAM teams. These are estimates **for tuning** —
they're defensible, not sacred; refine with `manualAdjustment` after import.

---

## 4. `COUNTRY` map additions (`scripts/build-dataset.mjs`)

High-confidence only (countries read from Liquipedia flags by the research
agents). Keys are `personKeyOf(nick)` = lowercase, accents/spaces/punctuation
stripped. **Already-present** SAM keys (caard, caiotg1, tander, renan, yanxnz,
lostt, drufinho, stl, swiftt, sadness, kv1, motta, brad, suco, math, matix,
valt, repi, pj, fasi, nxghtt, aztromick, firewall154, kairos, jato,
brunovisquii, pekitas, reysbull, ajg, aguesome, bananaman, bemmz, droppz,
firefoxd, haberkamper, michi, shad, crr, dorito) are **not** repeated.

```js
// ── SAM Top-8 import (regional mode) ──────────────────────────────────────
// Brazil
tibiano: "BR", juan: "BR", dudubrhue: "BR", c4: "BR", noisy: "BR",
mateusstl: "BR", flasheeyy: "BR", davinsano: "BR", snipjuzo: "BR", leodkn: "BR",
srforeverplays: "BR", luk: "BR", sword: "BR", ianpinheiro: "BR", zanetti: "BR",
majowww: "BR", sppyder: "BR", subhallz: "BR", chr1s: "BR", snipjz: "BR",
bliss: "BR", gian: "BR", kixou: "BR", xoz1n: "BR", yand: "BR", kns: "BR",
waantz: "BR", pedrokanicastro: "BR", bmendesantos: "BR", wells: "BR",
klaus: "BR", baait: "BR", alpe: "BR", lag0: "BR", darxtz: "BR", twistt: "BR",
royales: "BR", wisty: "BR", dappluto: "BR", crn: "BR", kaoshi: "BR",
patolimpo: "BR",
// Argentina
szaro: "AR", sempa: "AR", orbi7: "AR", dislike: "AR", lexim: "AR",
manteca: "AR", tatu: "AR", nachusky: "AR", srnanitou: "AR", aguz: "AR",
umbroken: "AR", stolen: "AR", farz: "AR", seck: "AR",
// Chile
lance: "CL", pansitofrances: "CL", gonk: "CL", deathxplosion: "CL", richy: "CL",
androzz: "CL", gatox: "CL", pan: "CL", davitrox: "CL", groval: "CL",
nachosky: "CL",
// elsewhere
laayoh: "US", luc: "US", cha0s: "BE",
```

Low-confidence / left out (add only if you confirm): `Obtth` (Blazar 22-23 sub,
event-page only) — omitted from the blocks entirely.

---

## 5. Identity / dedup — canonical spellings & collisions

`personKeyOf` collapses case/accents/punctuation, so most variants self-merge.
The blocks already use the canonical spelling. The ones that would **break**
without care (different keys for the same person) — verify these stay canonical:

| Use this (canonical) | Liquipedia / variant spellings | Why it matters |
|---|---|---|
| **Sadness** | "Sad" | `sad` ≠ `sadness`; dataset uses **Sadness** — keep it or the person splits |
| **Shad** | "SHADDD" | `shaddd` ≠ `shad`; dataset uses **Shad** |
| **ajg** | "ajgAnotherGuy_" | `ajganotherguy` ≠ `ajg`; dataset uses **ajg** |
| **BRUNOVISQUII** | "brunovisqui" (one i) | `brunovisqui` ≠ `brunovisquii`; dataset uses **BRUNOVISQUII** |
| **pan** | "pan.", "PAN" | trailing dot / case; all = Sebastián Parra (CL) |
| **klaus** | "klaus." | trailing dot |
| **SnipJuzo** | "Snip-_-Juzo" | punctuation would otherwise stay only in display |
| **SrForeverplays** | "Sr.Foreverplays" | dot |
| **bmendesantos** | "bmendes" | `bmendes` ≠ `bmendesantos` |
| **lag0** | "Laaggo" | different key |
| **SrNaniTou** | "Sr_NaniTou", "SrNaniiTou" | underscore + an extra "i" variant — see note below |
| **AztromicK / Aztromick** | "Aztrø" | both dataset spellings → `aztromick` (fine); "Aztrø" is just a display abbrev |
| **Aguesome** | "Agüesome" | umlaut is stripped → same key `aguesome` (safe; use Aguesome) |

**Same handle, DIFFERENT person (needs a split rule — like the existing
`zen`/`zen-oce`):**

- **`diaz`** — the existing dataset `diaz` is a **US/NA** player. SAM 2024 has a
  *different* `diaz` (João Henrique, **BR**, on w7m M1 → Complexity M2). I kept
  this `diaz` **out of the blocks** (Complexity is listed with its M1 trio
  Reysbull/crr/dorito; w7m with its M2 trio). If you want the Major-2 lineups,
  add a collision rule in `registerPerson`:
  ```js
  if (key === "diaz" && region === "SAM") key = "diaz-sam";
  ```
  and `diazsam`/`diaz-sam`: "BR" in COUNTRY. Otherwise you'll merge two people.

- **`crr` (ES)** and **`dorito` (ES)** on **Complexity Gaming 2024 (SAM)** are
  the SAME persons already in the dataset (EU/NA-origin imports who played the
  SAM season). They keep their existing region in the person registry (region is
  set on first registration), so they won't get SAM same-country chemistry with
  their SAM teammates. That's accurate-ish (they're foreigners) — just be aware.

- **`Complexity Gaming` org** already exists in the dataset (NA/EU, e.g. the
  al0t S5 base card). Reusing the id for the SAM 2024 lineup means the org's
  `region` stays as first-registered (not SAM). If you want it treated as a
  distinct SAM org, add `complexity-gaming` to `REGION_SPLIT_ORGS` (→
  `complexity-gaming-sam`). Otherwise it's a shared org — harmless but noted.

**Not a collision, just don't confuse them:** `gonk` (CL) and `GaTox` (CL) are
**different** people; `Szaro` also carries the alias "Cross".

**Same person on TWO Top-8 teams in the SAME season** (legit roster churn — the
draft engine already dedups a person per run, so both cards are fine):
- 2024: **caiotg1** (w7m + Bodybuilders), **pan** (w7m + GamerLegion).
- 2021-22 → others mostly handled by using each team's representative roster.
- `SrNaniTou`: appears as an S9 sub (Three Point Shooters) and a Leviatán
  departure in 21-22 — likely the same person but **unconfirmed**; if confirmed,
  keep one key `srnanitou`.

---

## 6. Per-season Top 8 — full picture (finalist vs new)

`✅ in dataset` = already in `teams.md` (Worlds/Finals team, general draft, no
flag). `➕ new` = added in `teams-sam.md` with `flag: sam-only`.

### S7 (2019) — Grand Series (Lowkey 4-1 INTZ final)
1. Lowkey Esports — caard, renaN, tander; sub fAsi — ✅ in dataset
2. INTZ eSports — repi, PJ, matix; coach Jato — ✅ in dataset
3. Erodium — CaioTG1, math, valt; sub Lance; coach Tibiano — ➕ new
4. Lotus — Haberkamper, FirefoxD, Juan; sub DuduBRHue — ➕ new
5-6. Orchid — BRUNOVISQUII, C4, Noisy; sub MateusSTL — ➕ new
5-6. Team CryptiK — Szaro, Flasheeyy, Sempa — ➕ new
7. GFactor Galaxy — Gonk, PansitoFrances, Orbi7; sub Deathxplosion — ➕ new
8. FantasyDeath — DavInsano, LeoDkn, SnipJuzo; sub SrForeverplays — ➕ new

### S8 (2019) — Grand Series
1. The Three Sins — matix, math, valt; sub Jato; coach BananaMan — ✅ in dataset
2. Lowkey Esports — caard, CaioTG1, tander; sub Firewall154; coach Kairos — ✅ in dataset
3. Lotus — Haberkamper, renaN, FirefoxD; sub DuduBRHue — ➕ new
4. INTZ eSports — repi, PJ, Juan; sub Sword — ➕ new
5-6. Oxey Team — Luk, Reysbull, DisLike; sub Richy; coach Androzz — ➕ new
5-6. Hawks — Lexim, Gonk, Sempa; sub Manteca; coach Aguesome — ➕ new
7. Monos — ajg, Shad, GaTox — ➕ new
8. Orchid — BRUNOVISQUII, Szaro, Noisy; sub MateusSTL — ➕ new

### S9 (2020) — Grand Series (no Worlds, COVID; champion Ellevens)
1. Ellevens Esports — caard, CaioTG1, tander (sub Gian*) — ✅ in dataset
2. Avidity Esports — Haberkamper, FirefoxD, renaN (sub DuduBRHue*, coach Jato*) — ✅ in dataset
3. Most Wanted — math, fAsi, Luk; sub ianpinheiro — ➕ new
4. The Three Sins — matix, PJ, valt; sub Brad; coach Cha0s — ➕ new
5. True Neutral — Reysbull, Shad, Lexim; sub Manteca; coach Aguesome — ➕ new
6. Poison Bullets — repi, droppz, Juan; sub Zanetti; coach Majowww — ➕ new
7. Sapphire — BRUNOVISQUII, Sword, SppydeR; sub SubHallz; coach MateusSTL — ➕ new
8. Three Point Shooters — ajg, pan, gonk; sub SrNaniTou; coach Laayoh — ➕ new

### RLCS X (2020-21) — final SAM season ranking (no 8-team championship; only a 2-team SAM Grand Final True Neutral vs FURIA) ⚠ messiest season, see notes
1. True Neutral — Shad/SHADDD, Reysbull, ajg; coach Aguesome — ✅ in dataset
2. The Three Sins — matix, PJ, valt — ➕ new
3. FURIA Esports — caard, CaioTG1, tander; sub/coach STL — ✅ in dataset
4. **Rebel** (ranking alias Dracon→Rebel→Catalyst) — yanxnz, AztromicK, snipjz; coach Bliss — ➕ new ⚠ **LOW CONFIDENCE**: this ranking slot is an org-points chain blending two rosters. I used the Spring "Rebel" roster (2nd at the Spring Major, where the points came from). The alternative is the Dracon/Catalyst trio Luk/Gian/matix. Verify before trusting.
5. Noble esports — Haberkamper, renaN, FirefoxD; sub Firewall154; coach Jato — ➕ new
6. Nocturns Gaming — Szaro, TaTu, pan; sub Gonk; coach Nachusky — ➕ new
7. **Carnage Gaming** (the original fAsi roster) — fAsi, ianpinheiro, Chr1s — ➕ new
8. **Chromax** (ranking lists this slot as "Carnage Gaming"; roster origin No Mercy→Chromax, acquired by Carnage) — Brad, droppz, repi; sub Zanetti — ➕ new ⚠ named **Chromax** here only to avoid a duplicate `carnage-gaming-x` lineup id; rename at will.

### 2021-22 — final ranking
1. FURIA Esports — caard, CaioTG1, Yanxnz; sub STL; coach Kairos — ✅ in dataset
2. Team Secret — Sadness, nxghtt, math — ✅ in dataset
3. The Club — AztromicK, kv1, Lostt; sub fAsi; coach Michi — ✅ in dataset
4. Elevate — droppz, Luk, snipjz; sub kixou; coach xoz1N — ➕ new
5. Hawks — repi, yanD, KnS; sub Waantz; coach Pedrokanicastro — ➕ new
6. EndGame — bmendesantos, Wells, ianpinheiro; coach FARz — ➕ new
7. Leviatán — aguz, Lexim, UmBroken; coach Stolen — ➕ new
8. KRÜ Esports — drufinho, Bemmz, pan; sub GaTox; coach pekitas — ➕ new

### 2022-23 — final ranking
1. Team Secret — Sadness, kv1, nxghtt — ✅ in dataset
2. Ninjas in Pyjamas — Aztromick, Bemmz, Motta — ✅ in dataset
3. KRÜ Esports — brad, droppz, drufinho — ✅ in dataset
4. Exeed — Davitrox, KnS, klaus; sub baait; coach Pedrokanicastro — ➕ new
5. Ruby — alpe, davinsano, LeoDkn; coach Stolen — ➕ new
6. EndGame — Luk, Wells, seck; sub lag0; coach FARz — ➕ new
7. Blazar — PJ, Darxtz, twistt; coach Luc — ➕ new
8. eRa — pan, UmBroken, ianpinheiro; coach groval — ➕ new

### 2024 — final ranking (ties at 4 & 7; top 8 unambiguous)
1. FURIA Esports — yanxnz, Lostt, drufinho; coach STL** — ✅ in dataset
2. Complexity Gaming — Reysbull, crr, dorito (M2: diaz for dorito); coach Aguesome — ➕ new
3. Ninjas in Pyjamas — swiftt, AztromicK, nxghtt; coach fAsi — ➕ new
4. KRÜ Esports — caard, ajg, Bemmz (M2: wisty for caard); coach pekitas — ➕ new
4. w7m esports — caiotg1, Royales, pan; coach tander — ➕ new
6. Team Secret — kv1, Motta, brad; coach brunovisqui — ✅ in dataset
7. Bodybuilders — caiotg1, yanD, Dappluto; coach FARz — ➕ new
7. GamerLegion (ranking "Ex-GamerLegion") — pan, UmBroken, ianpinheiro — ➕ new
   (9th was a 3-way tie at 10 pts: Ex-True Neutral / Hero Base / Not Exposed — outside top 8.)

### 2025 — final ranking
1. FURIA — yanxnz, Lostt, drufinho; coach STL** — ✅ in dataset
2. Team Secret — kv1, swiftt, Motta — ✅ in dataset
3. Godfidence — AztromicK, Bemmz, suco; sub fAsi; coach Kaoshi — ➕ new
4. Corinthians Esports — droppz, brad, Reysbull; coach pekitas — **= the roster the dataset has as MIBR** (they moved org Corinthians→MIBR and qualified to Worlds via the SAM LCQ). **Not re-added** to avoid duplicating MIBR's three people in 2025. *(Early-season Corinthians ran droppz/brad/Sadness before Reysbull joined Apr 27 — if you want that as a distinct lineup, add: `Corinthians Esports · 2025` = droppz 82, brad 82, Sadness 82; coach pekitas 79.)*
5. Amethyst — Sadness, nxghtt, wisty; coach Michi — ➕ new
6. Sunset — caard, caiotg1, crn; coach PatoLimpo — ➕ new
7. Moonrise — KnS, yanD, klaus; coach repi — ➕ new
8. Latino Heat — pan, Davitrox, nachosky; coach groval — ➕ new (all-Chilean)

\* enrichment available vs the existing dataset; \** see section 7.

---

## 7. Possible corrections to EXISTING finals teams (NOT applied here)

The research surfaced these about teams already in `teams.md`. Flagged only —
the official JSON merge is your separate task; decide there.

- **FURIA 2024 coach:** dataset has `BRUNOVISQUII`; Liquipedia shows **STL**
  (Mateus Lemos) as FURIA's 2024 coach. `brunovisqui` was **Team Secret's** 2024
  coach (Team Secret entry already lists him — that one's right).
- **FURIA 2025 coach:** dataset has `BRUNOVISQUII`. For most of 2025 (where the
  points were earned) FURIA's coach was **STL**; `brunovisquii` only joined FURIA
  on the **Nov 1, 2025** FURIA↔Team Secret swap (swiftt+brunovisquii → FURIA;
  drufinho+STL → Team Secret). The dataset value reflects the post-swap/current
  state — fine if intentional, but the season-representative coach is STL.
- **S9 Avidity Esports:** dataset has no coach/sub; LP adds **coach Jato**, **sub
  DuduBRHue** (players unchanged).
- **S9 Ellevens:** LP adds **sub Gian** (players unchanged).
- **2021-22 FURIA staff roles:** dataset has `sub STL, coach Kairos`; LP shows
  the roles swapping across Spring (STL coach / Kairos sub on Events 2–3). Cosmetic.

---

## 8. Sources (Liquipedia)

- Rankings: `…/2025/Rankings/South_America`, `…/2024/Rankings/South_America`,
  `…/2022-23/Rankings/South_America`, `…/2021-22/Rankings/South_America`,
  `…/Season_X/Rankings/South_America`
- Grand Series: `…/Season_7/South_America`, `…/Season_8/South_America`,
  `…/Season_9/South_America`
- RLCS X final: `…/Season_X/Championships/South_America`
- Plus per-team and per-event (Open/Major) pages for every roster + the country
  flags, cross-checked against each org's team page. All rosters are sourced;
  nothing was invented. Items marked ⚠ / LOW CONFIDENCE / UNCONFIRMED are the
  only soft spots — concentrated in RLCS X (org-points chains) and a couple of
  event-only subs.
