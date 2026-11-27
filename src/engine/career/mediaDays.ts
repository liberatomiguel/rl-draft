/**
 * v2.3 MEDIA (wave 2, HISTORIAS-WAVE2 M1-M6): media days. A brand offers cash
 * for a named player of the user's club to be away 2 to 4 days. Pure and
 * seeded (`src/lib/rng.ts`): the same save gives the same offers. The store
 * side (`store/mediaDaysFlow.ts`) reads the saves, delivers the mail, books
 * the cash and uses the existing absence system (`pendingUnavailability`).
 *
 *  - M1  `rollMediaOffer`: on a weekly tick, seeded; likelier with reputation
 *        and (fan feed on) followers; who, how much, which days.
 *  - M2  the offer names the event(s) of the user's inside the days; it never
 *        holds the clock and `lapseOffers` closes it as declined on its deadline.
 *  - M3  `leavesEnough`: the club is never offered a date that leaves it
 *        without three players for an event of its own.
 *  - M4  `recentTripOf`: a repeat trip inside the fatigue window (the store
 *        turns it into a morale hit when the locker room is on).
 *  - M5  `mediaCashFor`: about one week of a typical sponsor's income.
 */

import { CAREER_CALENDAR, CAREER_ECONOMY, CAREER_MEDIA as M, CAREER_SPONSOR } from "@/config/balance";
import { createRng } from "@/lib/rng";
import { weekOfDay } from "./calendar";
import { quantize } from "./economy";
import { deriveSeed, streams } from "./seeds";
import { tierValuePerWeek } from "./sponsorDeals";
import type { CareerDifficulty } from "./types";

const DAYS_PER_SEASON = CAREER_CALENDAR.weeksPerSeason * CAREER_CALENDAR.daysPerWeek;
const LINEUP = 3;

// ---------------------------------------------------------------------------
// State (the one additive field on the career save: `CareerSave.mediaDays`)
// ---------------------------------------------------------------------------

export type MediaStatus = "open" | "accepted" | "declined" | "lapsed" | "cancelled";

export interface MediaEventRef {
  id: string;
  name: string;
}

export interface MediaOffer {
  id: string;
  /** Index into the copy's brand bank (`CAREER_MEDIA.brands` names). */
  brand: number;
  playerId: string;
  seasonIndex: number;
  /** The day the offer arrived. */
  made: number;
  /** First and last away day (inclusive), days of `seasonIndex`. */
  from: number;
  to: number;
  /** The last day the manager can answer (the day before `from`). */
  deadline: number;
  cash: number;
  /** The user's events inside the days (M2): the ones he would miss. */
  events: MediaEventRef[];
  /** The same player was sent inside the fatigue window when this offer arrived (M4). */
  tired?: true;
  status: MediaStatus;
}

/** An accepted trip, until its cash is booked and its days are over. */
export interface MediaAway {
  offerId: string;
  playerId: string;
  seasonIndex: number;
  from: number;
  to: number;
  cash: number;
  brand: number;
  eventIds: string[];
  paid: boolean;
}

export interface MediaTrip {
  playerId: string;
  /** Absolute week of the trip's first day. */
  absWeek: number;
}

export interface MediaDaysState {
  v: 1;
  seq: number;
  offers: MediaOffer[];
  away: MediaAway[];
  trips: MediaTrip[];
  /** Absolute week of the last offer that arrived (the cooldown). */
  lastOfferWeek?: number;
}

export function emptyMediaDays(): MediaDaysState {
  return { v: 1, seq: 0, offers: [], away: [], trips: [] };
}

// ---------------------------------------------------------------------------
// Small reads
// ---------------------------------------------------------------------------

export const absWeekOf = (seasonIndex: number, day: number): number => seasonIndex * CAREER_CALENDAR.weeksPerSeason + weekOfDay(day);
const absDayOf = (seasonIndex: number, day: number): number => seasonIndex * DAYS_PER_SEASON + day;

/** The offers waiting for an answer. */
export const openOffersOf = (state: MediaDaysState | null | undefined): MediaOffer[] => (state?.offers ?? []).filter((o) => o.status === "open");

/** M1: the weekly chance of an offer. */
export function offerChanceOf(reputation: number, followers: number | null): number {
  const base = Math.min(M.chance.max, M.chance.base + M.chance.perRep * Math.max(0, reputation));
  const lift = followers === null ? 1 : 1 + M.followers.boost * Math.min(1, Math.max(0, followers) / M.followers.ref);
  return Math.min(1, base * lift);
}

/** The sponsor tier a club of this reputation is offered (the tiers' own gates). */
export function sponsorTierOfRep(reputation: number): 1 | 2 | 3 | 4 {
  let tier = 1;
  for (const row of CAREER_SPONSOR.tiers) if (reputation >= row.repGate) tier = row.tier;
  return tier as 1 | 2 | 3 | 4;
}

/**
 * M5: the cash of a media day: `CAREER_MEDIA.cash.weeks` of the weekly value
 * of the sponsor tier the reputation reaches (`tierValuePerWeek`, on the money
 * index and the difficulty's sponsor multiplier), a little more for a longer
 * trip, with a seeded spread. `spread` is a float in [-1, 1].
 */
export function mediaCashFor(input: { reputation: number; seasonIndex: number; difficulty: CareerDifficulty; days: number; spread: number }): number {
  const weekly = tierValuePerWeek(sponsorTierOfRep(input.reputation), input.seasonIndex, input.difficulty);
  const byDays = M.cash.byDays[input.days] ?? 1;
  const raw = weekly * M.cash.weeks * byDays * (1 + M.cash.jitter * input.spread);
  return Math.max(CAREER_ECONOMY.roundQuantum, quantize(raw));
}

/** Is he away on this day (an accepted trip, not yet over)? */
export function awayOn(state: MediaDaysState | null | undefined, playerId: string, seasonIndex: number, day: number): boolean {
  return (state?.away ?? []).some((a) => a.playerId === playerId && a.seasonIndex === seasonIndex && day >= a.from && day <= a.to);
}

/** M4: the weeks since this player's last trip, when it is inside the fatigue window; else null. */
export function recentTripOf(state: MediaDaysState | null | undefined, playerId: string, absWeek: number): number | null {
  let best: number | null = null;
  for (const t of state?.trips ?? []) {
    if (t.playerId !== playerId) continue;
    const ago = absWeek - t.absWeek;
    if (ago >= 0 && ago <= M.fatigue.weeks && (best === null || ago < best)) best = ago;
  }
  return best;
}

// ---------------------------------------------------------------------------
// M3: the club is never left short
// ---------------------------------------------------------------------------

export interface MediaSquadMember {
  id: string;
  overall: number;
  /** In the lineup (`starterIds`). */
  starter: boolean;
  role: "starter" | "sub";
}

/**
 * M3: would the club still have three available players for an event with
 * `playerId` away (and `alsoOut` already out for it)? A starter's seat is
 * covered only by a registered reserve who is not already out (the absence
 * system's own rule, `reserveCovers`).
 */
export function leavesEnough(squad: readonly MediaSquadMember[], playerId: string, alsoOut: readonly string[] = []): boolean {
  const out = new Set([playerId, ...alsoOut]);
  const left = squad.filter((p) => !out.has(p.id));
  if (left.length < LINEUP) return false;
  const him = squad.find((p) => p.id === playerId);
  if (!him) return false;
  const starterOut = squad.some((p) => out.has(p.id) && p.starter);
  if (starterOut && !left.some((p) => p.role === "sub" && !p.starter)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// M1: the roll
// ---------------------------------------------------------------------------

export interface MediaRollContext {
  careerSeed: number;
  seasonIndex: number;
  /** Today (a weekly tick has just crossed). */
  day: number;
  reputation: number;
  difficulty: CareerDifficulty;
  /** The fan feed's followers; null when the feed is off or never ran. */
  followers: number | null;
  squad: readonly MediaSquadMember[];
  state: MediaDaysState | null | undefined;
  /** The user's official event occupying a day (a qualifier, a regional, a Major he is in, Worlds), else null. */
  eventOnDay: (day: number) => MediaEventRef | null;
  /** Players already out for an event (the absence system's pending ruling). */
  outForEvent: (eventId: string) => readonly string[];
}

/**
 * M1-M3: one weekly roll. Null when no offer arrives: too early in the
 * season, inside the cooldown, one still open, a lost chance roll, or no
 * (player, dates) draw that leaves the club three players for every event in
 * the days. The id is not set (`offer.id` comes from the state's counter when
 * it is added with `addOffer`).
 */
export function rollMediaOffer(ctx: MediaRollContext): Omit<MediaOffer, "id" | "status"> | null {
  const week = weekOfDay(ctx.day);
  const abs = absWeekOf(ctx.seasonIndex, ctx.day);
  const st = ctx.state;
  if (week < M.firstWeek || ctx.squad.length === 0) return null;
  if (openOffersOf(st).length > 0) return null;
  if (st?.lastOfferWeek !== undefined && abs - st.lastOfferWeek <= M.cooldownWeeks) return null;

  const rng = createRng(deriveSeed(ctx.careerSeed, streams.gen("mediaDay", `${ctx.seasonIndex}:${abs}`)));
  if (!rng.chance(offerChanceOf(ctx.reputation, ctx.followers))) return null;

  for (let attempt = 0; attempt < M.tries; attempt++) {
    const player = rng.weightedPick(ctx.squad, (p) => Math.pow(Math.max(1, p.overall), M.pickPower));
    const days = rng.int(M.days.min, M.days.max);
    const from = ctx.day + rng.int(M.startOffset.min, M.startOffset.max);
    const spread = rng.range(-1, 1);
    const brand = rng.int(0, M.brands - 1);
    const to = from + days - 1;
    if (to > DAYS_PER_SEASON) continue;
    if ((st?.away ?? []).some((a) => a.playerId === player.id && a.seasonIndex === ctx.seasonIndex && a.from <= to && a.to >= from)) continue;

    const events: MediaEventRef[] = [];
    let ok = true;
    for (let d = from; d <= to && ok; d++) {
      const ev = ctx.eventOnDay(d);
      if (!ev || events.some((e) => e.id === ev.id)) continue;
      // One absentee per event: another already out for it, or a trip already booked over it, refuses the date.
      const taken = ctx.outForEvent(ev.id).length > 0 || (st?.away ?? []).some((a) => a.eventIds.includes(ev.id));
      if (taken || !leavesEnough(ctx.squad, player.id)) ok = false;
      else events.push(ev);
    }
    if (!ok) continue;

    return {
      brand,
      playerId: player.id,
      seasonIndex: ctx.seasonIndex,
      made: ctx.day,
      from,
      to,
      deadline: from - 1,
      cash: mediaCashFor({ reputation: ctx.reputation, seasonIndex: ctx.seasonIndex, difficulty: ctx.difficulty, days, spread }),
      events,
      ...(recentTripOf(st, player.id, absWeekOf(ctx.seasonIndex, from)) !== null ? { tired: true as const } : {}),
    };
  }
  return null;
}

/** Add a rolled offer (open) to the state; the state's counter names it. */
export function addOffer(input: MediaDaysState | null | undefined, rolled: Omit<MediaOffer, "id" | "status">, abs: number): { state: MediaDaysState; offer: MediaOffer } {
  const state = structuredClone(input ?? emptyMediaDays());
  state.seq += 1;
  const offer: MediaOffer = { ...rolled, id: `media:${state.seq}`, status: "open" };
  state.offers.unshift(offer);
  state.lastOfferWeek = abs;
  return { state: prune(state), offer };
}

function prune(state: MediaDaysState): MediaDaysState {
  const open = state.offers.filter((o) => o.status === "open");
  const closed = state.offers.filter((o) => o.status !== "open").slice(0, M.keepAnswered);
  state.offers = [...open, ...closed];
  state.trips = state.trips.slice(0, M.keepTrips);
  return state;
}

// ---------------------------------------------------------------------------
// M2: answering, lapsing
// ---------------------------------------------------------------------------

export interface MediaNow {
  seasonIndex: number;
  day: number;
}

/** M2: an offer unanswered after its deadline closes as declined ("lapsed"). Returns the same state object when nothing lapsed. */
export function lapseOffers(state: MediaDaysState, now: MediaNow): { state: MediaDaysState; lapsed: MediaOffer[] } {
  const t = absDayOf(now.seasonIndex, now.day);
  const due = state.offers.filter((o) => o.status === "open" && t > absDayOf(o.seasonIndex, o.deadline));
  if (due.length === 0) return { state, lapsed: [] };
  const next = structuredClone(state);
  const lapsed: MediaOffer[] = [];
  for (const o of next.offers) {
    if (o.status === "open" && t > absDayOf(o.seasonIndex, o.deadline)) {
      o.status = "lapsed";
      lapsed.push(o);
    }
  }
  return { state: prune(next), lapsed };
}

export type MediaAnswerError = "unknown" | "answered" | "late" | "gone";

/**
 * Decline an open offer. Nothing else changes.
 */
export function declineOffer(state: MediaDaysState, offerId: string): { state: MediaDaysState; error?: MediaAnswerError } {
  const found = state.offers.find((o) => o.id === offerId);
  if (!found) return { state, error: "unknown" };
  if (found.status !== "open") return { state, error: "answered" };
  const next = structuredClone(state);
  next.offers.find((o) => o.id === offerId)!.status = "declined";
  return { state: prune(next) };
}

/**
 * Accept an open offer inside its deadline for a player still at the club:
 * the trip is recorded (`away`, `trips`), the cash is booked later, on the
 * first away day (`dueAway`). `tired` = he was sent again inside the fatigue
 * window (M4): the store turns that into a morale hit.
 */
export function acceptOffer(
  state: MediaDaysState,
  offerId: string,
  now: MediaNow,
  squadIds: readonly string[],
): { state: MediaDaysState; offer?: MediaOffer; tired?: boolean; error?: MediaAnswerError } {
  const found = state.offers.find((o) => o.id === offerId);
  if (!found) return { state, error: "unknown" };
  if (found.status !== "open") return { state, error: "answered" };
  if (absDayOf(now.seasonIndex, now.day) > absDayOf(found.seasonIndex, found.deadline)) return { state, error: "late" };
  if (!squadIds.includes(found.playerId)) return { state, error: "gone" };
  const next = structuredClone(state);
  const offer = next.offers.find((o) => o.id === offerId)!;
  offer.status = "accepted";
  const week = absWeekOf(offer.seasonIndex, offer.from);
  const tired = recentTripOf(state, offer.playerId, week) !== null;
  next.away.push({
    offerId: offer.id,
    playerId: offer.playerId,
    seasonIndex: offer.seasonIndex,
    from: offer.from,
    to: offer.to,
    cash: offer.cash,
    brand: offer.brand,
    eventIds: offer.events.map((e) => e.id),
    paid: false,
  });
  next.trips.unshift({ playerId: offer.playerId, absWeek: week });
  return { state: prune(next), offer, tired };
}

/** Trips whose first away day has come and whose cash is not booked yet. */
export function dueAway(state: MediaDaysState | null | undefined, now: MediaNow): MediaAway[] {
  const t = absDayOf(now.seasonIndex, now.day);
  return (state?.away ?? []).filter((a) => !a.paid && t >= absDayOf(a.seasonIndex, a.from));
}

/** Mark trips paid and drop the ones that are paid and over. */
export function settleAway(state: MediaDaysState, paidOfferIds: readonly string[], now: MediaNow): MediaDaysState {
  const t = absDayOf(now.seasonIndex, now.day);
  const next = structuredClone(state);
  for (const a of next.away) if (paidOfferIds.includes(a.offerId)) a.paid = true;
  next.away = next.away.filter((a) => !(a.paid && t > absDayOf(a.seasonIndex, a.to)));
  return next;
}

/** A trip that cannot go ahead (he left, or his event seat was taken): the offer is cancelled and nothing is paid. */
export function cancelAway(state: MediaDaysState, offerId: string): MediaDaysState {
  const next = structuredClone(state);
  const o = next.offers.find((x) => x.id === offerId);
  if (o) o.status = "cancelled";
  next.away = next.away.filter((a) => a.offerId !== offerId);
  return next;
}
