/**
 * Matchday decisions (v2.1 slice 3, docs/MATCHDAY-SPEC.md §6–§7): the series
 * plan, the momentum meter and the coach's choices. Pure helpers, no RNG
 * cursor: every "chance" here is a hash of the series seed and a fixed key,
 * so a decision never moves the series RNG and a reload replays it exactly.
 *
 * match.ts reads `planShift`, `kickoffFactor`, `momentumTerm` and
 * `updateMomentum`; the step drivers (matchdaySeries.ts) and the store read
 * the rest. Everything is gated by the side's `matchday` mark
 * (FEATURES.matchdayDecisions): unmarked sides never reach this file.
 */

import { CAREER_MATCHDAY as MD } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { KickoffPlan, PlayStyleId, SeriesPlan, Stats, TournamentTeam } from "../types";
import { deriveSeed } from "./seeds";
import { PLAY_STYLES, styleBeats } from "./styles";
import { traitCount } from "./traits";

export const DEFAULT_PLAN: SeriesPlan = { kickoff: "standard" };

/** A series' matchday layer (plain JSON, persisted with the SeriesState). */
export interface MatchdaySeriesState {
  planA: SeriesPlan;
  planB: SeriesPlan;
  /** The momentum meters, −momentumMax..+momentumMax. */
  momentumA: number;
  momentumB: number;
  /** One timeout per side per series. */
  timeoutA: boolean;
  timeoutB: boolean;
  /** The series seed the coach / AI decisions hash from (0 for a world series). */
  seed: number;
}

export function initMatchday(planA?: SeriesPlan, planB?: SeriesPlan, seed = 0): MatchdaySeriesState {
  return {
    planA: { ...(planA ?? DEFAULT_PLAN) },
    planB: { ...(planB ?? DEFAULT_PLAN) },
    momentumA: 0,
    momentumB: 0,
    timeoutA: false,
    timeoutB: false,
    seed: seed >>> 0,
  };
}

/**
 * The quality a side's calls are made at: its coach's, never below the
 * planning floor (R145: a coachless side — null — or a weak coach still has a
 * captain who reads the game; quick without a coach must not fall below today).
 */
export function planningQuality(quality: number | null): number {
  return Math.max(MD.coachlessQuality, quality ?? 0);
}

/** Coach overall → decision quality 0..1 (CAREER_MATCHDAY.coachQualityRange). */
export function coachQualityOf(overall: number): number {
  const [lo, hi] = MD.coachQualityRange;
  return Math.round(clamp((overall - lo) / (hi - lo), 0, 1) * 1000) / 1000;
}

/** The starter who makes the special plays: the best mechanics + offense (ties → the earlier one). */
export function playmakerIndexOf(players: readonly { stats: Stats }[]): number {
  let best = 0;
  let bestScore = -Infinity;
  players.slice(0, 3).forEach((p, i) => {
    const score = p.stats.mechanics + p.stats.offense;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/** A side with its plan's style as the one played (the same object when nothing changes). */
export function withPlayed(team: TournamentTeam, style: PlayStyleId | undefined): TournamentTeam {
  if (!style || !team.style || team.style.played === style) return team;
  return { ...team, style: { ...team.style, played: style } };
}

/** The plan's own shift per game: the off-style cost and a wrong mark, within ±planCap. */
export function planShift(team: TournamentTeam, opponent: TournamentTeam, plan: SeriesPlan): number {
  let shift = 0;
  if (plan.style && team.style && plan.style !== team.style.natural) {
    const natFit = team.style.fit[team.style.natural] ?? 0;
    const fit = team.style.fit[plan.style] ?? 0;
    shift -= MD.offStyleCostPerFit * Math.max(0, natFit - fit);
  }
  if (plan.mark !== undefined && plan.mark !== (opponent.playmakerIndex ?? 0)) shift += MD.markWrongCost;
  return clamp(shift, -MD.planCap, MD.planCap);
}

/** True when the opponent's plan marks this side's playmaker. */
export function playmakerMarked(team: TournamentTeam, opponentPlan: SeriesPlan): boolean {
  return opponentPlan.mark !== undefined && opponentPlan.mark === (team.playmakerIndex ?? 0);
}

/** Both kickoff choices, multiplied: the spread on BOTH sides' per-game roll. */
export function kickoffFactor(planA: SeriesPlan, planB: SeriesPlan): number {
  return (MD.kickoffScale[planA.kickoff] ?? 1) * (MD.kickoffScale[planB.kickoff] ?? 1);
}

/** A meter's score shift for one game, within ±momentumCap. */
export function momentumTerm(meter: number): number {
  return clamp(MD.momentumPerPoint * meter, -MD.momentumCap, MD.momentumCap);
}

function r3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export interface GameOutcome {
  winner: "a" | "b";
  overtime: boolean;
  /** Winner's goals minus loser's. */
  goalDiff: number;
  /** The winner trailed in the series before this game. */
  comeback: boolean;
}

/** Moves both meters after a game (§6: the kind of result and the behaviour traits). */
export function updateMomentum(
  md: MatchdaySeriesState,
  outcome: GameOutcome,
  teamA: TournamentTeam,
  teamB: TournamentTeam,
): MatchdaySeriesState {
  const rout = !outcome.overtime && outcome.goalDiff >= MD.routGoalMargin;
  const winnerTeam = outcome.winner === "a" ? teamA : teamB;
  const loserTeam = outcome.winner === "a" ? teamB : teamA;

  let win = rout ? MD.momentumWinRout : outcome.overtime ? MD.momentumWinOvertime : MD.momentumWinPlain;
  if (outcome.comeback) win += MD.momentumWinComeback;

  let loss = rout ? MD.momentumLossRout : outcome.overtime ? MD.momentumLossOvertime : MD.momentumLossPlain;
  loss += MD.leaderLift * traitCount(loserTeam, "leader");
  if (outcome.overtime || rout) loss += MD.hotHeadedDrop * traitCount(loserTeam, "hotHeaded");
  if (loss < 0) loss *= Math.max(0, 1 - MD.iceColdDamp * traitCount(loserTeam, "iceCold"));
  else loss *= Math.max(0, 1 - MD.iceColdDamp * traitCount(winnerTeam, "iceCold"));

  const max = MD.momentumMax;
  const decayA = md.momentumA * MD.momentumDecay;
  const decayB = md.momentumB * MD.momentumDecay;
  const aWon = outcome.winner === "a";
  return {
    ...md,
    momentumA: r3(clamp(decayA + (aWon ? win : loss), -max, max)),
    momentumB: r3(clamp(decayB + (aWon ? loss : win), -max, max)),
  };
}

/**
 * The timeout (one per series): clears the opponent's positive momentum, up to
 * CAREER_MATCHDAY.timeoutMax rating points of it. Used even at no value (the
 * player's call). The same state back when the side has none left.
 */
export function applyTimeout(md: MatchdaySeriesState, side: "a" | "b"): MatchdaySeriesState {
  if (side === "a" ? md.timeoutA : md.timeoutB) return md;
  const opp = side === "a" ? md.momentumB : md.momentumA;
  const cut = Math.min(Math.max(0, opp), MD.timeoutMax / MD.momentumPerPoint);
  return side === "a"
    ? { ...md, timeoutA: true, momentumB: r3(opp - cut) }
    : { ...md, timeoutB: true, momentumA: r3(opp - cut) };
}

/** What `style` is worth per game for `team` against an opponent playing `oppStyle` (matchup minus the off-style cost). */
export function styleValue(team: TournamentTeam, opponent: TournamentTeam, style: PlayStyleId, oppStyle: PlayStyleId): number {
  if (!team.style) return 0;
  const fit = team.style.fit[style] ?? 0;
  let value = styleBeats(style) === oppStyle ? MD.matchupCap * fit : 0;
  if (opponent.style && styleBeats(oppStyle) === style) value -= MD.matchupCap * (opponent.style.fit[oppStyle] ?? 0);
  const natFit = team.style.fit[team.style.natural] ?? 0;
  if (style !== team.style.natural) value -= MD.offStyleCostPerFit * Math.max(0, natFit - fit);
  return value;
}

/** The best style against `oppStyle` (ties → the natural one, then cycle order). Undefined = the natural one. */
export function bestStyleAgainst(team: TournamentTeam, opponent: TournamentTeam, oppStyle: PlayStyleId): PlayStyleId | undefined {
  if (!team.style) return undefined;
  const natural = team.style.natural;
  let best = natural;
  let bestValue = styleValue(team, opponent, natural, oppStyle);
  for (const style of PLAY_STYLES) {
    const v = styleValue(team, opponent, style, oppStyle);
    if (v > bestValue + 1e-9) {
      best = style;
      bestValue = v;
    }
  }
  return best === natural ? undefined : best;
}

/** The kickoff a reader of the ratings picks: the favourite plays safe, the underdog aggressive. */
export function kickoffFor(team: TournamentTeam, opponent: TournamentTeam): KickoffPlan {
  const gap = team.rating.total - opponent.rating.total;
  if (gap >= MD.kickoffEdgeGap) return "safe";
  if (gap <= -MD.kickoffEdgeGap) return "aggressive";
  return "standard";
}

/** A deterministic 0..1 from the series seed and a key (no RNG cursor). */
export function decisionUnit(seed: number, key: string): number {
  return deriveSeed(seed, `md:${key}`) / 4294967296;
}

/** The opponent's style as the scouting report shows it (the one it plays now). */
export function shownStyle(team: TournamentTeam, plan: SeriesPlan): PlayStyleId | undefined {
  return team.style ? plan.style ?? team.style.natural : undefined;
}

/** A side's coach quality as the engine reads it (an AI side whose builder knew no coach → the default). */
export function aiQualityOf(team: TournamentTeam): number {
  return team.coachQuality ?? MD.aiCoachQualityDefault;
}

/**
 * The coach between games, on the matchday layer alone (R140 rev.: the AI
 * uses it too): the timeout once the opponent's meter is up, and after a loss
 * a style that answers the opponent's plus the kickoff the ratings call for —
 * each the right call with chance = quality. Null quality = nothing. Draws nothing.
 */
export function coachBreakOn(
  md: MatchdaySeriesState,
  side: "a" | "b",
  me: TournamentTeam,
  opp: TournamentTeam,
  quality: number | null,
  ctx: { gamesPlayed: number; lostLast: boolean },
): MatchdaySeriesState {
  if (ctx.gamesPlayed === 0) return md;
  const q = planningQuality(quality);
  const g = ctx.gamesPlayed;
  let next = md;
  const oppMeter = side === "a" ? md.momentumB : md.momentumA;
  const spent = side === "a" ? md.timeoutA : md.timeoutB;
  if (!spent && oppMeter >= MD.timeoutTrigger && decisionUnit(md.seed, `coach:${side}:timeout:${g}`) < q) {
    next = applyTimeout(next, side);
  }
  if (ctx.lostLast) {
    const oppStyle = shownStyle(opp, side === "a" ? next.planB : next.planA);
    if (oppStyle && decisionUnit(md.seed, `coach:${side}:adjust:${g}`) < q) {
      const plan = { ...(side === "a" ? next.planA : next.planB) };
      const best = bestStyleAgainst(me, opp, oppStyle);
      if (best) plan.style = best;
      else delete plan.style;
      plan.kickoff = kickoffFor(me, opp);
      next = side === "a" ? { ...next, planA: plan } : { ...next, planB: plan };
    }
  }
  return next;
}

/**
 * "Leave it to the coach": the pre-series plan. Each part is the right call
 * with chance = quality (never below the planning floor, `planningQuality`),
 * otherwise the default. Quality 1 is the "good manual" policy the probes measure against.
 */
export function coachPlanFor(
  team: TournamentTeam,
  opponent: TournamentTeam,
  quality: number | null,
  seed: number,
  sideKey: string,
): SeriesPlan {
  const q = planningQuality(quality);
  const plan: SeriesPlan = { kickoff: "standard" };
  const oppStyle = opponent.style?.natural;
  if (oppStyle && decisionUnit(seed, `${sideKey}:style`) < q) {
    const best = bestStyleAgainst(team, opponent, oppStyle);
    if (best) plan.style = best;
  }
  if (decisionUnit(seed, `${sideKey}:kickoff`) < q) plan.kickoff = kickoffFor(team, opponent);
  if (opponent.playmakerIndex !== undefined && decisionUnit(seed, `${sideKey}:mark`) < q) {
    plan.mark = opponent.playmakerIndex;
  }
  return plan;
}
