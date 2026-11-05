/**
 * Road to Worlds rc.36 (SUN-01, R88) — the Sunday coach briefing (pure TS).
 *
 * After the user's Saturday (the qualifier won, or a Major / Worlds paused
 * after its Swiss) HQ offers an optional briefing before Sunday is started:
 * Continuity keeps a steady edge; Recover favors the later series and
 * Prepare favors the entire Swiss. Championship Sunday targets explicit rounds,
 * without changing the frozen team or replaying completed stages.
 */

import { CAREER_GEAR, CAREER_SUNDAY } from "@/config/balance";
import type { TournamentState } from "@/engine/types";
import { roundOrderFor } from "@/engine/playoffs";
import { isTwoDayEvent, playoffsDayFor } from "./calendar";
import type { CareerEventDef, SundayBriefingChoice, WeekendState } from "./types";

/** Display order (the HQ card's three options). */
export const SUNDAY_BRIEFINGS: readonly SundayBriefingChoice[] = ["keep", "recover", "prepare"];

export function isSundayBriefingChoice(value: unknown): value is SundayBriefingChoice {
  return typeof value === "string" && (SUNDAY_BRIEFINGS as readonly string[]).includes(value);
}

/**
 * The day an event's Sunday falls on: a two-day event's playoffs day, a
 * one-day event's own day (the regional plays on Sunday).
 */
export function sundayOfEvent(def: Pick<CareerEventDef, "tier" | "week" | "day">): number {
  return isTwoDayEvent(def) ? playoffsDayFor(def) : def.day;
}

/** True on the event's Sunday (never a two-day event's Saturday). */
export function isEventSunday(def: Pick<CareerEventDef, "tier" | "week" | "day">, day: number): boolean {
  if (isTwoDayEvent(def) && day === def.day) return false;
  return day === sundayOfEvent(def);
}

/**
 * The user's series already played on the event's Sunday — a two-day
 * event's playoff rounds (its Swiss was Saturday's), a one-day event's
 * whole day.
 */
export function userSundaySeriesPlayed(def: Pick<CareerEventDef, "tier">, t: TournamentState): number {
  const has = (s: { teamAId: string; teamBId: string }) => s.teamAId === "user" || s.teamBId === "user";
  let n = 0;
  if (!isTwoDayEvent(def)) for (const r of t.swiss.rounds) n += r.series.filter(has).length;
  for (const r of t.playoffs?.rounds ?? []) n += r.series.filter(has).length;
  return n;
}

/** The briefing's effects as the HQ card states them (team rating). */
export function briefingEffectOf(choice: SundayBriefingChoice): { swiss: number; playoffs: number } {
  return CAREER_SUNDAY.briefing[choice];
}

/**
 * The team-rating edge the briefing gives the user's side in the NEXT round
 * of `t`: stage-specific, with championship effects selected by the bracket round.
 */
export function briefingEdgeFor(
  choice: SundayBriefingChoice,
  def: Pick<CareerEventDef, "tier">,
  t: TournamentState,
): number {
  if (t.stage === "finished") return 0;
  if (isTwoDayEvent(def)) {
    if (t.stage !== "playoffs" || !t.playoffs) return 0;
    const round = roundOrderFor(t.playoffs.format)[t.playoffs.rounds.length];
    const fx = CAREER_SUNDAY.championshipBriefing[choice];
    if (round === "grand_final" || round === "final") return fx.final;
    if (round === "quarterfinal" || round === "ub_quarterfinal" || round === "lb_round1") return fx.quarters;
    if (round === "semifinal" || round === "ub_semifinal" || round === "lb_round2" || round === "lb_semifinal") return fx.semis;
    return fx.other;
  }
  const fx = briefingEffectOf(choice);
  return t.stage === "swiss" ? fx.swiss : fx.playoffs;
}

/** Bootcamp and briefing share the temporary cap; permanent gear is separate. */
export function cappedBriefingEdge(edge: number, bootcamp: number): number {
  return Math.min(edge, CAREER_GEAR.tempRatingMax - Math.min(bootcamp, CAREER_GEAR.tempRatingMax));
}

/** `t` with the user's team rating raised by `edge` (a copy; `t` is untouched). */
export function withUserEdge(t: TournamentState, edge: number): TournamentState {
  const user = t.teams.user;
  if (!user || edge === 0) return t;
  return {
    ...t,
    teams: { ...t.teams, user: { ...user, rating: { ...user.rating, total: user.rating.total + edge } } },
  };
}

/**
 * The edge for the next round of the user's event `def` on `day`, from the
 * save's weekend record: only the event the briefing was given for, only on
 * its Sunday.
 */
export function sundayEdgeFor(
  weekend: WeekendState | null | undefined,
  def: Pick<CareerEventDef, "id" | "tier" | "week" | "day">,
  day: number,
  t: TournamentState,
  legacyBootcamp = 0,
): number {
  if (!weekend?.briefing || weekend.eventId !== def.id || !isEventSunday(def, day)) return 0;
  return cappedBriefingEdge(briefingEdgeFor(weekend.briefing, def, t), t.teams.user?.rating.temporaryMod ?? legacyBootcamp);
}

/**
 * rc.36 (SUN-01): the load repair for the weekend record — idempotent; an
 * unreadable record is dropped (absent = no weekend stop pending), an
 * unknown briefing reads as none.
 */
export function repairWeekendState(save: { weekend?: unknown }): void {
  const w = save.weekend as Partial<WeekendState> | null | undefined;
  if (w === undefined || w === null) return;
  if (typeof w !== "object" || typeof w.eventId !== "string") {
    save.weekend = null;
    return;
  }
  if (w.briefing !== null && !isSundayBriefingChoice(w.briefing)) w.briefing = null;
  if (w.follow !== undefined && w.follow !== "watch" && w.follow !== "results" && w.follow !== "skip") delete w.follow;
}
