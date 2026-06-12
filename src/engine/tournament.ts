/**
 * Tournament orchestration: Swiss stage → playoffs → finished.
 *
 * The store calls `playNextRound` once per user click; each call simulates a
 * full round (the user series plus every AI series). When the user is out,
 * `fastForward` completes the rest so the results screen can name a champion.
 */

import { TOURNAMENT } from "@/config/balance";
import type { Rng } from "@/lib/rng";
import { generateOpponents } from "./opponents";
import { createPlayoffs, playPlayoffRound, userPlayoffSeries } from "./playoffs";
import { createSwissState, playSwissRound, seedsFromSwiss } from "./swiss";
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

    if (swiss.finished) {
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
    return state.swiss.nextPairings?.some(([a, b]) => a === "user" || b === "user") ?? false;
  }
  if (state.stage === "playoffs" && state.playoffs && !state.playoffs.finished) {
    return !state.userEliminated;
  }
  return false;
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
