/**
 * Data access layer.
 *
 * Loads the JSON dataset once, validates it (schema + referential integrity)
 * and exposes typed lookup maps. Everything else in the app reads data through
 * this module — swapping JSON for a Liquipedia-fed database later means
 * changing only this file's implementation, not its exports.
 */

import playersJson from "./players.json";
import seasonsJson from "./seasons.json";
import playerCardsJson from "./playerCards.json";
import orgsJson from "./orgs.json";
import coachesJson from "./coaches.json";
import subsJson from "./subs.json";
import lineupsJson from "./lineups.json";
import specialCardsJson from "./specialCards.json";
import achievementsJson from "./achievements.json";

import {
  achievementsFileSchema,
  coachesFileSchema,
  lineupsFileSchema,
  orgsFileSchema,
  playerCardsFileSchema,
  playersFileSchema,
  seasonsFileSchema,
  specialCardsFileSchema,
  subsFileSchema,
} from "./schemas";

import type {
  AchievementDef,
  CoachCard,
  Lineup,
  Org,
  Player,
  PlayerCard,
  Season,
  SpecialCard,
  SubCard,
} from "@/engine/types";

// ---------------------------------------------------------------------------
// Parse + validate
// ---------------------------------------------------------------------------

function parse<T>(label: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    throw new Error(
      `[data] Invalid ${label}.json — fix the data file.\n${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const players = parse("players", () =>
  playersFileSchema.parse(playersJson),
) as Player[];

export const seasons = parse("seasons", () =>
  seasonsFileSchema.parse(seasonsJson),
) as Season[];

export const playerCards = parse("playerCards", () =>
  playerCardsFileSchema.parse(playerCardsJson),
) as PlayerCard[];

export const orgs = parse("orgs", () => orgsFileSchema.parse(orgsJson)) as Org[];

export const coaches = parse("coaches", () =>
  coachesFileSchema.parse(coachesJson),
) as CoachCard[];

export const subs = parse("subs", () => subsFileSchema.parse(subsJson)) as SubCard[];

export const lineups = parse("lineups", () =>
  lineupsFileSchema.parse(lineupsJson),
) as Lineup[];

export const specialCards = parse("specialCards", () =>
  specialCardsFileSchema.parse(specialCardsJson),
) as SpecialCard[];

export const achievements = parse("achievements", () =>
  achievementsFileSchema.parse(achievementsJson),
) as AchievementDef[];

// ---------------------------------------------------------------------------
// Lookup maps
// ---------------------------------------------------------------------------

function toMap<T extends { id: string }>(label: string, items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) {
      throw new Error(`[data] Duplicate id "${item.id}" in ${label}.json`);
    }
    map.set(item.id, item);
  }
  return map;
}

export const playerById = toMap("players", players);
export const seasonById = toMap("seasons", seasons);
export const playerCardById = toMap("playerCards", playerCards);
export const orgById = toMap("orgs", orgs);
export const coachById = toMap("coaches", coaches);
export const subById = toMap("subs", subs);
export const lineupById = toMap("lineups", lineups);
export const specialCardById = toMap("specialCards", specialCards);
export const achievementById = toMap("achievements", achievements);

/**
 * Special versions per PERSON (v0.5): a special belongs to the player, so any
 * card of theirs can roll it (zen has a legendary, a Worlds MVP, a Major MVP
 * and moments — all reachable from every zen card). `baseCardId` remains the
 * display/stat anchor only. Player and coach specials are separate pools.
 */
export const specialsByPlayerId = new Map<string, SpecialCard[]>();
export const coachSpecialsByPersonId = new Map<string, SpecialCard[]>();
for (const sp of specialCards) {
  const map = sp.kind === "coach" ? coachSpecialsByPersonId : specialsByPlayerId;
  const list = map.get(sp.playerId) ?? [];
  list.push(sp);
  map.set(sp.playerId, list);
}

// ---------------------------------------------------------------------------
// Referential integrity — fail loudly on broken links between files
// ---------------------------------------------------------------------------

function assertRef(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[data] ${message}`);
}

for (const card of playerCards) {
  assertRef(playerById.has(card.playerId), `playerCards: "${card.id}" → unknown playerId "${card.playerId}"`);
  assertRef(orgById.has(card.orgId), `playerCards: "${card.id}" → unknown orgId "${card.orgId}"`);
  assertRef(seasonById.has(card.seasonId), `playerCards: "${card.id}" → unknown seasonId "${card.seasonId}"`);
}

for (const coach of coaches) {
  assertRef(orgById.has(coach.orgId), `coaches: "${coach.id}" → unknown orgId "${coach.orgId}"`);
  assertRef(seasonById.has(coach.seasonId), `coaches: "${coach.id}" → unknown seasonId "${coach.seasonId}"`);
}

for (const sub of subs) {
  assertRef(orgById.has(sub.orgId), `subs: "${sub.id}" → unknown orgId "${sub.orgId}"`);
  assertRef(seasonById.has(sub.seasonId), `subs: "${sub.id}" → unknown seasonId "${sub.seasonId}"`);
}

for (const lineup of lineups) {
  assertRef(orgById.has(lineup.orgId), `lineups: "${lineup.id}" → unknown orgId "${lineup.orgId}"`);
  assertRef(seasonById.has(lineup.seasonId), `lineups: "${lineup.id}" → unknown seasonId "${lineup.seasonId}"`);
  for (const cardId of lineup.playerCardIds) {
    assertRef(playerCardById.has(cardId), `lineups: "${lineup.id}" → unknown playerCardId "${cardId}"`);
    const card = playerCardById.get(cardId)!;
    assertRef(card.lineupId === lineup.id, `lineups: "${lineup.id}" → card "${cardId}" belongs to lineup "${card.lineupId}"`);
  }
  if (lineup.coachId) {
    assertRef(coachById.has(lineup.coachId), `lineups: "${lineup.id}" → unknown coachId "${lineup.coachId}"`);
  }
  if (lineup.subId) {
    assertRef(subById.has(lineup.subId), `lineups: "${lineup.id}" → unknown subId "${lineup.subId}"`);
  }
}

for (const sp of specialCards) {
  if (sp.kind === "coach") {
    assertRef(coachById.has(sp.baseCardId), `specialCards: "${sp.id}" → unknown coach baseCardId "${sp.baseCardId}"`);
    const base = coachById.get(sp.baseCardId)!;
    assertRef(base.personId === sp.playerId, `specialCards: "${sp.id}" → coach card belongs to "${base.personId}", not "${sp.playerId}"`);
  } else {
    assertRef(playerById.has(sp.playerId), `specialCards: "${sp.id}" → unknown playerId "${sp.playerId}"`);
    assertRef(playerCardById.has(sp.baseCardId), `specialCards: "${sp.id}" → unknown baseCardId "${sp.baseCardId}"`);
    const base = playerCardById.get(sp.baseCardId)!;
    assertRef(base.playerId === sp.playerId, `specialCards: "${sp.id}" → base card belongs to "${base.playerId}", not "${sp.playerId}"`);
  }
}

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
};
