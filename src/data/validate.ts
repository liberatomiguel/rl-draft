/**
 * Dataset validation — schema + referential integrity (build/CI time only).
 *
 * Until v1.5 this ran inside `src/data/index.ts` at module load, so every page
 * shipped zod (~65 KB gz) and spent 30-150 ms of main thread re-validating a
 * dataset that never changes after the build. It now runs ONLY from
 * `src/data/integrity.test.ts` (`npm run validate:data`, part of `npm test`);
 * the runtime module serves typed casts of the same JSON files.
 *
 * NEVER import this module (or `./schemas`) from app/client code — it would pull
 * zod back into the browser bundle. `validateDataset` is pure: it never mutates
 * its input and throws an `Error` whose message starts with `[data]` and names
 * the file + record id at fault.
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
import challengesJson from "./challenges.json";

import { RANKS } from "@/config/balance";
import {
  achievementsFileSchema,
  challengesFileSchema,
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
  Challenge,
  CoachCard,
  Lineup,
  Org,
  Player,
  PlayerCard,
  Season,
  SpecialCard,
  SubCard,
} from "@/engine/types";

/** The ten dataset files, keyed by file name (without `.json`), as raw input. */
export interface RawDataset {
  players: unknown;
  seasons: unknown;
  playerCards: unknown;
  orgs: unknown;
  coaches: unknown;
  subs: unknown;
  lineups: unknown;
  specialCards: unknown;
  achievements: unknown;
  challenges: unknown;
}

/** The dataset after zod parsing, typed with the engine types. */
export interface ParsedDataset {
  players: Player[];
  seasons: Season[];
  playerCards: PlayerCard[];
  orgs: Org[];
  coaches: CoachCard[];
  subs: SubCard[];
  lineups: Lineup[];
  specialCards: SpecialCard[];
  achievements: AchievementDef[];
  challenges: Challenge[];
}

/** The real dataset files — what `src/data/index.ts` serves at runtime. */
export const DATASET_FILES: RawDataset = {
  players: playersJson,
  seasons: seasonsJson,
  playerCards: playerCardsJson,
  orgs: orgsJson,
  coaches: coachesJson,
  subs: subsJson,
  lineups: lineupsJson,
  specialCards: specialCardsJson,
  achievements: achievementsJson,
  challenges: challengesJson,
};

// ---------------------------------------------------------------------------
// Schema parse
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

/**
 * Zod-parse every file. Returns the parsed copies (zod strips undeclared object
 * keys — `integrity.test.ts` asserts the parsed data deep-equals the raw JSON, so
 * the runtime casts in `index.ts` see exactly what this returns).
 */
export function parseDataset(raw: RawDataset): ParsedDataset {
  return {
    players: parse("players", () => playersFileSchema.parse(raw.players)) as Player[],
    seasons: parse("seasons", () => seasonsFileSchema.parse(raw.seasons)) as Season[],
    playerCards: parse("playerCards", () =>
      playerCardsFileSchema.parse(raw.playerCards),
    ) as PlayerCard[],
    orgs: parse("orgs", () => orgsFileSchema.parse(raw.orgs)) as Org[],
    coaches: parse("coaches", () => coachesFileSchema.parse(raw.coaches)) as CoachCard[],
    subs: parse("subs", () => subsFileSchema.parse(raw.subs)) as SubCard[],
    lineups: parse("lineups", () => lineupsFileSchema.parse(raw.lineups)) as Lineup[],
    specialCards: parse("specialCards", () =>
      specialCardsFileSchema.parse(raw.specialCards),
    ) as SpecialCard[],
    achievements: parse("achievements", () =>
      achievementsFileSchema.parse(raw.achievements),
    ) as AchievementDef[],
    challenges: parse("challenges", () =>
      challengesFileSchema.parse(raw.challenges),
    ) as Challenge[],
  };
}

// ---------------------------------------------------------------------------
// Unique ids + referential integrity — fail loudly on broken links
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

function assertRef(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[data] ${message}`);
}

/** Throws on a duplicate id in any file or any cross-file reference that doesn't resolve. */
export function assertReferentialIntegrity(data: ParsedDataset): void {
  const { playerCards, coaches, subs, lineups, specialCards, challenges } = data;

  const playerById = toMap("players", data.players);
  const seasonById = toMap("seasons", data.seasons);
  const playerCardById = toMap("playerCards", playerCards);
  const orgById = toMap("orgs", data.orgs);
  const coachById = toMap("coaches", coaches);
  const subById = toMap("subs", subs);
  const lineupById = toMap("lineups", lineups);
  const specialCardById = toMap("specialCards", specialCards);
  toMap("achievements", data.achievements);
  const challengeById = toMap("challenges", challenges);

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

  // Challenges (v1.4): every cross-reference must resolve, the gating rank must be
  // real, a prereq must be another challenge, and a region/season constraint must
  // actually have lineups — so an authored challenge is never unwinnable by typo.
  const rankIds = new Set<string>(RANKS.map((r) => r.id));
  for (const ch of challenges) {
    assertRef(lineupById.has(ch.opponentLineupId), `challenges: "${ch.id}" → unknown opponentLineupId "${ch.opponentLineupId}"`);
    assertRef(rankIds.has(ch.rankRequired), `challenges: "${ch.id}" → unknown rankRequired "${ch.rankRequired}"`);
    if (ch.prereq) {
      assertRef(challengeById.has(ch.prereq), `challenges: "${ch.id}" → unknown prereq "${ch.prereq}"`);
      assertRef(ch.prereq !== ch.id, `challenges: "${ch.id}" → prereq cannot be itself`);
    }
    if (ch.fixedPlayerCardId) {
      assertRef(playerCardById.has(ch.fixedPlayerCardId), `challenges: "${ch.id}" → unknown fixedPlayerCardId "${ch.fixedPlayerCardId}"`);
    }
    if (ch.reward.specialId) {
      assertRef(specialCardById.has(ch.reward.specialId), `challenges: "${ch.id}" → unknown reward.specialId "${ch.reward.specialId}"`);
    }
    if (ch.constraint?.seasonId) {
      assertRef(seasonById.has(ch.constraint.seasonId), `challenges: "${ch.id}" → unknown constraint.seasonId "${ch.constraint.seasonId}"`);
    }
  }
}

/**
 * Full dataset validation: zod schema parse of every file, then unique ids and
 * referential integrity. Throws a `[data] …` Error on the first problem; returns
 * the parsed dataset when everything is valid. Defaults to the real files.
 */
export function validateDataset(raw: RawDataset = DATASET_FILES): ParsedDataset {
  const parsed = parseDataset(raw);
  assertReferentialIntegrity(parsed);
  return parsed;
}
