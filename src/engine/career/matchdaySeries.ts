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

import { CAREER_MATCHDAY as MD } from "@/config/balance";
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
import {
  applyTimeout,
  bestStyleAgainst,
  coachPlanFor,
  decisionUnit,
  DEFAULT_PLAN,
  kickoffFor,
  shownStyle,
} from "./matchday";

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

/** The AI's plan: its natural style and the default plan (§6). */
export function aiPlan(): SeriesPlan {
  return { ...DEFAULT_PLAN };
}

/** The side's coach quality as the engine reads it (no coach on an AI side → the default). */
export function aiQualityOf(team: TournamentTeam): number {
  return team.coachQuality ?? MD.aiCoachQualityDefault;
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

function lostLast(state: SeriesState, side: Side): boolean {
  return state.lastWinner !== null && state.lastWinner !== side;
}

/**
 * The AI between games (user series only, §6): after a loss it re-picks the
 * style that best answers the one the user plays now, with a chance that
 * grows with its coach. Draws nothing.
 */
export function aiBreak(state: SeriesState, aiSide: Side, teamA: TournamentTeam, teamB: TournamentTeam): SeriesState {
  if (!state.matchday || state.games.length === 0 || isSeriesOver(state) || !lostLast(state, aiSide)) return state;
  const me = aiSide === "a" ? teamA : teamB;
  const opp = aiSide === "a" ? teamB : teamA;
  const oppStyle = shownStyle(opp, planOf(state, other(aiSide)));
  if (!oppStyle) return state;
  const chance = MD.aiAdjustBase + MD.aiAdjustPerQuality * aiQualityOf(me);
  if (decisionUnit(state.matchday.seed, `ai:${aiSide}:${state.games.length}`) >= chance) return state;
  return adjustSeriesPlan(state, aiSide, { style: bestStyleAgainst(me, opp, oppStyle) ?? null });
}

/**
 * The coach between games ("leave it to the coach"): the timeout once the
 * opponent's meter is up, and after a loss a style that answers the
 * opponent's — each the right call with chance = quality. No coach (null)
 * = nothing. Quality 1 is the probes' "good manual" policy.
 */
export function coachBreak(
  state: SeriesState,
  side: Side,
  teamA: TournamentTeam,
  teamB: TournamentTeam,
  quality: number | null,
): SeriesState {
  if (quality === null || !state.matchday || state.games.length === 0 || isSeriesOver(state)) return state;
  const md = state.matchday;
  const me = side === "a" ? teamA : teamB;
  const opp = side === "a" ? teamB : teamA;
  const g = state.games.length;
  let next = state;
  const oppMeter = side === "a" ? md.momentumB : md.momentumA;
  const spent = side === "a" ? md.timeoutA : md.timeoutB;
  if (!spent && oppMeter >= MD.timeoutTrigger && decisionUnit(md.seed, `coach:${side}:timeout:${g}`) < quality) {
    next = callTimeout(next, side);
  }
  if (lostLast(state, side)) {
    const oppStyle = shownStyle(opp, planOf(next, other(side)));
    if (oppStyle && decisionUnit(md.seed, `coach:${side}:adjust:${g}`) < quality) {
      next = adjustSeriesPlan(next, side, { style: bestStyleAgainst(me, opp, oppStyle) ?? null, kickoff: kickoffFor(me, opp) });
    }
  }
  return next;
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
    planA: ctl.userSide === "a" ? plan : aiPlan(),
    planB: ctl.userSide === "b" ? plan : aiPlan(),
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
  next = aiBreak(next, other(userSide), teamA, teamB);
  return { state: next, rngState: rng.state };
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
