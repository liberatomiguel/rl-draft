/**
 * Data access layer.
 *
 * Loads the JSON dataset once and exposes typed arrays + lookup maps.
 * Everything else in the app reads data through this module — swapping JSON
 * for a Liquipedia-fed database later means changing only this file's
 * implementation, not its exports. The one exception is the SHARED path (root
 * layout, home, content pages): it reads `./catalog` and `./counts`, so the
 * dataset loads only on the pages that play with it (rc.26, #60).
 *
 * Validation (zod schemas + referential integrity) is NOT done here: it runs at
 * build/CI time via `validateDataset()` in `./validate.ts`, called by
 * `integrity.test.ts` (`npm run validate:data`, part of `npm test`). The JSON is
 * static and baked into the bundle, so re-validating it on every page load only
 * cost the client zod (~65 KB gz) and 30-150 ms of main thread (v1.5 perf pass).
 * The same test asserts the zod-parsed dataset deep-equals these casts (zod
 * reshaped nothing except stripping one undeclared key, replicated below), so
 * the runtime records hold exactly the values the old parse produced.
 * Do NOT import `./schemas` or `./validate` from here (or any client module).
 */

import playersJson from "./players.json";
import seasonsJson from "./seasons.json";
import playerCardsJson from "./playerCards.json";
import orgsJson from "./orgs.json";
import coachesJson from "./coaches.json";
import subsJson from "./subs.json";
import lineupsJson from "./lineups.json";
import specialCardsJson from "./specialCards.json";
import cardIdAliasesJson from "./cardIdAliases.json";

import { REGION_LOCK, SPECIALS } from "@/config/balance";
import { achievementById, achievements, challengeById, challenges, toMap } from "./catalog";
import { NATIONAL_SPECIAL_PREFIX } from "./counts";
import type {
  CoachCard,
  Lineup,
  Org,
  Player,
  PlayerCard,
  Region,
  Season,
  SpecialCard,
  StatKey,
  SubCard,
} from "@/engine/types";

// ---------------------------------------------------------------------------
// Typed views of the (build-time validated) JSON files
// ---------------------------------------------------------------------------

export const players = playersJson as Player[];

export const seasons = seasonsJson as Season[];

export const playerCards = playerCardsJson as PlayerCard[];

export const orgs = orgsJson as Org[];

export const coaches = coachesJson as CoachCard[];

export const subs = subsJson as SubCard[];

export const lineups = lineupsJson as Lineup[];

/**
 * A region-only roster (v1.2.0; any region since v2.0 — `samOnly` is the
 * historical name). It never enters the general draft, the general opponent
 * field or the dailies: it plays only in its region's Region-only mode. In a
 * region WITHOUT that mode (APAC, SSA — too few rosters for a 16-team regional
 * event) it stays dormant until the region opens (rc.26, Miguel's call).
 */
export function isRegionOnly(l: Lineup): boolean {
  return Boolean(l.samOnly);
}

/** Whether a lineup can show up in some draft today (dormant region-only = no). */
export function isObtainable(l: Lineup): boolean {
  return !l.samOnly || REGION_LOCK.regions.includes(l.region);
}

/**
 * The pool the GENERAL draft / opponents / daily challenges draw from: the
 * international rosters. Region-only lineups (plus the Wings easter egg) are
 * excluded here and surface ONLY in their region's Region-only mode, which
 * builds its own pool from the full `lineups` set (v1.2.0). National teams are
 * excluded too — they are a special draw of their own (v2.0, draft.ts).
 */
export const draftableLineups = lineups.filter((l) => !isRegionOnly(l) && !l.national);

/** National teams a WORLDWIDE classic/quick draft can inject (v2.0): not region-only. */
export const worldNationalLineups = lineups.filter((l) => l.national && !isRegionOnly(l));

/** National teams that can be found today — the album's set (dormant ones join when their region opens). */
export const obtainableNationalLineups = lineups.filter((l) => l.national && isObtainable(l));

/**
 * Lineup ids for the Region-only mode (v1.2.0). Includes the region's
 * international rosters AND its region-only ones — the "larger regional pool" —
 * plus its national teams and easter eggs, which the draft separates out.
 */
export function lineupPoolForRegion(region: Region): string[] {
  return lineups.filter((l) => l.region === region).map((l) => l.id);
}

/**
 * `specialCards.json` (hand-curated) carries `"secret": true` on the two Wings
 * tribute cards — a key the SpecialCard schema/type never declared, so the old
 * load-time zod parse silently stripped it. Strip it here too, so the runtime
 * objects stay exactly what the parse produced (integrity.test.ts asserts deep
 * equality with the zod output; any OTHER undeclared key fails that test). Only
 * the cards that carry the key are copied.
 */
function withoutUndeclaredKeys(card: SpecialCard): SpecialCard {
  if (!("secret" in card)) return card;
  const declared: SpecialCard & { secret?: unknown } = { ...card };
  delete declared.secret;
  return declared;
}

/** The hand-curated catalogue (specialCards.json). */
const fileSpecialCards = (specialCardsJson as SpecialCard[]).map(withoutUndeclaredKeys);

/**
 * Achievements and challenges come from the light catalog (rc.26, #60): the
 * root layout reads them without this barrel, and re-exporting keeps one copy
 * of each map on the pages that load both.
 */
export { achievementById, achievements, challengeById, challenges };

// ---------------------------------------------------------------------------
// Lookup maps (`toMap`, from ./catalog, rejects a duplicate id)
// ---------------------------------------------------------------------------

export const playerById = toMap("players", players);
export const seasonById = toMap("seasons", seasons);
export const playerCardById = toMap("playerCards", playerCards);

/**
 * Renamed player cards (v2.0, data fix D01). A fix that moves a player to the
 * right lineup changes the card id (`<person>-<lineup>`), but old ids live on in
 * saves — run-history replays, a run in progress during a deploy, cloud rows
 * written by older builds. Each old id stays a LOOKUP KEY for the corrected
 * card, so everything saved keeps resolving and the persist contract is
 * untouched. `cardIdAliases.json` (old → new) is checked by integrity.test.ts.
 */
export const cardIdAliases = cardIdAliasesJson as Record<string, string>;
for (const [oldId, newId] of Object.entries(cardIdAliases)) {
  const card = playerCardById.get(newId);
  if (card && !playerCardById.has(oldId)) playerCardById.set(oldId, card);
}
export const orgById = toMap("orgs", orgs);
export const coachById = toMap("coaches", coaches);
export const subById = toMap("subs", subs);
export const lineupById = toMap("lineups", lineups);

/**
 * National-team cards (v2.0): EVERY card of a national lineup — players, coach
 * and sub — is a special of rarity "national", DERIVED here (never hand-written
 * in specialCards.json, whose schema rejects it), so a roster edit in teams.md
 * carries over by itself. Id = `nt-<base card id>` (stable, saved in profiles).
 * They join `specialCards` / `specialCardById` (collection, results, cloud
 * prune) but NOT the per-person roll pools below: a national card only ever
 * shows on its own national lineup (engine/draft.ts).
 */
const ALL_STATS: StatKey[] = ["offense", "defense", "mechanics", "consistency", "experience", "clutch"];
function nationalSpecial(
  lineup: Lineup,
  base: { id: string; personId: string; name: string; overall: number },
  coach: boolean,
): SpecialCard {
  const nation = orgById.get(lineup.orgId)?.name ?? lineup.name;
  const edition = seasonById.get(lineup.seasonId)?.label ?? lineup.seasonId;
  const boost = SPECIALS.national.teamBoost;
  return {
    id: `${NATIONAL_SPECIAL_PREFIX}${base.id}`,
    ...(coach ? { kind: "coach" as const } : {}),
    playerId: base.personId,
    baseCardId: base.id,
    title: nation,
    cardType: "national",
    rarity: "national",
    overall: Math.min(99, base.overall + SPECIALS.national.overallDelta),
    effect: {
      type: "team_attribute_boost",
      attributes: ALL_STATS,
      value: boost,
      description: `+${boost} to every team attribute — the national colours.`,
    },
    flavor: `${base.name} wore ${nation}'s colours at ${edition}.`,
  };
}
const nationalSpecialCards: SpecialCard[] = [];
/** National lineup id → its national special ids (players, then coach, then sub). */
export const nationalSpecialIdsByLineupId = new Map<string, string[]>();
/** Base card id (a player / coach / sub card of a national lineup) → its national special. */
export const nationalSpecialByCardId = new Map<string, SpecialCard>();
for (const lineup of lineups) {
  if (!lineup.national) continue;
  const derived: SpecialCard[] = lineup.playerCardIds.map((id) => {
    const card = playerCardById.get(id)!;
    const name = playerById.get(card.playerId)?.nickname ?? card.playerId;
    return nationalSpecial(lineup, { id, personId: card.playerId, name, overall: card.overall }, false);
  });
  const coach = lineup.coachId ? coachById.get(lineup.coachId) : undefined;
  if (coach) {
    derived.push(
      nationalSpecial(lineup, { id: coach.id, personId: coach.personId, name: coach.name, overall: coach.overall }, true),
    );
  }
  const sub = lineup.subId ? subById.get(lineup.subId) : undefined;
  if (sub) {
    derived.push(
      nationalSpecial(lineup, { id: sub.id, personId: sub.personId, name: sub.name, overall: sub.overall }, false),
    );
  }
  for (const sp of derived) nationalSpecialByCardId.set(sp.baseCardId, sp);
  nationalSpecialIdsByLineupId.set(lineup.id, derived.map((sp) => sp.id));
  nationalSpecialCards.push(...derived);
}

/** Every special: the curated catalogue, then the derived national cards. */
export const specialCards: SpecialCard[] = [...fileSpecialCards, ...nationalSpecialCards];
export const specialCardById = toMap("specialCards", specialCards);

/**
 * Special versions per PERSON (v0.5): a special belongs to the player, so any
 * card of theirs can roll it (zen has a legendary, a Worlds MVP, a Major MVP
 * and moments — all reachable from every zen card). `baseCardId` remains the
 * display/stat anchor only. Player and coach specials are separate pools.
 */
export const specialsByPlayerId = new Map<string, SpecialCard[]>();
export const coachSpecialsByPersonId = new Map<string, SpecialCard[]>();
for (const sp of fileSpecialCards) {
  const map = sp.kind === "coach" ? coachSpecialsByPersonId : specialsByPlayerId;
  const list = map.get(sp.playerId) ?? [];
  list.push(sp);
  map.set(sp.playerId, list);
}

/**
 * Career history per player (v1.3.3): the set of orgs and lineups a player has
 * EVER been part of, across all their cards. Drives "shared past" chemistry — two
 * players who once shared an org/lineup link even when their drafted cards differ
 * (e.g. drufinho's KRU card + a teammate from his old FURIA roster).
 */
export const careerByPlayerId = new Map<
  string,
  { orgIds: Set<string>; lineupIds: Set<string> }
>();
for (const card of playerCards) {
  // National-team history stays out (v2.0): compatriots already link by country,
  // and a national roster is not a shared club past.
  if (lineupById.get(card.lineupId)?.national) continue;
  let entry = careerByPlayerId.get(card.playerId);
  if (!entry) {
    entry = { orgIds: new Set(), lineupIds: new Set() };
    careerByPlayerId.set(card.playerId, entry);
  }
  entry.orgIds.add(card.orgId);
  entry.lineupIds.add(card.lineupId);
}

// Referential integrity (playerCards → players/orgs/seasons, lineups → cards/
// coach/sub, specials → base cards, challenges → lineups/ranks/prereqs/…) is
// asserted by `assertReferentialIntegrity` in ./validate.ts, run in CI.

/** Quick dataset stats — handy for docs and the collection screen. */
export const datasetSummary = {
  players: players.length,
  playerCards: playerCards.length,
  lineups: lineups.length,
  orgs: orgs.length,
  coaches: coaches.length,
  subs: subs.length,
  specialCards: specialCards.length,
  achievements: achievements.length,
  challenges: challenges.length,
};
