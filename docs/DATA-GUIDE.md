# Data Guide

Everything the game knows about RLCS history lives in `src/data/*.json`.
The files are hand-editable: change a value, save, refresh. Every file is
validated on load (zod schema + referential integrity) — a broken reference
fails loudly with a message pointing at the exact id.

Run `npm run validate:data` after editing to check everything without
opening the app.

> **Accuracy disclaimer:** the v0.1 dataset is a best-effort manual curation
> built for testing the game loop, not a historical record. Some
> coach/substitute assignments and country/overall values are approximations
> — fixing them is a JSON edit. Lineups without a known coach either have
> none (older eras) or use a generic "Coaching Staff" card.

---

## Files at a glance

| File | Entity | Counts (v0.1) |
| --- | --- | --- |
| `seasons.json` | RLCS seasons (labels) | 11 |
| `players.json` | Real player identities | 49 |
| `playerCards.json` | Player versions per lineup/season | 72 |
| `orgs.json` | Organizations + buffs | 16 |
| `coaches.json` | Coach cards (incl. generic staff) | 12 |
| `subs.json` | Substitute cards | 4 |
| `lineups.json` | Historical rosters (the draft pool) | 24 |
| `specialCards.json` | Collectible special versions | 10 |
| `achievements.json` | Achievement definitions | 13 |

---

## players.json — identity, never strength

```json
{ "id": "kaydop", "nickname": "Kaydop", "country": "FR", "region": "EU" }
```

- `country`: ISO 3166-1 alpha-2 (`BR`, `FR`, `US`…). Used for chemistry and
  the country chip. Add display names in `src/lib/util.ts` if missing.
- `region`: `NA | EU | SAM | MENA | OCE | APAC`.
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

- `overall` (60-99): the calculated base. `manualAdjustment` (-5..+5) is the
  curator layer (base doc §17) — stored separately so future recalculation
  from API data stays possible. The game uses `overall + manualAdjustment`.
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
- `name` is the display name of that era (e.g. "Renault Vitality" vs
  "Team Vitality").

## orgs.json

```json
{ "id": "team-bds", "name": "Team BDS", "region": "EU",
  "buffType": "consistency", "buffLevel": "++" }
```

- `buffType`: `offense | defense | mechanics | consistency | experience | clutch`
- `buffLevel`: `~ | + | ++ | +++` → internally 0/1/2/3. No negative buffs in
  the MVP (base doc §21). v0.1 caps the dataset at `++` for balance headroom.

## coaches.json

```json
{ "id": "mew-bds-2122", "personId": "mew", "name": "Mew",
  "orgId": "team-bds", "lineupId": "bds-2122", "seasonId": "rlcs-2021-22",
  "overall": 89, "bonusType": "consistency", "bonusLevel": "++" }
```

- `personId` powers the "person can only be drafted once per run" rule —
  the same coach in two seasons shares one `personId`.
- `generic: true` marks anonymous "Coaching Staff" placeholder cards (used
  where the real coach is unknown; replace freely as data improves).

## subs.json

Same shape as coaches minus bonus fields, plus optional `stats`.

## specialCards.json — collectibles

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
  "effect": { "type": "clutch_boost", "value": 3,
              "description": "+3 rating in the deciding game of any series." },
  "flavor": "Season 6 Grand Final. Zero seconds on the clock…"
}
```

- `baseCardId` links the special to the base card it replaces when it appears
  in a draft offer (chance per appearance in `balance.ts → DRAFT`).
- `cardType`: `moment | major_mvp | worlds_mvp | mythic | legend`.
- `rarity`: `rare | epic | mythic | legendary` (visual + collection grouping).
- `effect.type` (implemented in `engine/match.ts`):
  - `clutch_boost` — + value in the deciding game of a series
  - `swiss_consistency` — small flat bonus during Swiss games
  - `playoff_experience` — small flat bonus during playoff games
  - `upset_boost` — + value when facing a higher-rated team
  - `defense_stability` — dampens this team's negative variance
  - `high_roll` — bigger mechanics-proc spikes
- Unlock rule (base doc §12): drafted + run completed (win not required).

## achievements.json

```json
{ "id": "swiss-merchant", "title": "Swiss Merchant",
  "description": "Go 3-0 in the Swiss stage.", "xp": 50 }
```

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

**Make a player stronger/weaker:** prefer `manualAdjustment` over editing
`overall` — that's what the field is for.

**Add a special card:** new entry in `specialCards.json` pointing at an
existing base card. It immediately becomes draftable + collectible.

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
