# RLCS Worlds — Liquipedia audit vs. dataset (2026-06-16)

Cross-check of every RLCS **World Championship** field (S1 → 2026) against our
`lineups.json`. Source of truth: **Liquipedia** (rocketleague wiki), extracted
from participant tables + raw wikitext + team pages. **No JSON was changed** —
this is a findings list to fix from later.

## How to read this
- Only **discrepancies** are listed per season (matching teams are omitted).
- "DS" = our dataset. "LP" = Liquipedia. Player order is ignored; **trivial
  casing/spelling** differences (jstn./jstn, gReazy/Greazy, ExoTiiK/exotiik,
  Sweaty/Sweaty_Clarence, JAM Gaming/Just a Minute Gaming) are **NOT** flagged.
- **Confidence**: HIGH = wikitext-confirmed; MED = verify (roster shuffles
  mid-season, or participant-table vs team-page differences are possible).
- Caveat: Liquipedia "participant tables" show the entered roster; a team may
  have fielded a sub during the event. Where DS differs by one player, it may be
  a valid alternate roster — **verify before changing**.

---

## Headline / structural findings

1. **Counts are CORRECT.** S1 8 · S2 8 · S3–S6 10 · S7–S9 12 · RLCS X 16 ·
   2021-22 **24** · 2022-23 **24** · 2024 16 · 2025 20 · 2026 16. The modern
   24/24/16/20 are real (group stage + on-site Wildcard/Play-In all count as
   "played the Worlds"). No team-count errors.

2. **Season 9 (2020) had NO World Championship.** It was cancelled (COVID) and
   replaced by 4 separate online regional championships (EU 6 · NA 6 · OCE 4 ·
   SAM 8). Our 12-team S9 "Worlds" (NA4/EU4/OCE2/SAM2) is an **invented field** —
   the teams/rosters are real S9 regional teams, but that exact 12-team event
   never happened. Decision needed: keep as an approximation or rework.
   Source: https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_9

3. **RLCS X (2020-21) also had no single global Worlds** (split into 4 regional
   championships, COVID). BUT our 16 teams **match** the combined regional-
   championship fields (EU6/NA6/OCE2/SAM2) — so RLCS X is **fine as-is**, just
   know it wasn't one "Worlds" event.
   Source: https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/Season_X

4. **2026 hasn't happened yet** (scheduled Sep 2026; on Liquipedia the OCE group
   seat + all 4 Play-In seats are still TBD). Our 2026 field is a **provisional
   forecast** — rosters will still change. Discrepancies there are expected.
   Source: https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/2026

5. **Accuracy pattern:** NA / EU / OCE / SAM are almost perfect through ~2024.
   **MENA, APAC, SSA and the 2025 season** carry most of the roster errors —
   and the error is usually the **3rd player**. Worth a focused re-check of those.

---

## Clean seasons (DS matches Liquipedia) ✅
- **S1, S2, S3, S4, S5, S7, S8** — every team + trio matches (subs aside).
  (S2 Northern Gaming/Mock-It mapping, a known Liquipedia "trap", is **correct**
  in our data: NG = remkoe/Maestro/miztik, Mock-It = paschy90/Deevo/ViolentPanda.)
- **RLCS X** — matches the regional-championship fields.
- **2024** — only 3 single-player diffs (below).

---

## Discrepancies by season

### S6 (2018) — source: …/Season_6   ⚠️ likely roster swap (MED)
- **Chiefs Esports Club** — DS `Torsos, Drippay, Kamii` · LP `CJCJ, Express, shadey`
- **Tainted Minds** — DS `CJCJ, Express, Shadey` · LP `Torsos, Drippay, Kamii`
- → The two OCE rosters look **swapped** between the orgs. Verify on Liquipedia.

### 2021-22 (24) — source: …/2021-22 (+ /2021-22/Wildcard)
NA/EU/OCE/SAM all match. Problems in the smaller regions:
- **MENA · Veloce Esports** — DS `Nwpo, SMW, Fahad77` · LP `Smw, Senzo, Twiz` (MED)
- **MENA · 01 Esports** — DS `Ali, oVaMPiER, Venom` · LP `Zez0nix, ams., M7sN` (MED, full mismatch)
- **APAC · Gaimin Gladiators** — DS `Maxeew, LCT, virtuoso` · LP `LCT, Maxeew, Commutator` (3rd: virtuoso→Commutator)
- **APAC · Senbei Strikers** — DS `ReaLize, Lunatic, popo` · LP `ReaLize, Tenhow, sigms` (MED)
- **SSA · Orlando Pirates Exdee** — DS `2Die4, Darth, DaisyD` · LP `Snowyy, Darth, SkillSteal` (MED)
- **SSA · Bravado Gaming** — DS `Snowyy, Kamz, Pnidh` · LP `2Die4, Daisy, Happymeal` (MED)
  (note 2Die4/Snowyy look swapped between the two SSA orgs)

### 2022-23 (24) — source: …/2022-23
NA/EU match. Problems:
- **OCE · PWR** — DS `Torsos, Fever, bananahead` · LP `Amphis, Torsos, Fever`
- **OCE · Pioneers** — DS `Scrub, Superlachie, Fibérr` · LP `Scrub, bananahead, hntr`
  (bananahead is on Pioneers in LP, not PWR; rosters differ)
- **SAM · Ninjas in Pyjamas** — DS `Aztromick, Motta, swiftt` · LP `Aztromick, Bemmz, Motta` (3rd: swiftt→Bemmz)
- **SAM · KRÜ Esports** — DS `brad, droppz, Shad` · LP `DRUFINHO, droppz, brad` (Shad→DRUFINHO)
- **MENA · Twisted Minds** — DS `SMW, Venom, Nwpo` · LP `Senzo, Smw, Venom` (Nwpo→Senzo)
- **APAC · Gaimin Gladiators** — DS `Maxeew, LCT, virtuoso` · LP `LCT, Maxeew, OSM` (MED — LP team page hinted a mid-event change)
- **APAC · Elevate** — DS `ReaLize, Lunatic, Sigms` · LP `virtuoso, ReaLize, Kamii` (MED)
- **SSA · Limitless** — DS `2Die4, Snowyy, Sweaty` · LP `2Die4, Snowyy, Darth.` (3rd: Sweaty→Darth)
- **SSA · Valiant** — DS `Arceon, Fefe, Rxii` · LP `Werty ^^, Wiiilooo, Sweaty` (MED, full mismatch)

### 2024 (16) — source: …/2024   (mostly clean)
- **EU · Oxygen Esports** — DS `Oski, Joyo, eekso` · LP `archie, Oski, Joyo` (3rd: eekso→archie)
- **OCE · QuikTrip Pioneers** — DS `Superlachie, Scrub, Fibérr` · LP `Amphis, Fibérr, Superlachie` (Scrub→Amphis)
- **SAM · Team Secret** — DS `kv1, Sadness, brad` · LP `kv1, Motta, brad` (Sadness→Motta)

### 2025 (20) — source: …/2025   ⚠️ several real errors
- **EU · Dignitas** — DS `Fiv3Up, bora, Evoh` · LP `stizzy, ApparentlyJack, Joreuz` (full mismatch)
- **EU · Ninjas in Pyjamas** — DS `ApparentlyJack, Joreuz, Stizzy` · LP `nass, Oski, Radosin` (full mismatch)
  → DS appears to put the Dignitas trio (ApparentlyJack/Joreuz/Stizzy) on NiP; LP has them on **Dignitas**.
- **Geekay Esports — region + roster wrong.** DS lists it in **MENA** as `TempoH, ApparentlyJack, mtzR.`; LP has Geekay in the **EU** group stage as `Archie, Joyo, oaly.`. (And so DS MENA has 4 teams vs LP's 3.)
- **OCE · TSM** — DS `Kevin, Sphinx, Catalysm` · LP `Superlachie, Amphis, kaka` — DS looks like it used TSM's **2026** roster here.
- **SAM · FURIA** — DS `swiftt, Lostt, yanxnz` · LP `yANXNZ, Lostt, DRUFINHO` (swiftt→DRUFINHO)
- **SAM · Team Secret** — DS `Motta, suco, drufinho` · LP `kv1, swiftt, Motta` (mismatch)

### 2026 (16) — source: …/2026   (UPCOMING — provisional, expect drift)
Event not played yet. Notable named-team differences vs Liquipedia's current
qualified list (will keep changing):
- **NA 4th seed** — DS `FUT Esports (jstn., Chronic, CHEESE.)` · LP `Virtus.pro (2Piece, Tawk, Wahvey)`
- **SSA** — DS `Pioneers (Sweaty, LuiisP, 2Die4)` · LP `Five Fears (tehqoz, Snowyy, gunz)`
- Several EU/SAM 3rd players differ; LP still shows OCE + 4 Play-In seats as TBD.
- → Recommend **revisiting 2026 after the event** rather than fixing now.

---

## Suggested fix order (when you decide to)
1. **2025 EU + Geekay region** (clear, impactful errors).
2. **S6 OCE swap** (one swap fixes both).
3. **2021-22 / 2022-23 MENA·APAC·SSA** 3rd-player + roster fixes.
4. **2024** three single-player fixes.
5. **Decide S9** (no real Worlds) and **defer 2026** (not played).

Source root: https://liquipedia.net/rocketleague/Rocket_League_Championship_Series/<Season>

---

## ✅ FIXED (2026-06-16) — applied to data-sources/teams.md, regenerated

All roster discrepancies above were corrected at the source (`teams.md`) and the
JSON regenerated; `validate:data` + 42 tests pass, every special-card ref still
resolves. Summary of what changed:

- **S6**: Chiefs Esports Club ↔ Tainted Minds rosters un-swapped.
- **2021-22**: MENA (Veloce → SMW/Senzo/Twiz; 01 Esports → Zez0nix/ams./M7sN),
  APAC (Gaimin Gladiators 3rd → Commutator; Senbei → ReaLize/Tenhow/sigms),
  SSA (Orlando Pirates → Snowyy/Darth/SkillSteal; Bravado → 2Die4/Daisy/Happymeal).
- **2022-23**: OCE (PWR → Amphis/Torsos/Fever; Pioneers → Scrub/bananahead/hntr),
  SAM (KRÜ 3rd → drufinho; NiP → Aztromick/Bemmz/Motta), MENA (Twisted Minds 3rd
  → Senzo), APAC (GG 3rd → OSM; Elevate → ReaLize/virtuoso/Kamii), SSA (Limitless
  → 2Die4/Snowyy/Darth; Valiant → Werty/Wiiilooo/Sweaty).
- **2024**: Oxygen (eekso → archie), QuikTrip Pioneers (Scrub → Amphis),
  Team Secret (Sadness → Motta).
- **2025**: Dignitas → stizzy/ApparentlyJack/Joreuz; Ninjas in Pyjamas →
  nass/Oski/Radosin; **Geekay moved MENA → EU** (archie/Joyo/oaly.); TSM →
  Superlachie/Amphis/kaka; FURIA → yanxnz/Lostt/drufinho; Team Secret →
  kv1/swiftt/Motta.
- **Spelling normalization**: `ExplosiveGyro` → `Gyro.`, `Sweaty_Clarence` →
  `Sweaty`. `zen` (EU) and `ZeN` (OCE) kept separate as required.

**Caveats:** obscure-region rosters (SSA/APAC/MENA) and newly-added players use
**approximate overalls** (the dataset's overalls are curated estimates anyway).

**NOT changed (need a call from Miguel):**
- **S9** — no real World Championship happened (COVID); the dataset keeps a
  12-team approximation. Rework or leave?
- **2026** — not played yet; dataset field is provisional (LP shows NA 4th =
  Virtus.pro not FUT, SSA = Five Fears not Pioneers, + TBD seats). Revisit after
  the event.
- **Special-card themes** — a few titles don't match their anchored era:
  `sp-seikoo-endpoint-breakout` (anchored to Team BDS — seikoo has no Endpoint
  card; retitle or add an Endpoint era?), `sp-snaski-gentle-mates` (anchored to
  Oxygen 2024). Data is valid; these are content/labelling choices.
