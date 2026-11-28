/**
 * Matchday slice 3 (docs/MATCHDAY-SPEC.md §6): the user's series, step by
 * step, with the plan and the breaks; and the same series played by the
 * coach in one go ("leave it to the coach", the quick mode).
 *
 * Everything works on the plain-JSON SeriesState of match.ts. The breaks
 * draw nothing from the series RNG (the coach / AI chances hash the series
 * seed), so a series paused between games and resumed after a reload plays
 * the same next game as one that never stopped.
 */

import { createRng } from "@/lib/rng";
import {
  finishSeries,
  isSeriesOver,
  playNextGame,
  startSeries,
  type SeriesOptions,
  type SeriesState,
} from "../match";
import type { KickoffPlan, PlayStyleId, SeriesPlan, SeriesResult, TournamentTeam } from "../types";
import { aiQualityOf, applyTimeout, coachBreakOn, coachPlanFor, withPlayed, type PlanLogEntry } from "./matchday";
import { playedStyle, styleMatchupBonus } from "./styles";

export { aiQualityOf };

export type Side = "a" | "b";

function other(side: Side): Side {
  return side === "a" ? "b" : "a";
}

function planOf(state: SeriesState, side: Side): SeriesPlan {
  const md = state.matchday!;
  return side === "a" ? md.planA : md.planB;
}

function withPlan(state: SeriesState, side: Side, plan: SeriesPlan): SeriesState {
  const md = state.matchday!;
  return { ...state, matchday: side === "a" ? { ...md, planA: plan } : { ...md, planB: plan } };
}

/** The AI's plan: its coach's, exactly as the user's "leave it to the coach" (R140 rev., Miguel 20/11). */
export function aiPlan(ai: TournamentTeam, opponent: TournamentTeam, seed: number): SeriesPlan {
  return coachPlanFor(ai, opponent, aiQualityOf(ai), seed, "ai");
}

/**
 * Sets a side's whole plan — only before game 1 (the pre-series screen).
 * The same state back after game 1 or without a matchday layer.
 */
export function setSeriesPlan(state: SeriesState, side: Side, plan: SeriesPlan): SeriesState {
  if (!state.matchday || state.games.length > 0 || isSeriesOver(state)) return state;
  return withPlan(state, side, { ...plan });
}

/** A break's adjustment (§6): another style or kickoff for the next games. The mark stays. */
export function adjustSeriesPlan(
  state: SeriesState,
  side: Side,
  change: { style?: PlayStyleId | null; kickoff?: KickoffPlan },
): SeriesState {
  if (!state.matchday || isSeriesOver(state)) return state;
  const plan = { ...planOf(state, side) };
  if (change.style !== undefined) {
    if (change.style === null) delete plan.style;
    else plan.style = change.style;
  }
  if (change.kickoff) plan.kickoff = change.kickoff;
  return withPlan(state, side, plan);
}

/** The timeout, between games only; the same state back when spent, before game 1 or after the end. */
export function callTimeout(state: SeriesState, side: Side): SeriesState {
  if (!state.matchday || state.games.length === 0 || isSeriesOver(state)) return state;
  const md = applyTimeout(state.matchday, side);
  return md === state.matchday ? state : { ...state, matchday: md };
}

/**
 * The coach between games ("leave it to the coach"; the AI uses the same at
 * its own coach's quality): see `coachBreakOn`. No coach (null) = nothing.
 * Quality 1 is the probes' "good manual" policy.
 */
export function coachBreak(
  state: SeriesState,
  side: Side,
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  quality: number | null,
): SeriesState {
  if (!state.matchday || isSeriesOver(state)) return state;
  const md = coachBreakOn(state.matchday, side, side === "a" ? teamA : teamB, side === "a" ? teamB : teamA, quality, {
    gamesPlayed: state.games.length,
    lostLast: state.lastWinner !== null && state.lastWinner !== side,
  });
  return md === state.matchday ? state : { ...state, matchday: md };
}

/** The AI side's break in the user's series, at its coach's quality. */
export function aiBreak(state: SeriesState, aiSide: Side, teamA: TournamentTeam, teamB: TournamentTeam): SeriesState {
  return coachBreak(state, aiSide, teamA, teamB, aiQualityOf(aiSide === "a" ? teamA : teamB));
}

/** Who drives each side of a user series (null quality = no coach). */
export interface SeriesControl {
  userSide: Side;
  /** The user's coach quality, null without a coach. */
  userQuality: number | null;
}

/** Opens the user's series on its own seed: the coach's plan for the user, the AI's default plan. */
export function openUserSeries(
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  options: SeriesOptions,
  seed: number,
  ctl: SeriesControl,
  userPlan?: SeriesPlan,
): { state: SeriesState; rngState: number } {
  const rng = createRng(seed >>> 0);
  const user = ctl.userSide === "a" ? teamA : teamB;
  const opp = ctl.userSide === "a" ? teamB : teamA;
  const plan = userPlan ?? coachPlanFor(user, opp, ctl.userQuality, seed, "user");
  const state = startSeries(teamA, teamB, options, rng, {
    planA: ctl.userSide === "a" ? plan : aiPlan(teamA, teamB, seed),
    planB: ctl.userSide === "b" ? plan : aiPlan(teamB, teamA, seed),
    seed,
  });
  return { state, rngState: rng.state };
}

/** Plays one game of the user's series from its persisted cursor, then the AI's break. */
export function playUserGame(
  state: SeriesState,
  rngState: number,
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  userSide: Side,
): { state: SeriesState; rngState: number } {
  const rng = createRng(rngState);
  let next = playNextGame(state, teamA, teamB, rng);
  next = logUserGame(state, next, teamA, teamB, userSide);
  next = aiBreak(next, other(userSide), teamA, teamB);
  return { state: next, rngState: rng.state };
}

/**
 * rc9 MATCHDAY (R243): writes what the plan did in the game just played onto
 * the user's log (read only by planReport). `before` is the state the game
 * was played from, so the plans and meters are the ones that played.
 */
function logUserGame(before: SeriesState, after: SeriesState, teamA: TournamentTeam, teamB: TournamentTeam, userSide: Side): SeriesState {
  const md = before.matchday;
  if (!md || !after.matchday) return after;
  const pa = withPlayed(teamA, md.planA.style);
  const pb = withPlayed(teamB, md.planB.style);
  const me = userSide === "a" ? pa : pb;
  const opp = userSide === "a" ? pb : pa;
  const myPlan = userSide === "a" ? md.planA : md.planB;
  const cut = userSide === "a" ? md.cutA : md.cutB;
  const game = after.games[after.games.length - 1];
  const entry: PlanLogEntry = {
    game: game.index,
    style: me.style ? playedStyle(me.style) : null,
    oppStyle: opp.style ? playedStyle(opp.style) : null,
    edge: Math.round((styleMatchupBonus(me, opp) - styleMatchupBonus(opp, me)) * 1000) / 1000,
    marked: myPlan.mark !== undefined && myPlan.mark === (opp.playmakerIndex ?? 0),
    kickoff: myPlan.kickoff,
    won: game.winnerTeamId === me.id,
    ...(cut !== undefined ? { timeoutCut: cut } : {}),
  };
  const nextMd = { ...after.matchday, userLog: [...(md.userLog ?? []), entry] };
  if (userSide === "a") delete nextMd.cutA;
  else delete nextMd.cutB;
  return { ...after, matchday: nextMd };
}

/**
 * rc9 MATCHDAY (R240): the next game of the user's series with the coach
 * making the user's break calls first (the timeout, an adjustment after a
 * loss), exactly as quick mode does. The user's own timeout, if called, is
 * already on the state (the coach then leaves it).
 */
export function playUserNext(
  state: SeriesState,
  rngState: number,
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  ctl: SeriesControl,
): { state: SeriesState; rngState: number } {
  if (isSeriesOver(state)) return { state, rngState };
  const st = coachBreak(state, ctl.userSide, teamA, teamB, ctl.userQuality);
  return playUserGame(st, rngState, teamA, teamB, ctl.userSide);
}

/** rc9 MATCHDAY (R243): what the plan did, from the log (the facts the line is built from). */
export interface PlanReport {
  /** The style the user opened with and the opponent's at game 1. */
  style: PlayStyleId | null;
  oppStyle: PlayStyleId | null;
  /** Games the user's style had the matchup edge in, and the ones the opponent's had. */
  edgeGames: number[];
  againstGames: number[];
  /** Of the edge games, how many the user won. */
  edgeWins: number;
  /** The opponent switched style before this game (the first switch), if it did. */
  oppSwitchedAt: number | null;
  oppSwitchedTo: PlayStyleId | null;
  /** The user's timeout: before which game and how much momentum it cleared. */
  timeout: { game: number; cut: number } | null;
  marked: boolean;
  games: number;
}

export function planReport(state: SeriesState): PlanReport | null {
  const log = state.matchday?.userLog;
  if (!log || log.length === 0) return null;
  const first = log[0];
  const switched = log.find((e) => e.oppStyle !== first.oppStyle);
  const t = log.find((e) => e.timeoutCut !== undefined);
  const edgeGames = log.filter((e) => e.edge > 0).map((e) => e.game);
  return {
    style: first.style,
    oppStyle: first.oppStyle,
    edgeGames,
    againstGames: log.filter((e) => e.edge < 0).map((e) => e.game),
    edgeWins: log.filter((e) => e.edge > 0 && e.won).length,
    oppSwitchedAt: switched ? switched.game : null,
    oppSwitchedTo: switched ? switched.oppStyle : null,
    timeout: t ? { game: t.game, cut: t.timeoutCut ?? 0 } : null,
    marked: first.marked,
    games: log.length,
  };
}

/** Finishes the user's series with the coach making every remaining call (quick mode, or "leave it to the coach"). */
export function playOutWithCoach(
  state: SeriesState,
  rngState: number,
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  ctl: SeriesControl,
): { state: SeriesState; rngState: number } {
  let cur = { state, rngState };
  let guard = 0;
  while (!isSeriesOver(cur.state) && guard < 16) {
    const st = coachBreak(cur.state, ctl.userSide, teamA, teamB, ctl.userQuality);
    cur = playUserGame(st, cur.rngState, teamA, teamB, ctl.userSide);
    guard += 1;
  }
  return cur;
}

/** The whole user series by the coach, on its own seed (the quick mode). */
export function autoUserSeries(
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  options: SeriesOptions,
  seed: number,
  ctl: SeriesControl,
): SeriesResult {
  const opened = openUserSeries(teamA, teamB, options, seed, ctl);
  const done = playOutWithCoach(opened.state, opened.rngState, teamA, teamB, ctl);
  return finishSeries(done.state, teamA, teamB);
}
