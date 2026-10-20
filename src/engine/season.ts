/**
 * Seasons (v2.0) — pure helpers that move a profile across season resets.
 *
 * The season-scoped fields of a profile keep their historical names (`xp`,
 * `mmr`) so every reader keeps working; `season` tags WHICH season they belong
 * to. `normalizeToSeason` is the one place that turns a save from a previous
 * season (or the pre-season, which has no `season` field at all) into a
 * current-season save: it archives what the player achieved into
 * `legacy.preseason` and resets the season fields. It runs in the persist
 * migrate (local saves) AND inside the cloud merge (a cloud row written by an
 * older build), so a pre-season row can never re-inflate a Season 1 profile.
 *
 * No React, no storage, no randomness.
 */

import { MMR, mmrBackfillFloor, RANKS, SEASON_RATING } from "@/config/balance";
import { PRESEASON_ID, SEASON } from "@/config/season";
import type { Difficulty, Placement, RunMode } from "./types";
import { rankForXp } from "./progression";

/** One rating movement (the profile's rating graph + the results readout). */
export interface RatingHistoryEntry {
  /** ISO timestamp of the run. */
  t: string;
  /** Signed delta applied. */
  delta: number;
  /** Rating AFTER the delta. */
  mmr: number;
  difficulty: Difficulty;
  placement: Placement;
  mode: RunMode;
}

/** Season-scoped bookkeeping that lives beside `xp` / `mmr`. */
export interface SeasonState {
  id: number;
  /** ISO date this profile entered the season (reset or first play). */
  startedAt: string;
  peakMmr: number;
  /** Highest rank id reached this season (rank ids only go up with XP). */
  peakRankId: string;
  /** Tournament runs finished this season (Classic / Quick / Daily). */
  runs: number;
  /** Titles won this season. */
  titles: number;
  ratingHistory: RatingHistoryEntry[];
  /** rc.4 (Dynasty badge): Legacy-difficulty titles won this season. Optional —
   *  saves from before rc.4 read it as 0. */
  legacyTitles?: number;
  /** rc.4 (Dynasty badge): Road to Worlds World Championships won this season. */
  careerWorlds?: number;
}

/** What the player achieved in the pre-season, frozen at the Season 1 reset. */
export interface PreseasonSnapshot {
  xp: number;
  mmr: number;
  rankId: string;
  runsCompleted: number;
  titles: number;
  challengesCleared: number;
  snapshotAt: string;
  /** Final place on the frozen pre-season board (from the cloud); null until known. */
  position: number | null;
}

export interface LegacyState {
  preseason: PreseasonSnapshot | null;
}

/** The slice of a profile `normalizeToSeason` reads and rewrites. */
export interface SeasonFields {
  xp: number;
  mmr: number;
  runsCompleted: number;
  wins: Record<Difficulty, number>;
  challengesCompleted: Record<string, string>;
  challengeStars?: Record<string, number>;
  season?: SeasonState;
  lifetime?: { xp: number };
  legacy?: LegacyState;
}

export function freshSeason(now = new Date().toISOString()): SeasonState {
  return {
    id: SEASON.id,
    startedAt: now,
    peakMmr: SEASON_RATING.start,
    peakRankId: rankForXp(0).id,
    runs: 0,
    titles: 0,
    ratingHistory: [],
  };
}

/** Titles across every difficulty. */
export function titlesOf(wins: Record<Difficulty, number>): number {
  return (wins.easy ?? 0) + (wins.normal ?? 0) + (wins.hard ?? 0) + (wins.legacy ?? 0);
}

/**
 * Freeze a pre-season profile's achievements. Returns null when there is nothing
 * to remember (never finished a run and no XP), so the recap screen and the
 * legacy rewards have a clean "no pre-season" signal.
 */
export function snapshotPreseason(
  p: Pick<SeasonFields, "xp" | "mmr" | "runsCompleted" | "wins" | "challengesCompleted">,
  now = new Date().toISOString(),
): PreseasonSnapshot | null {
  const xp = Math.max(0, p.xp ?? 0);
  const runsCompleted = Math.max(0, p.runsCompleted ?? 0);
  if (xp === 0 && runsCompleted === 0) return null;
  const wins = p.wins ?? { easy: 0, normal: 0, hard: 0, legacy: 0 };
  return {
    xp,
    // A row saved before MMR existed (or before the v11 correction) is seeded from
    // its title history — the same floor the v1.4 cloud sync applied.
    mmr: Math.max(p.mmr ?? MMR.start, mmrBackfillFloor(wins)),
    rankId: rankForXp(xp).id,
    runsCompleted,
    titles: titlesOf(wins),
    challengesCleared: Object.keys(p.challengesCompleted ?? {}).length,
    snapshotAt: now,
    position: null,
  };
}

/** Union of two snapshots of the same pre-season: MAX of every number, the
 *  earliest snapshot date, the known position (lowest = best when both know). */
export function mergeSnapshots(
  a: PreseasonSnapshot | null | undefined,
  b: PreseasonSnapshot | null | undefined,
): PreseasonSnapshot | null {
  if (!a) return b ?? null;
  if (!b) return a;
  const xp = Math.max(a.xp, b.xp);
  const positions = [a.position, b.position].filter((p): p is number => typeof p === "number" && p > 0);
  return {
    xp,
    mmr: Math.max(a.mmr, b.mmr),
    rankId: rankForXp(xp).id,
    runsCompleted: Math.max(a.runsCompleted, b.runsCompleted),
    titles: Math.max(a.titles, b.titles),
    challengesCleared: Math.max(a.challengesCleared, b.challengesCleared),
    snapshotAt: a.snapshotAt < b.snapshotAt ? a.snapshotAt : b.snapshotAt,
    position: positions.length ? Math.min(...positions) : null,
  };
}

/** True when the save's season fields belong to the CURRENT season. */
export function isCurrentSeason(p: Pick<SeasonFields, "season">): boolean {
  return p.season?.id === SEASON.id;
}

/**
 * Bring a profile into the current season. Idempotent: a current-season profile
 * comes back untouched (same object). A pre-season profile (no `season`, or
 * `season.id === PRESEASON_ID`) is archived into `legacy.preseason` (merged with
 * any snapshot it already carries) and its season fields are reset:
 * `xp → 0`, `mmr → SEASON_RATING.start`, `challengesCompleted → {}` (the
 * Challenges mode restarts in v2.0; the old count is kept in the snapshot),
 * `season → fresh`. Lifetime XP accumulates in `lifetime.xp`.
 *
 * A profile from a later season than the build (a newer tab) is also reset —
 * that cannot normally happen (seasons only move forward with deploys), and
 * resetting is the safe reading of "this is not my season".
 */
export function normalizeToSeason<T extends SeasonFields>(
  p: T,
  now = new Date().toISOString(),
): T {
  if (isCurrentSeason(p) && p.lifetime && p.legacy) return p;
  const lifetimeXp = Math.max(p.lifetime?.xp ?? 0, p.xp ?? 0);
  if (isCurrentSeason(p)) {
    return { ...p, lifetime: { xp: lifetimeXp }, legacy: p.legacy ?? { preseason: null } };
  }
  const fromPreseason = !p.season || p.season.id === PRESEASON_ID;
  const snapshot = fromPreseason ? snapshotPreseason(p, now) : null;
  return {
    ...p,
    xp: 0,
    mmr: SEASON_RATING.start,
    challengesCompleted: {},
    challengeStars: {},
    season: freshSeason(now),
    lifetime: { xp: lifetimeXp },
    legacy: { preseason: mergeSnapshots(p.legacy?.preseason, snapshot) },
  };
}

/** Merge two current-season `season` blocks (cloud ↔ local). Counters MAX, the
 *  history unioned by timestamp (newest first, capped), earliest start. */
export function mergeSeasonState(a: SeasonState, b: SeasonState): SeasonState {
  const byT = new Map<string, RatingHistoryEntry>();
  for (const e of [...b.ratingHistory, ...a.ratingHistory]) if (!byT.has(e.t)) byT.set(e.t, e);
  const ratingHistory = [...byT.values()]
    .sort((x, y) => (x.t < y.t ? 1 : -1))
    .slice(0, SEASON_RATING.historyLimit);
  return {
    id: a.id,
    startedAt: a.startedAt < b.startedAt ? a.startedAt : b.startedAt,
    peakMmr: Math.max(a.peakMmr, b.peakMmr),
    peakRankId: rankIndex(a.peakRankId) >= rankIndex(b.peakRankId) ? a.peakRankId : b.peakRankId,
    runs: Math.max(a.runs, b.runs),
    titles: Math.max(a.titles, b.titles),
    ratingHistory,
    legacyTitles: Math.max(a.legacyTitles ?? 0, b.legacyTitles ?? 0),
    careerWorlds: Math.max(a.careerWorlds ?? 0, b.careerWorlds ?? 0),
  };
}

/**
 * Pick the rating to keep when two current-season copies disagree. Rating can go
 * DOWN now, so a plain MAX would resurrect a loss from the other copy; the copy
 * that has played more of the season is the one that knows the latest value.
 * Equal run counts → MAX (never regress on a tie).
 */
export function mergeRating(
  a: { mmr: number; runs: number },
  b: { mmr: number; runs: number },
): number {
  if (a.runs > b.runs) return a.mmr;
  if (b.runs > a.runs) return b.mmr;
  return Math.max(a.mmr, b.mmr);
}

/** Append a rating movement to the history (newest first, capped). */
export function pushRatingHistory(
  history: RatingHistoryEntry[],
  entry: RatingHistoryEntry,
): RatingHistoryEntry[] {
  return [entry, ...history].slice(0, SEASON_RATING.historyLimit);
}

function rankIndex(id: string): number {
  const i = RANKS.findIndex((r) => r.id === id);
  return i < 0 ? 0 : i;
}
