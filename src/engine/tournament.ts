/**
 * Tournament orchestration: Swiss stage → playoffs → finished.
 *
 * The store calls `playNextRound` once per user click; each call simulates a
 * full round (the user series plus every AI series). When the user is out,
 * `fastForward` completes the rest so the results screen can name a champion.
 *
 * Career v2.0 (R40) adds a Swiss-ONLY shape (`swissOnly` on the state): the
 * Swiss stage is the whole tournament — it finishes with playoffs null. Every
 * other path (all Draft modes included) draws exactly as before.
 */

import { TOURNAMENT } from "@/config/balance";
import type { Rng } from "@/lib/rng";
import { generateOpponents } from "./opponents";
import { createPlayoffs, playPlayoffRound, userPlayoffSeries } from "./playoffs";
import { createSwissState, playSwissRound, seedsFromSwiss, upcomingSwissPairings } from "./swiss";
import type {
  Difficulty,
  Placement,
  TournamentState,
  TournamentTeam,
} from "./types";

export interface TournamentOptions {
  mode?: "classic" | "quick" | "daily";
  /** Restrict opponent generation to these lineups (daily challenges). */
  poolLineupIds?: string[];
  /** Flat rating boost added to every opponent (region-lock normalisation, v1.3.1). */
  opponentRatingBoost?: number;
}

export function initTournament(
  userTeam: TournamentTeam,
  difficulty: Difficulty,
  rng: Rng,
  options: TournamentOptions = {},
): TournamentState {
  const mode = options.mode ?? "classic";

  // Quick mode: 8 teams straight into a single-elimination bracket.
  if (mode === "quick") {
    const opponents = generateOpponents(
      difficulty,
      rng,
      TOURNAMENT.quick.teams - 1,
      options.poolLineupIds,
      options.opponentRatingBoost,
    );
    const teams: Record<string, TournamentTeam> = { [userTeam.id]: userTeam };
    for (const opp of opponents) teams[opp.id] = opp;

    const seeds = Object.keys(teams).sort(
      (a, b) => teams[b].rating.total - teams[a].rating.total,
    );
    return {
      teams,
      // Dummy finished Swiss keeps the state shape uniform across modes.
      swiss: {
        rounds: [],
        records: Object.keys(teams).map((teamId) => ({
          teamId,
          wins: 0,
          losses: 0,
          gameDiff: 0,
          status: "advanced",
        })),
        nextPairings: null,
        finished: true,
      },
      playoffs: createPlayoffs(seeds, "single"),
      stage: "playoffs",
      userEliminated: false,
    };
  }

  const opponents = generateOpponents(
    difficulty,
    rng,
    TOURNAMENT.swiss.teams - 1,
    options.poolLineupIds,
    options.opponentRatingBoost,
  );
  const teams: Record<string, TournamentTeam> = { [userTeam.id]: userTeam };
  for (const opp of opponents) teams[opp.id] = opp;

  return {
    teams,
    swiss: createSwissState(Object.keys(teams), rng),
    playoffs: null,
    stage: "swiss",
    userEliminated: false,
  };
}

/** The shapes `initFieldTournament` builds (career events). */
export type FieldTournamentFormat = "swiss" | "swissOnly" | "single";

/**
 * Explicit-field tournament initializer (Road to Worlds, v1.5).
 *
 * Career events supply their OWN field of assembled teams (which may or may
 * not include a `user` team — AI-only events run headless via fastForward):
 * - "swiss": 16 teams → Swiss (Bo5) → 8-team double-elim (the RLCS shape).
 * - "swissOnly": v2.0 (R40) 16 teams → Swiss (Bo5) and nothing else — the
 *   regional qualifier: the 8 teams that reach 3 wins advance, no champion.
 *   Same rng draws as "swiss" up to the end of the Swiss stage.
 * - "single": 8 teams → straight single-elim bracket (unofficial cups).
 *
 * Purely additive: `initTournament` and every existing mode are untouched.
 */
export function initFieldTournament(
  field: TournamentTeam[],
  format: FieldTournamentFormat,
  rng: Rng,
): TournamentState {
  const teams: Record<string, TournamentTeam> = {};
  for (const team of field) teams[team.id] = team;

  if (format === "single") {
    if (field.length !== 8) {
      throw new Error(`initFieldTournament(single) needs exactly 8 teams, got ${field.length}`);
    }
    const seeds = Object.keys(teams).sort(
      (a, b) => teams[b].rating.total - teams[a].rating.total,
    );
    return {
      teams,
      swiss: {
        rounds: [],
        records: Object.keys(teams).map((teamId) => ({
          teamId,
          wins: 0,
          losses: 0,
          gameDiff: 0,
          status: "advanced",
        })),
        nextPairings: null,
        finished: true,
      },
      playoffs: createPlayoffs(seeds, "single"),
      stage: "playoffs",
      userEliminated: false,
    };
  }

  if (field.length !== TOURNAMENT.swiss.teams) {
    throw new Error(
      `initFieldTournament(${format}) needs exactly ${TOURNAMENT.swiss.teams} teams, got ${field.length}`,
    );
  }
  const state: TournamentState = {
    teams,
    swiss: createSwissState(Object.keys(teams), rng),
    playoffs: null,
    stage: "swiss",
    userEliminated: false,
  };
  return format === "swissOnly" ? { ...state, swissOnly: true } : state;
}

/**
 * v2.0 (R40): re-shape an existing state as Swiss-only — the legacy-save
 * path for a qualifier that was started under the old "swiss" format. A
 * Swiss still in progress simply finishes at its end; a Swiss that already
 * finished ends the tournament right there: any playoff rounds played are
 * DROPPED (placements come from the Swiss alone, so no qualifier champion is
 * ever produced). Pure; draws nothing.
 */
export function asSwissOnly(state: TournamentState): TournamentState {
  if (!state.swiss.finished) return { ...state, swissOnly: true };
  return {
    ...state,
    swissOnly: true,
    playoffs: null,
    stage: "finished",
    userEliminated: userStatus(state) === "eliminated",
  };
}

function userStatus(state: TournamentState): "active" | "advanced" | "eliminated" {
  return state.swiss.records.find((r) => r.teamId === "user")?.status ?? "active";
}

export function playNextRound(
  state: TournamentState,
  difficulty: Difficulty,
  rng: Rng,
): TournamentState {
  if (state.stage === "swiss") {
    const swiss = playSwissRound(state.swiss, state.teams, difficulty, rng);
    let next: TournamentState = { ...state, swiss };

    if (swiss.finished && state.swissOnly) {
      // v2.0 (R40): a Swiss-only event ends with its Swiss — no playoffs.
      next = { ...next, stage: "finished", userEliminated: userStatus(next) === "eliminated" };
    } else if (swiss.finished) {
      const seeds = seedsFromSwiss(swiss, state.teams);
      next = {
        ...next,
        playoffs: createPlayoffs(seeds),
        stage: "playoffs",
        userEliminated: userStatus(next) === "eliminated",
      };
    }
    return next;
  }

  if (state.stage === "playoffs" && state.playoffs && !state.playoffs.finished) {
    const playoffs = playPlayoffRound(state.playoffs, state.teams, difficulty, rng);
    const next: TournamentState = {
      ...state,
      playoffs,
      stage: playoffs.finished ? "finished" : "playoffs",
    };

    if (!next.userEliminated) {
      const lastRound = playoffs.rounds[playoffs.rounds.length - 1];
      const userSeries = lastRound.series.find(
        (s) => s.teamAId === "user" || s.teamBId === "user",
      );
      if (userSeries) {
        const lost = userSeries.winnerTeamId !== "user";
        if (playoffs.format === "single") {
          // Single elim (quick): any loss ends the run.
          if (lost) next.userEliminated = true;
        } else if (lastRound.name === "third_place") {
          // Double elim: an upper-bracket loss drops to the lower bracket,
          // and lb_semifinal / lb_final losers still play the third-place
          // series. The user is only OUT after lb_round1/lb_round2 losses,
          // after the third-place series, or after losing the grand final.
          next.userEliminated = true;
        } else if (
          lost &&
          (lastRound.name === "lb_round1" ||
            lastRound.name === "lb_round2" ||
            lastRound.name === "grand_final")
        ) {
          next.userEliminated = true;
        }
      }
    }
    return next;
  }

  return state;
}

/** Whether the user still has a series to play in the current stage. */
export function userIsAlive(state: TournamentState): boolean {
  if (state.stage === "swiss") return userStatus(state) === "active";
  if (state.stage === "playoffs") return !state.userEliminated && !state.playoffs?.finished;
  return false;
}

/**
 * Whether the NEXT round contains a series for the user. False while the user
 * sits advanced/eliminated during remaining AI-only Swiss rounds — the store
 * uses this to auto-resolve those rounds in a single click.
 */
export function userHasPendingSeries(state: TournamentState): boolean {
  if (state.stage === "swiss") {
    return upcomingSwissPairings(state.swiss)?.some(([a, b]) => a === "user" || b === "user") ?? false;
  }
  if (state.stage === "playoffs" && state.playoffs && !state.playoffs.finished) {
    return !state.userEliminated;
  }
  return false;
}

/**
 * v2.0 (R40): true when a real Swiss stage has just completed and the
 * playoffs are seeded but not one playoff round has been played — the point
 * where a two-day career event (Major/Worlds) pauses between its Saturday
 * Swiss and its Sunday playoffs. False for the dummy Swiss of the
 * single-elimination shapes (no Swiss rounds were ever played there).
 */
export function atPlayoffsStart(state: TournamentState): boolean {
  return (
    state.stage === "playoffs" &&
    state.swiss.rounds.length > 0 &&
    state.playoffs !== null &&
    state.playoffs.rounds.length === 0
  );
}

/** Complete every remaining round (used once the user is out, or to skip). */
export function fastForward(
  state: TournamentState,
  difficulty: Difficulty,
  rng: Rng,
): TournamentState {
  let current = state;
  let guard = 0;
  // Worst case: 5 Swiss rounds + 9 playoff rounds.
  while (current.stage !== "finished" && guard < 20) {
    current = playNextRound(current, difficulty, rng);
    guard += 1;
  }
  return current;
}

export function userPlacement(state: TournamentState): Placement {
  if (state.playoffs?.championTeamId === "user") return "champion";

  const playoffRuns = userPlayoffSeries(state.playoffs);
  if (playoffRuns.length === 0) return "swiss_exit";

  const last = playoffRuns[playoffRuns.length - 1];
  const won = last.series.winnerTeamId === "user";

  switch (last.round) {
    case "grand_final":
    case "final":
      return "runner_up";
    case "third_place":
      return won ? "third" : "fourth";
    case "lb_round2":
      return "top6";
    case "lb_round1":
      return "top8";
    case "semifinal":
      return "top4";
    case "quarterfinal":
      return "top8";
    default:
      // Defensive: a user run can only END on the rounds above.
      return won ? "third" : "top8";
  }
}
