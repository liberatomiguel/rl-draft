/**
 * Road to Worlds — rc9 LOCKER (R211–R214): the facts the locker room reads
 * from a save, as pure functions. The store's `lockerFactsOf` calls them with
 * the save before and after a write; nothing here writes anything.
 *
 *  - `seriesOfUser`: the user's series in a tournament, each with its result
 *    and the win chance the ratings gave it (R212, results against expectation);
 *  - `boxDeltaOf`: the games and rating each squad player added to the box
 *    score in a write (R213, form);
 *  - `loadsOf`: each squad player's training load this week (R214).
 */

import { CAREER_LOCKER as L } from "@/config/balance.lockerRoom";
import type { TournamentState } from "../types";
import type { SeasonBoxStats } from "./boxScore";
import type { TrainingState } from "./types";

export type LoadKind = "rest" | "light" | "normal" | "heavy";

export interface SeriesFact {
  won: boolean;
  /** The win chance the ratings gave the user side at sim time (0..1). */
  p: number;
}

/** R212: the expected win chance for a rating edge (logistic, CAREER_LOCKER.results.expectScale). */
export function expectedWinOf(ratingDiff: number): number {
  return 1 / (1 + Math.exp(-ratingDiff / L.results.expectScale));
}

/**
 * R212: every finished series the user side played in a tournament, in order.
 * `difficulty` adds CAREER_LOCKER.expectShift (the difficulty's edge the
 * ratingDiff does not carry); absent = no shift.
 */
export function seriesOfUser(t: TournamentState | null | undefined, userId = "user", difficulty?: string): SeriesFact[] {
  if (!t) return [];
  const out: SeriesFact[] = [];
  const shift = (difficulty && L.expectShift[difficulty]) || 0;
  const read = (s: { teamAId: string; teamBId: string; winnerTeamId: string; ratingDiff: number }) => {
    if (s.teamAId !== userId && s.teamBId !== userId) return;
    if (!s.winnerTeamId) return;
    const diff = s.teamAId === userId ? s.ratingDiff : -s.ratingDiff;
    out.push({ won: s.winnerTeamId === userId, p: expectedWinOf((Number.isFinite(diff) ? diff : 0) + shift) });
  };
  for (const r of t.swiss?.rounds ?? []) for (const s of r.series ?? []) read(s);
  for (const r of t.playoffs?.rounds ?? []) for (const s of r.series ?? []) read(s);
  return out;
}

/** R212: Σ (won − p) over an event's series: positive = better than the ratings said. */
export function surpriseOf(series: readonly SeriesFact[]): number {
  return series.reduce((n, s) => n + (s.won ? 1 : 0) - s.p, 0);
}

/** R212: true when the user side was the top-rated team of the field. */
export function userWasFavourite(t: TournamentState | null | undefined, userId = "user"): boolean {
  const teams = Object.values(t?.teams ?? {});
  const user = t?.teams?.[userId];
  if (!user || teams.length < 2) return false;
  return teams.every((x) => x.id === userId || x.rating.total < user.rating.total);
}

/** R213: per squad player, the games and rating sum the box score gained between two saves (current season). */
export function boxDeltaOf(
  prev: readonly SeasonBoxStats[] | undefined,
  next: readonly SeasonBoxStats[] | undefined,
  seasonIndex: number,
  ids: readonly string[],
): Record<string, { games: number; ratingSum: number }> {
  const out: Record<string, { games: number; ratingSum: number }> = {};
  const now = next?.find((s) => s.seasonIndex === seasonIndex);
  if (!now) return out;
  const was = prev?.find((s) => s.seasonIndex === seasonIndex);
  for (const id of ids) {
    const a = now.players[id];
    if (!a) continue;
    const b = was?.players[id];
    const games = a.games - (b?.games ?? 0);
    if (games <= 0) continue;
    out[id] = { games, ratingSum: a.ratingSum - (b?.ratingSum ?? 0) };
  }
  return out;
}

/** R214: each player's load from the running package (his tweak first); no package = normal, a recovery package = light. */
export function loadsOf(training: TrainingState | null | undefined, ids: readonly string[]): Record<string, LoadKind> {
  const pkg = training?.plan?.package ?? null;
  const out: Record<string, LoadKind> = {};
  for (const id of ids) {
    if (!pkg) {
      out[id] = "normal";
      continue;
    }
    const tweak = pkg.tweaks?.[id];
    if (tweak?.rest) {
      out[id] = "rest";
      continue;
    }
    const w = tweak?.workload ?? pkg.workload;
    out[id] = w === "heavy" ? "heavy" : w === "light" || pkg.objective === "recovery" ? "light" : "normal";
  }
  return out;
}
