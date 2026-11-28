/**
 * rc9 STORIES (R253): when the manager is offered a post. Miguel on rc.8: the
 * post "aparece demais, deveria aparecer somente de vez em quando, depois de
 * campeonatos importantes". So the offer follows a moment worth a statement,
 * never every series:
 *
 *   title               a title at CAREER_FEED.offer.titleTiers
 *   finalLost           a final lost at finalTiers
 *   exit                out of a Major or Worlds before the final (exitTiers)
 *   missedQualification a qualifier lost by one of its favourites (seeded in
 *                       the top qualifierFavouriteRank of the field)
 *   breakthrough        a step the club never took before: through a
 *                       qualifier, or into a regional's playoffs
 *   upsetWin/upsetLoss  an upset at upsetTiers with a rating gap of at least
 *                       upsetMinGap between the sides
 *   streak              a run of series wins reaching a streakMilestone
 *
 * First match wins, in that order. Then `offerAllowed` spaces them: at least
 * minGapDays since the last offer (a title skips the gap) and at most
 * perSeason a season. Pure and deterministic: no RNG, no clock, no store.
 */
import { CAREER_FEED } from "@/config/balance";
import type { Placement, TournamentState } from "../types";
import { DAYS_PER_SEASON } from "./calendar";
import type { PostMoment } from "./fanFeedTypes";

const O = CAREER_FEED.offer;

/** One of the user's series in an event, as the rule reads it. */
export interface MomentSeries {
  n: number;
  won: boolean;
  upset: boolean;
  /** The user's rating minus the opponent's (negative: the user was the weaker side). */
  gap: number;
}

export interface MomentInput {
  tier: string;
  placement: Placement;
  /** The user's series of this event, in play order. */
  series: readonly MomentSeries[];
  /** The signed result run before this event's first series (+3 = three wins in a row). */
  runBefore: number;
  /** The user's rank by rating in the event's field (1 = the strongest). */
  seedRank: number;
  /** The steps already taken once (a breakthrough is the first time only). */
  reached?: readonly string[];
}

export interface Moment {
  moment: PostMoment;
  /** The series the post answers. */
  seriesN: number;
  /** The streak length, for a streak moment. */
  streak?: number;
}

const has = (list: readonly string[], tier: string): boolean => list.includes(tier);

/** The moment an event leaves, or null when it leaves nothing worth a statement. */
export function postMomentOf(input: MomentInput): Moment | null {
  const { tier, placement, series } = input;
  const last = series[series.length - 1];
  if (!last) return null;
  if (placement === "champion" && has(O.titleTiers, tier)) return { moment: "title", seriesN: last.n };
  if (placement === "runner_up" && has(O.finalTiers, tier)) return { moment: "finalLost", seriesN: last.n };
  if (has(O.exitTiers, tier) && placement !== "champion" && placement !== "runner_up") return { moment: "exit", seriesN: last.n };
  if (tier === "qualifier" && placement === "swiss_exit" && input.seedRank <= O.qualifierFavouriteRank) {
    return { moment: "missedQualification", seriesN: last.n };
  }
  const step = breakthroughStepOf(tier, placement);
  if (step && !(input.reached ?? []).includes(step)) {
    const won = [...series].reverse().find((x) => x.won);
    if (won) return { moment: "breakthrough", seriesN: won.n };
  }
  if (has(O.upsetTiers, tier)) {
    let best: MomentSeries | null = null;
    for (const s of series) {
      if (!s.upset || Math.abs(s.gap) < O.upsetMinGap) continue;
      // An upset win: the user was the weaker side and won; a loss: the stronger side and lost.
      if (s.won ? s.gap >= 0 : s.gap <= 0) continue;
      if (!best || Math.abs(s.gap) > Math.abs(best.gap)) best = s;
    }
    if (best) return { moment: best.won ? "upsetWin" : "upsetLoss", seriesN: best.n };
  }
  let run = input.runBefore;
  let hit: Moment | null = null;
  for (const s of series) {
    run = s.won ? (run > 0 ? run + 1 : 1) : run < 0 ? run - 1 : -1;
    if (run > 0 && (O.streakMilestones as readonly number[]).includes(run)) hit = { moment: "streak", seriesN: s.n, streak: run };
  }
  return hit;
}

/** The step an event's result takes: through a qualifier, or into a regional's playoffs. */
export function breakthroughStepOf(tier: string, placement: Placement): "qualified" | "playoffs" | null {
  if (placement === "swiss_exit") return null;
  if (tier === "qualifier") return "qualified";
  if (tier === "regional") return "playoffs";
  return null;
}

/** A day on one line across seasons. */
const absDay = (seasonIndex: number, day: number): number => seasonIndex * DAYS_PER_SEASON + day;

/** May an offer surface now, given the days the earlier ones surfaced? */
export function offerAllowed(
  log: readonly { seasonIndex: number; day: number }[],
  now: { seasonIndex: number; day: number },
  moment: PostMoment,
): boolean {
  if (log.filter((o) => o.seasonIndex === now.seasonIndex).length >= O.perSeason) return false;
  if (moment === "title") return true;
  const last = log[log.length - 1];
  return !last || absDay(now.seasonIndex, now.day) - absDay(last.seasonIndex, last.day) >= O.minGapDays;
}

/** The last day an offer that surfaced on `day` may be answered. */
export const offerLastDay = (day: number): number => day + O.expireDays;

/** The signed result run at the end of a list of series (+n wins, -n losses in a row). */
export function runOf(series: readonly { won: boolean }[]): number {
  let run = 0;
  for (const s of series) run = s.won ? (run > 0 ? run + 1 : 1) : run < 0 ? run - 1 : -1;
  return run;
}

/** The user's series of a tournament in play order with the rating gap (same order as `feedSeriesOf`). */
export function userSeriesGapsOf(t: TournamentState): number[] {
  const rounds = [...t.swiss.rounds.map((r) => r.series), ...(t.playoffs?.rounds ?? []).map((r) => r.series)];
  const out: number[] = [];
  for (const round of rounds) {
    for (const s of round) {
      if (s.teamAId === "user") out.push(s.ratingDiff ?? 0);
      else if (s.teamBId === "user") out.push(-(s.ratingDiff ?? 0));
    }
  }
  return out;
}

/** The user's rank by rating in the field (1 = the strongest); 1 when the field carries no ratings. */
export function userSeedRankOf(t: TournamentState): number {
  const total = (id: string): number => t.teams[id]?.rating?.total ?? 0;
  const mine = total("user");
  return 1 + Object.keys(t.teams).filter((id) => id !== "user" && total(id) > mine).length;
}
