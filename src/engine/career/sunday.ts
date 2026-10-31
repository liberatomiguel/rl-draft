/**
 * Road to Worlds rc.36 (SUN-01, R88) — the Sunday coach briefing (pure TS).
 *
 * After the user's Saturday (the qualifier won, or a Major / Worlds paused
 * after its Swiss) HQ offers an optional briefing before Sunday is started:
 * keep the plan (no change), recover (a steady edge in every series of the
 * day) or prepare for the opponent (a bigger edge in the day's opening
 * series). The edge is a team-rating bump on the user's side for one round
 * at a time (CAREER_SUNDAY.briefing) — the base team stays as it was frozen
 * when the event started. Deterministic: the same save and the same briefing
 * always play the same Sunday; "keep" (and a save without a briefing) plays
 * exactly rc.35's Sunday.
 */

import { CAREER_SUNDAY } from "@/config/balance";
import type { TournamentState } from "@/engine/types";
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
export function briefingEffectOf(choice: SundayBriefingChoice): { everySeries: number; opener: number } {
  return CAREER_SUNDAY.briefing[choice];
}

/**
 * The team-rating edge the briefing gives the user's side in the NEXT round
 * of `t` (0 when nothing applies): `everySeries` on any Sunday round, plus
 * `opener` while the user has not played a series yet that day.
 */
export function briefingEdgeFor(
  choice: SundayBriefingChoice,
  def: Pick<CareerEventDef, "tier">,
  t: TournamentState,
): number {
  const fx = briefingEffectOf(choice);
  const opener = fx.opener !== 0 && userSundaySeriesPlayed(def, t) === 0 ? fx.opener : 0;
  return fx.everySeries + opener;
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
): number {
  if (!weekend?.briefing || weekend.eventId !== def.id || !isEventSunday(def, day)) return 0;
  return briefingEdgeFor(weekend.briefing, def, t);
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
