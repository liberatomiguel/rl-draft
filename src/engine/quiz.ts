/**
 * Daily Quiz — "Guess the Player" (v2.0). Pure engine: the DATASET half.
 *
 * One RLCS player per UTC day (seeded by the date, same for everyone), picked
 * among players with enough history to build clues. Clues are generated from
 * the dataset and ordered from broad to specific: nationality → era → orgs →
 * teammate → peak card. The player gets `QUIZ.attempts` tries; every miss reveals
 * the next clue. Nickname matching is forgiving (case, spaces, punctuation).
 *
 * Clue TEXT is assembled by the UI from `QUIZ_UI.clues` (copy, EN + PT); this
 * module only emits typed clue facts.
 *
 * The player-side state (types, guesses, the day fold, the cloud merge) lives
 * in `./quizState`, which has no dataset import (the profile store loads it on
 * every page — rc.26, #60).
 */

import { QUIZ } from "@/config/balance";
import { lineups, playerById, playerCardById, players, seasonById } from "@/data";
import { createRng } from "@/lib/rng";
import type { QuizClue, QuizPuzzle } from "./quizState";
import type { Player } from "./types";

interface PlayerFacts {
  player: Player;
  /** Lineups the player appears in, oldest first. */
  appearances: { lineupId: string; orgId: string; year: number; overall: number; teammates: string[] }[];
}

let factsCache: Map<string, PlayerFacts> | null = null;

/** Facts for every player with ≥ QUIZ.minLineups lineups (memoised; dataset is static). */
export function quizFacts(): Map<string, PlayerFacts> {
  if (factsCache) return factsCache;
  const byPlayer = new Map<string, PlayerFacts["appearances"]>();
  for (const l of lineups) {
    // National teams (v2.0) are not club history — the quiz stays on club careers.
    if (l.national) continue;
    const season = seasonById.get(l.seasonId);
    const year = season ? parseInt(season.year, 10) : NaN;
    const ids = l.playerCardIds.map((cid) => playerCardById.get(cid)).filter((c): c is NonNullable<typeof c> => !!c);
    for (const card of ids) {
      const arr = byPlayer.get(card.playerId) ?? [];
      arr.push({
        lineupId: l.id,
        orgId: l.orgId,
        year: Number.isNaN(year) ? 0 : year,
        overall: card.overall + (card.manualAdjustment ?? 0),
        teammates: ids.filter((c) => c.playerId !== card.playerId).map((c) => c.playerId),
      });
      byPlayer.set(card.playerId, arr);
    }
  }
  const out = new Map<string, PlayerFacts>();
  for (const [playerId, appearances] of byPlayer) {
    const player = playerById.get(playerId);
    if (!player || appearances.length < QUIZ.minLineups) continue;
    appearances.sort((a, b) => a.year - b.year || a.lineupId.localeCompare(b.lineupId));
    out.set(playerId, { player, appearances });
  }
  factsCache = out;
  return out;
}

function seedFromKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Build the clue ladder for one player (broad → specific). */
export function cluesFor(facts: PlayerFacts, rng = createRng(seedFromKey(facts.player.id))): QuizClue[] {
  const { player, appearances } = facts;
  const clues: QuizClue[] = [];
  if (player.country) clues.push({ kind: "country", country: player.country, region: player.region });
  const years = appearances.map((a) => a.year).filter((y) => y > 0);
  if (years.length) {
    clues.push({ kind: "era", firstYear: Math.min(...years), lastYear: Math.max(...years), lineups: appearances.length });
  }
  const orgIds = [...new Set(appearances.map((a) => a.orgId))];
  if (orgIds.length) clues.push({ kind: "orgs", orgIds: orgIds.slice(0, 2) });
  const teammates = [...new Set(appearances.flatMap((a) => a.teammates))].filter((id) => playerById.has(id));
  if (teammates.length) clues.push({ kind: "teammate", playerId: teammates[rng.int(0, teammates.length - 1)] });
  const peak = appearances.reduce((best, a) => (a.overall > best.overall ? a : best), appearances[0]);
  clues.push({ kind: "peak", overall: peak.overall, orgId: peak.orgId, year: peak.year });
  // Always at least `attempts` + 1 clues so every miss reveals something new.
  return clues;
}

/** The shared puzzle for a UTC date. */
export function quizForDate(date: string): QuizPuzzle {
  const facts = quizFacts();
  const ids = [...facts.keys()].sort();
  const rng = createRng(seedFromKey(`quiz:${date}`));
  const playerId = ids[rng.int(0, ids.length - 1)];
  return { date, playerId, clues: cluesFor(facts.get(playerId)!, rng) };
}

/** Forgiving comparison key: case, spaces and punctuation are ignored. */
export function normalizeGuess(s: string): string {
  return s.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

/** Resolve a typed guess to a player id (exact nickname / id match, normalised). */
export function resolveGuess(text: string): string | null {
  const key = normalizeGuess(text);
  if (!key) return null;
  for (const p of players) {
    if (normalizeGuess(p.nickname) === key || normalizeGuess(p.id) === key) return p.id;
  }
  return null;
}

/** Nicknames for the type-ahead (every player, sorted). */
export function quizSuggestions(text: string, limit = 8): Player[] {
  const key = normalizeGuess(text);
  if (!key) return [];
  const starts: Player[] = [];
  const contains: Player[] = [];
  for (const p of players) {
    const n = normalizeGuess(p.nickname);
    if (n.startsWith(key)) starts.push(p);
    else if (n.includes(key)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}
