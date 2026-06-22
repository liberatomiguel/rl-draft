# Data Guide

## ⚙️ The dataset pipeline (v0.4+)

The JSONs in `src/data/` are **GENERATED** — the source of truth is
**`data-sources/teams.md`** (the curated "all RLCS finals teams" archive,
259 lineups across 2016-2026). To update the dataset:

1. Edit `data-sources/teams.md` (same team-block format, see the file).
2. Run `npm run build:data`.
3. Run `npm run validate:data` (schema + referential integrity).

The generator (`scripts/build-dataset.mjs`) handles: person identity
de-duplication across nickname variants ("jstn"/"JSTN"/"jstn."), the
known ZeN(OCE) ≠ zen(FR) collision, curated nationalities (near-full
coverage, 371/377 players; the rest have none — same-country chemistry
skips them), org buff levels
**per season** (`lineups[].orgBuffLevel` override; the org entity keeps the
strongest level as default), derived coach bonuses (level from overall,
type from a stable hash), derived `historicalStrength` (avg overall:
≥91 elite · ≥87 strong · ≥82 solid · else underdog) and the special-cards
catalogue (with base-card season hints + rarity mapping:
legendary→legendary · worlds_mvp→mythic · major_mvp→epic · mythic→mythic ·
moment→rare). Special effects use the v3 model: `attribute_boost` on the
card's stats, `team_attribute_boost` for coach specials.

Hand-edits to the generated JSONs are fine for quick experiments but will
be OVERWRITTEN by the next `build:data` — put permanent changes in
`data-sources/teams.md` or in the generator's curated maps.

Everything is validated on load (zod schema + referential integrity) — a
broken reference fails loudly with a message pointing at the exact id.

> **Accuracy disclaimer:** the dataset is a best-effort manual curation
> built for testing the game loop, not a historical record. Some
> coach/substitute assignments and country/overall values are approximations
> — fixing them is a JSON edit. Lineups without a known coach either have
> none (older eras) or use a generic "Coaching Staff" card.

---

## Files at a glance

| File | Entity | Counts (approx — run build:data) |
| --- | --- | --- |
| `seasons.json` | RLCS seasons (labels) | 15 |
| `players.json` | Real player identities | 377 |
| `playerCards.json` | Player versions per lineup/season | 777 |
| `orgs.json` | Organizations + buffs | 138 |
| `coaches.json` | Coach cards (incl. generic staff) | 132 |
| `subs.json` | Substitute cards | 104 |
| `lineups.json` | Historical rosters (the draft pool) | 259 |
| `specialCards.json` | Collectible special versions | 86 |
| `achievements.json` | Achievement definitions | 56 |

---

## players.json — identity, never strength

```json
{ "id": "kaydop", "nickname": "Kaydop", "country": "FR", "region": "EU" }
```

- `country`: ISO 3166-1 alpha-2 (`BR`, `FR`, `US`…). Used for chemistry and
  the country chip. Add display names in `src/lib/util.ts` if missing.
- `region`: `NA | EU | SAM | MENA | OCE | APAC | SSA`.
- One entry per person. **Strength lives on cards, not here** (base doc §9).

## playerCards.json — one card per player per lineup

```json
{
  "id": "kaydop-vitality-s7",
  "playerId": "kaydop",
  "orgId": "team-vitality",
  "lineupId": "vitality-s7",
  "seasonId": "rlcs-s7",
  "overall": 92,
  "manualAdjustment": 0,
  "stats": { "offense": 92, "defense": 91, "mechanics": 93,
             "consistency": 91, "experience": 90, "clutch": 92 }
}
```

- `overall` (60-99): the calculated base. The game uses
  `overall + manualAdjustment`, but **`manualAdjustment` is always `0`** —
  the generator hardcodes it (`build-dataset.mjs:463`), so any hand-set value
  is wiped on the next `build:data`. It's a reserved hook for a future curator
  layer (base doc §17); today it does nothing. **To change a player's strength,
  edit the overall in `teams.md`** (or use `scripts/apply-overall-review.mjs`)
  and rebuild.
- `stats` is **optional** (per key too). Missing stats fall back to the card
  overall in the engine — the simulation is fully playable with overall only.
- Rarity is derived, never stored: ≤79 silver · 80-89 gold · 90+ blue.
- `imageUrl` optional; placeholder art (initials hex) renders when empty.
- Convention for `id`: `<playerId>-<org>-<season>`.

## lineups.json — the draft pool AND the opponent pool

```json
{
  "id": "vitality-s7",
  "name": "Renault Vitality",
  "seasonId": "rlcs-s7",
  "orgId": "team-vitality",
  "region": "EU",
  "playerCardIds": ["fairy-peak-vitality-s7", "kaydop-vitality-s7", "alpha54-vitality-s7"],
  "coachId": "...optional...",
  "subId": "...optional...",
  "historicalStrength": "elite"
}
```

- Exactly 3 `playerCardIds`, and each card's `lineupId` must point back at
  this lineup (validated).
- `coachId` / `subId` optional — the draft offer simply shows fewer cards.
- `historicalStrength`: `elite | strong | solid | underdog`. **Only** used to
  weight opponent generation by difficulty. It never affects the draft pool.
  Derived from average overall (≥91 elite · ≥87 strong · ≥82 solid · else
  underdog), **but** a block flagged `legacy` in `teams.md` is floored at
  **"strong"** (a naturally-elite lineup keeps elite) — a regional landmark whose
  raw overalls are below the cut still headlines its region's legacy gauntlet.
- `samOnly` (optional): a SAM Top-8 team that missed Worlds — region-locked.
  Excluded from `draftableLineups` (the worldwide draw); shown only in the
  region-locked SAM mode / larger regional pool. Set by the `sam-only` flag in
  `teams.md`.
- `rareSpawn` (optional): an easter-egg lineup drawn far less often than normal
  (`DRAFT.rareSpawnWeight`). Set by the `rare` flag in `teams.md`.
- Flags live on the team block's `flag:` line in `teams.md`, comma-separated;
  spellings are `sam-only`, `rare`, `legacy` (unknown flags are ignored).
- `name` is the display name of that era (e.g. "Renault Vitality" vs
  "Team Vitality").

## orgs.json

```json
{ "id": "team-bds", "name": "Team BDS", "region": "EU",
  "buffType": "consistency", "buffLevel": "++",
  "logoEras": [{ "key": "classic", "untilOrder": 9 }] }
```

- `buffType`: `offense | defense | mechanics | consistency | experience | clutch`
- `buffLevel`: `~ | + | ++ | +++` → internally 0/1/2/3. No negative buffs in
  the MVP (base doc §21). v0.1 caps the dataset at `++` for balance headroom.
- **Identity rules (v0.5)**: era spellings/sponsor names unify into ONE org
  id (`ORG_ALIAS` in the generator — "Renault Vitality" → `team-vitality`);
  same-name strangers split per region (`REGION_SPLIT_ORGS` — `pioneers-oce`
  ≠ `pioneers-ssa`). Lineups keep the era display name. Guarded by tests.
- **`logoEras` (v0.5.1)**: cards/lineups whose season `order` ≤ `untilOrder`
  use `public/orgs/<orgId>@<key>.png` (falls back to the default logo).
  Curate in `ORG_LOGO_ERAS` in `scripts/build-dataset.mjs`; exact Liquipedia
  files can be pulled via the `"orgFiles"` block of
  `data-sources/asset-overrides.json`. Seasons carry `order` (1 = RLCS S1)
  for this resolution.

## coaches.json

```json
{ "id": "mew-bds-2122", "personId": "mew", "name": "Mew",
  "country": "FR", "region": "EU",
  "orgId": "team-bds", "lineupId": "bds-2122", "seasonId": "rlcs-2021-22",
  "overall": 89, "bonusType": "consistency", "bonusLevel": "++" }
```

- `personId` powers the "person can only be drafted once per run" rule —
  the same coach in two seasons shares one `personId`.
- `generic: true` marks anonymous "Coaching Staff" placeholder cards (used
  where the real coach is unknown; replace freely as data improves).
  **Currently unused** — the dataset has 0 generic coach cards.

## subs.json

Same shape as coaches minus bonus fields, plus optional `stats`.

## specialCards.json — collectibles

> **HAND-MAINTAINED (since v1.1.1).** Unlike the other data files, this one is
> NOT generated. Edit it directly, then run `npm run validate:data`.
> `npm run build:data` no longer overwrites it — it only re-checks that every
> `baseCardId` resolves. The old `SPECIALS` catalogue in the generator is
> reference-only. Each card must point `playerId` + `baseCardId` at ids that
> exist in `players.json` / `playerCards.json` (or `coaches.json` for coach
> specials); the loader fails loudly with the offending id if not.

```json
{
  "id": "sp-jstn-this-is-rocket-league",
  "playerId": "jstn",
  "baseCardId": "jstn-nrg-s6",
  "title": "This Is Rocket League",
  "cardType": "moment",
  "rarity": "mythic",
  "overall": 96,
  "stats": { "...": "optional" },
  "effect": { "type": "attribute_boost", "attributes": ["experience", "clutch"],
              "value": 5, "description": "+5 experience and clutch." },
  "flavor": "Season 6 Grand Final. Zero seconds on the clock…"
}
```

- **The special is owned by `playerId`** (v0.5): ANY card of that player can
  roll it in a draft offer (v1.4: each rarity rolls at its own ABSOLUTE rate
  `balance.ts → SPECIALS.rarityChance`, rarest-first — so a lone-legendary
  player no longer over-appears). `baseCardId` anchors the
  special's own historical moment — the org/season it displays AND the
  lineup/org used for chemistry when drafted.
- `cardType`: `moment | major_mvp | worlds_mvp | season_mvp | mythic | legend | coach`
  (`season_mvp` added v1.1.1 — a season-MVP award kept distinct from `worlds_mvp`
  so a league/season MVP isn't mislabelled as a world title).
- `kind` (optional, v1.4): `player | coach`. Defaults to `player` when omitted.
  A `coach` special is owned by a coach `personId` and resolves its `baseCardId`
  against `coaches.json` (routed through `coachSpecialsByPersonId`), so it draws
  in the coach slot with a `team_attribute_boost` effect; player specials take
  the default player path.
- `rarity`: `rare | epic | mythic | legendary | creator | wings | community`
  (visual + collection grouping). `creator`/`wings` are secret easter-egg
  rarities (liberatoRL's Creator card; the Wings E-Sports cards) and `community`
  (emerald/teal) is the content-creator tier — all three added/finalised in v1.4,
  see DESIGN-DECISIONS #90.
- `effect` — the v3 flat-boost model used by all 93 cards:
  - player specials: `{ type: "attribute_boost", attributes: [StatKey, …],
    value, description }` — adds `value` to each listed stat (`StatKey` =
    `offense | defense | mechanics | consistency | experience | clutch`).
  - coach specials: `{ type: "team_attribute_boost", attributes: [StatKey, …],
    value, description }` — same, applied across the team.
  - `overallBonus` (optional, v1.3.3) — a flat bonus to the team's FINAL overall,
    independent of the attribute boost. Used by the Creator card (+7). Stacks
    across the roster; capped 0–7 by the schema.
  - The older situational types (`clutch_boost`, `swiss_consistency`,
    `playoff_experience`, `upset_boost`, `defense_stability`, `high_roll`) are
    still accepted by the schema/engine for back-compat, but **no current card
    uses them**.
- Unlock rule (base doc §12): drafted + run completed (win not required).

## achievements.json

```json
{ "id": "swiss-merchant", "title": "Swiss Merchant",
  "description": "Go 3-0 in the Swiss stage.", "xp": 50,
  "category": "rare", "group": "performance" }
```

- `category`: `common | rare | epic | legend` (visual tier).
- `group` (**required**, v1.4): the section bucket on the achievements screen —
  `milestone | mode | performance | chemistry | roster | collection |
  progression`. Distinct from `category` (which is only the visual rarity tier).
- `secret` (optional): hidden until unlocked.

The check logic lives in `src/engine/achievements.ts` — adding a new
achievement = one JSON entry + one rule function with the same id.

---

## Recipes

**Add a lineup** (the most common edit):
1. Add 3 entries to `playerCards.json` (create `players.json` identities if
   new people).
2. Add the org to `orgs.json` if new.
3. Optionally add a coach/sub card.
4. Add the lineup to `lineups.json` referencing those ids.
5. `npm run validate:data`.

**Make a player stronger/weaker:** edit the overall in `data-sources/teams.md`
(or use `scripts/apply-overall-review.mjs`) and rebuild. Do **not** hand-edit
`manualAdjustment` — the generator hardcodes it to `0` (`build-dataset.mjs:463`),
so the value is wiped on the next `build:data`.

**Apply a community overall / line review (the GWR CSV workflow):** the reviewer
hands back a CSV in the `data-sources/overall-review-*.csv` format — one row per
player/sub/coach, with **`OVR sugerido`** = the new overall and **`Legacy`** in
the "Sugestão de line/time" column to flag a legacy-gauntlet roster. Apply it
safely with the bundled tool (UTF-8 safe; never bulk-edit `teams.md` via
PowerShell `-replace`):
1. **Dry-run** — `node scripts/apply-overall-review.mjs <review.csv>` reports
   every overall change, every legacy flag, free-text notes, and any `OVR atual`
   that disagrees with `teams.md` (**drift**). Writes nothing.
2. **Resolve drift** if reported (the CSV's "current" is stale, or the JSON was
   hand-edited and `teams.md` never rebuilt) — the tool refuses to write while
   drift exists; `--force` overrides.
3. **Apply** — `node scripts/apply-overall-review.mjs <review.csv> --apply`
   edits `teams.md` (overalls in place; `legacy` appended to the `flag:` line,
   which floors that lineup's `historicalStrength` at "strong").
4. `npm run build:data && npm run validate:data && npm test`.
5. **Free-text notes** (e.g. "missing X as sub (NN)") are *not* auto-applied —
   make those line edits in `teams.md` by hand (a `player N:` / `sub:` / `coach:`
   line is `<Nick> <overall>`), then rebuild.

**Produce a fresh review table for the next pass:**
`node scripts/apply-overall-review.mjs --export data-sources/overall-review-<ver>.csv`
dumps the current dataset in the exact same column model (new overalls as
`OVR atual`, `OVR sugerido` blank, `Legacy` marks preserved). The export format
*is* the apply-input format, so it round-trips (export → apply = zero changes).

**Add a special card:** new entry in `specialCards.json` (hand-maintained)
pointing at an existing base card, then `npm run validate:data`. It immediately
becomes draftable + collectible. The `playerId` must match a player exactly —
watch for nickname-spelling drift (`exotiik`, not `exotiiik`); the validator
prints the bad id if a ref doesn't resolve.

**Add multiple logos for one org (logo eras):** an org that rebranded can show
a different logo per era. Edit the `ORG_LOGO_ERAS` map in
`scripts/build-dataset.mjs` (it has a full step-by-step comment + a season-key
cheat sheet + a worked NRG example), then `npm run build:data` and drop the
PNGs named per the regenerated `public/orgs/README.md`. Rules of thumb:
- One entry per OLD logo, **oldest first**; `until` = the last season that old
  logo was used (a season key like `S8`, `"2022-23"`). `key` is any short label
  you choose; it becomes the filename suffix.
- The **current/newest** logo needs no entry — it's the default `<orgId>.png`.
  So N logos = (N−1) entries + the default file.
- Missing images fall back gracefully (era → default → monogram). Resolved at
  render time by `src/components/ui/TeamLogo.tsx` from the card's season order.

## Images (drop-in, no code changes)

| Asset | Path | Fallback |
| --- | --- | --- |
| Org logos | `public/orgs/<orgId>.png` | monogram placeholder |
| Rank art (menu set) | `public/ranks/menu/<rankId>.png` | CSS emblem |
| Rank art (profile set) | `public/ranks/profile/<rankId>.png` | CSS emblem |
| Special card photos | `public/cards/specials/<specialId>.png` | stylized art |

Each folder has a README listing the exact expected filenames. Base player
cards intentionally have NO player photo — the org logo is the centerpiece;
only special cards carry photos.

## Future: Liquipedia API (MVP 4)

The only contract the app depends on is the exports of `src/data/index.ts`
(typed arrays + lookup maps). The integration plan:

1. A build-time script fetches Liquipedia data and **generates these same
   JSON files** (keeping `manualAdjustment` overrides in a separate file that
   merges on top).
2. Zod schemas stay as the safety net for generated data.
3. Nothing in `engine/`, `store/` or the UI changes.
