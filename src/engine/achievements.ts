/**
 * Achievement evaluation — runs once when a run completes.
 * Each rule receives the full run context and returns true when earned.
 */

import { playerById, playerCardById, seasonById } from "@/data";
import { userPlayoffSeries } from "./playoffs";
import { userSwissRecord } from "./swiss";
import type {
  ChemistryResult,
  Placement,
  RunState,
  SeriesResult,
  TournamentState,
} from "./types";

export interface AchievementContext {
  run: RunState;
  tournament: TournamentState;
  placement: Placement;
  chemistry: ChemistryResult;
  /** Goals conceded across the whole run. */
  goalsConceded: number;
  /** Total specials in collection counting this run's unlocks. */
  specialsOwnedAfter: number;
  alreadyEarned: ReadonlySet<string>;
}

function userSeries(t: TournamentState): SeriesResult[] {
  const swiss = t.swiss.rounds.flatMap((round) =>
    round.series.filter((s) => s.teamAId === "user" || s.teamBId === "user"),
  );
  const playoffs = userPlayoffSeries(t.playoffs).map((entry) => entry.series);
  return [...swiss, ...playoffs];
}

function userWonSeries(s: SeriesResult): boolean {
  return s.winnerTeamId === "user";
}

/** Rating of the user relative to the opponent in a series (user - opponent). */
function userRatingDiff(s: SeriesResult): number {
  return s.teamAId === "user" ? s.ratingDiff : -s.ratingDiff;
}

const RULES: Record<string, (ctx: AchievementContext) => boolean> = {
  "first-draft": () => true,

  "swiss-merchant": (ctx) => {
    const record = userSwissRecord(ctx.tournament.swiss);
    return record.wins === 3 && record.losses === 0;
  },

  "game-seven-ice": (ctx) =>
    userPlayoffSeries(ctx.tournament.playoffs).some(({ series }) => {
      if (!userWonSeries(series)) return false;
      const [a, b] = series.score;
      return a + b === 7; // 4-3 either orientation, user won
    }),

  "dynasty-builder": (ctx) => {
    const picks = [ctx.run.draft.roster.player1, ctx.run.draft.roster.player2, ctx.run.draft.roster.player3];
    const lineupIds = picks.map((p) => p && playerCardById.get(p.refId)?.lineupId);
    return Boolean(lineupIds[0]) && lineupIds.every((id) => id === lineupIds[0]);
  },

  "no-numbers-needed": (ctx) => ctx.placement === "champion" && !ctx.run.showOverall,

  "hard-mode-hero": (ctx) => ctx.placement === "champion" && ctx.run.difficulty === "hard",

  "legacy-unlocked": (ctx) => ctx.placement === "champion" && ctx.run.difficulty === "hard",

  "one-country-army": (ctx) => {
    if (ctx.placement !== "champion") return false;
    const picks = [ctx.run.draft.roster.player1, ctx.run.draft.roster.player2, ctx.run.draft.roster.player3];
    const countries = picks.map((p) => {
      const card = p && playerCardById.get(p.refId);
      return card ? playerById.get(card.playerId)?.country : undefined;
    });
    return Boolean(countries[0]) && countries.every((c) => c === countries[0]);
  },

  "against-the-odds": (ctx) =>
    userSeries(ctx.tournament).some(
      (s) => userWonSeries(s) && userRatingDiff(s) <= -8,
    ),

  collector: (ctx) => ctx.specialsOwnedAfter >= 1,

  "archive-hunter": (ctx) => ctx.specialsOwnedAfter >= 5,

  "perfect-chemistry": (ctx) => ctx.chemistry.tier === "Perfect",

  immaculate: (ctx) =>
    ctx.placement === "champion" &&
    userSeries(ctx.tournament).every((s) => userWonSeries(s)),

  untouchable: (ctx) =>
    ctx.goalsConceded === 0 && userSeries(ctx.tournament).length > 0,

  "first-title": (ctx) => ctx.placement === "champion",

  podium: (ctx) => ["champion", "runner_up", "third"].includes(ctx.placement),

  "legacy-cleared": (ctx) =>
    ctx.placement === "champion" && ctx.run.difficulty === "legacy",

  "comeback-kings": (ctx) =>
    userSeries(ctx.tournament).some((s) => {
      if (!userWonSeries(s)) return false;
      let userWins = 0;
      let oppWins = 0;
      for (const game of s.games) {
        if (game.winnerTeamId === "user") userWins += 1;
        else oppWins += 1;
        if (oppWins - userWins >= 2) return true;
      }
      return false;
    }),

  "the-long-way": (ctx) => {
    if (ctx.placement !== "champion") return false;
    // Champion after losing an upper-bracket series = lower-bracket run.
    return userPlayoffSeries(ctx.tournament.playoffs).some(
      ({ round, series }) =>
        round.startsWith("ub_") && series.winnerTeamId !== "user",
    );
  },

  strangers: (ctx) =>
    ctx.placement === "champion" && ctx.chemistry.tier === "Poor",

  "old-school": (ctx) => {
    if (ctx.placement !== "champion") return false;
    const picks = [ctx.run.draft.roster.player1, ctx.run.draft.roster.player2, ctx.run.draft.roster.player3];
    return picks.every((p) => {
      const card = p && playerCardById.get(p.refId);
      const season = card ? seasonById.get(card.seasonId) : undefined;
      const year = season ? parseInt(season.year, 10) : NaN;
      return Number.isFinite(year) && year <= 2019;
    });
  },

  curator: (ctx) => ctx.specialsOwnedAfter >= 10,
};

export function evaluateAchievements(ctx: AchievementContext): string[] {
  return Object.entries(RULES)
    .filter(([id]) => !ctx.alreadyEarned.has(id))
    .filter(([, rule]) => rule(ctx))
    .map(([id]) => id);
}
