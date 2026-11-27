/**
 * Road to Worlds — media days, the store side (v2.3 MEDIA, wave 2).
 *
 * The career store calls `mediaDaysAfter(prev, next)` once per write (its
 * `withSave` / `withResult`, marked `// v2.3 MEDIA`), the way the locker room
 * is hooked: the facts are read from the two saves, so no career flow changes.
 *   - a weekly tick (a Monday crossed): the seeded roll for an offer (M1),
 *     which lands in the inbox as mail with accept / decline (M2);
 *   - every write: an open offer past its deadline lapses as declined (M2),
 *     a trip whose player left is cancelled, the cash of a trip whose first
 *     day has come is booked once to the ledger (M5), and an accepted trip
 *     over a committed event rules the player out of it through the existing
 *     absence system, `save.pendingUnavailability` with its own reason (M3).
 * `answerMediaOfferFlow` is the store's `answerMediaOffer` (accept, decline).
 *
 * FEATURES.mediaDays off: nothing runs and nothing is written. On, the save
 * gets `mediaDays` at its first offer.
 */

import { CAREER_MEDIA, FEATURES } from "@/config/balance";
import { dateOfDay, weekOfDay } from "@/engine/career/calendar";
import { deliverMail } from "@/engine/career/communications";
import { pushLedger } from "@/engine/career/economy";
import { emptyLockerRoom, nudgeMorale } from "@/engine/career/lockerRoom";
import {
  absWeekOf,
  acceptOffer,
  addOffer,
  cancelAway,
  declineOffer,
  dueAway,
  lapseOffers,
  rollMediaOffer,
  settleAway,
  type MediaDaysState,
  type MediaEventRef,
  type MediaOffer,
} from "@/engine/career/mediaDays";
import type { CareerSave } from "@/engine/career/types";
import { CAREER_MEDIA_EN } from "@/content/copy.career.media.en";
import { userEventDefOnDay, type FlowResult } from "./careerFlow";
import { followersOf } from "./fanFeedFlow";

/** The user's official event occupying a day, if the club plays it (M2); cups and side formats do not count. */
function userEventOn(save: CareerSave, day: number): MediaEventRef | null {
  const def = userEventDefOnDay(save, day);
  if (!def || def.tier === "t2" || def.tier === "t3" || def.teamSize) return null;
  // A Major or Worlds field already decided without the club is not its event; an undecided one counts (the safe side).
  const field = def.tier === "major" ? save.competition.majorFieldRefs : def.tier === "worlds" ? save.competition.worldsFieldRefs : undefined;
  if (field && !field.includes("user")) return null;
  return { id: def.id, name: def.name };
}

const nameOf = (save: CareerSave, id: string): string => save.squad.find((p) => p.id === id)?.name ?? id;
const brandName = (i: number): string => CAREER_MEDIA_EN.brands[i % CAREER_MEDIA_EN.brands.length];

function dateParams(prefix: string, seasonIndex: number, day: number): Record<string, number> {
  const d = dateOfDay(seasonIndex, day);
  return { [`${prefix}Dow`]: d.dow, [`${prefix}D`]: d.d, [`${prefix}M`]: d.m };
}

/** The offer's mail: the dates, the cash and the event(s) he would miss (M2). Resolved by `copy.career.media`. */
function deliverOffer(save: CareerSave, offer: MediaOffer): void {
  deliverMail(save, {
    kind: "club",
    titleKey: "mediaOffer",
    bodyKey: "mediaOffer",
    params: {
      offerId: offer.id,
      player: nameOf(save, offer.playerId),
      brand: offer.brand,
      cash: offer.cash,
      days: offer.to - offer.from + 1,
      ...dateParams("from", offer.seasonIndex, offer.from),
      ...dateParams("to", offer.seasonIndex, offer.to),
      ...dateParams("deadline", offer.seasonIndex, offer.deadline),
      ...(offer.events[0] ? { event: offer.events[0].name } : {}),
      ...(offer.events[1] ? { event2: offer.events[1].name } : {}),
      // The warning is shown only where it costs something: the locker room on.
      fatigue: offer.tired && FEATURES.lockerRoom ? 1 : 0,
    },
    fromKey: "sponsor",
  });
}

function deliverCalledOff(save: CareerSave, offer: MediaOffer | undefined, why: "gone" | "seat", playerId: string): void {
  if (!offer) return;
  deliverMail(save, {
    kind: "club",
    titleKey: "mediaCalledOff",
    bodyKey: "mediaCalledOff",
    params: { offerId: offer.id, player: nameOf(save, playerId), brand: offer.brand, why, event: offer.events[0]?.name ?? "" },
    fromKey: "sponsor",
  });
}

/**
 * M3: an accepted trip over a committed event rules the player out of it with
 * the absence system's own fields (the lobby, HQ and the lineup read them).
 * One absentee per event: a seat already taken by another player cancels a
 * trip not yet paid (the offer is never made over such an event; this is only
 * the pre-event roll landing after the accept).
 */
function applyAbsences(save: CareerSave, state: MediaDaysState): MediaDaysState {
  let st = state;
  for (const a of state.away) {
    if (a.seasonIndex !== save.clock.seasonIndex || save.clock.day > a.to) continue;
    for (const eventId of a.eventIds) {
      const committed = save.pendingEventDef?.id === eventId || save.activeEvent?.def.id === eventId;
      if (!committed) continue;
      const u = save.pendingUnavailability;
      if (!u || u.eventId !== eventId) {
        save.pendingUnavailability = { playerId: a.playerId, eventId, reason: "media" };
      } else if (u.playerId !== a.playerId && !a.paid) {
        const offer = st.offers.find((o) => o.id === a.offerId);
        st = cancelAway(st, a.offerId);
        deliverCalledOff(save, offer, "seat", a.playerId);
        break;
      }
    }
  }
  return st;
}

/** M5: book the cash of the trips whose first day has come, once; cancel the ones whose player left. */
function settleTrips(save: CareerSave, state: MediaDaysState): MediaDaysState {
  const now = { seasonIndex: save.clock.seasonIndex, day: save.clock.day };
  let st = state;
  for (const a of state.away) {
    if (a.paid || save.squad.some((p) => p.id === a.playerId)) continue;
    const offer = st.offers.find((o) => o.id === a.offerId);
    st = cancelAway(st, a.offerId);
    deliverCalledOff(save, offer, "gone", a.playerId);
  }
  const due = dueAway(st, now);
  if (due.length > 0) {
    for (const a of due) {
      save.finances = pushLedger(save.finances, {
        seasonIndex: now.seasonIndex,
        week: weekOfDay(now.day),
        day: now.day,
        kind: "mediaDay",
        amount: a.cash,
        refName: brandName(a.brand),
      });
    }
    st = settleAway(st, due.map((a) => a.offerId), now);
  } else if (st.away.some((a) => a.paid)) {
    st = settleAway(st, [], now);
  }
  return st;
}

/**
 * The store's hook: apply one write to `next` in place (its `mediaDays`, its
 * mail, its ledger, its pending absence). Never throws into gameplay: a
 * failure leaves `next` as the flow made it.
 */
export function mediaDaysAfter(prev: CareerSave, next: CareerSave): void {
  if (!FEATURES.mediaDays || prev === next || next.proHost || next.phase === "ended") return;
  try {
    let st: MediaDaysState | null = next.mediaDays ?? null;
    const now = { seasonIndex: next.clock.seasonIndex, day: next.clock.day };
    if (st) {
      st = lapseOffers(st, now).state;
      st = settleTrips(next, st);
    }
    const weeks = absWeekOf(next.clock.seasonIndex, next.clock.day) - absWeekOf(prev.clock.seasonIndex, prev.clock.day);
    if (weeks > 0 && next.phase === "running") {
      const rolled = rollMediaOffer({
        careerSeed: next.careerSeed,
        seasonIndex: next.clock.seasonIndex,
        day: next.clock.day,
        reputation: next.reputation,
        difficulty: next.difficulty,
        followers: followersOf(next),
        squad: next.squad.map((p) => ({ id: p.id, overall: p.overall, starter: next.starterIds.includes(p.id), role: p.role })),
        state: st,
        eventOnDay: (day) => userEventOn(next, day),
        outForEvent: (id) => (next.pendingUnavailability?.eventId === id ? [next.pendingUnavailability.playerId] : []),
      });
      if (rolled) {
        const added = addOffer(st, rolled, absWeekOf(next.clock.seasonIndex, next.clock.day));
        st = added.state;
        deliverOffer(next, added.offer);
      }
    }
    if (st) {
      st = applyAbsences(next, st);
      if (JSON.stringify(st) !== JSON.stringify(next.mediaDays ?? null)) next.mediaDays = st;
    }
  } catch (error) {
    console.error("[career] media days step failed; skipped", error);
  }
}

/**
 * M2 / M4: the manager answers an offer from the inbox. Declining changes
 * nothing else. Accepting records the trip (the cash is booked on its first
 * day), rules him out of the event inside the days if one is committed, and,
 * with the locker room on, costs him morale when he was sent again inside the
 * fatigue window (reason shown in the mood mail and his last change).
 */
export function answerMediaOfferFlow(input: CareerSave, offerId: string, accept: boolean): FlowResult {
  if (!FEATURES.mediaDays || !input.mediaDays) return { save: input, error: "unknown" };
  const now = { seasonIndex: input.clock.seasonIndex, day: input.clock.day };
  if (!accept) {
    const out = declineOffer(input.mediaDays, offerId);
    if (out.error) return { save: input, error: out.error };
    const save = structuredClone(input);
    save.mediaDays = out.state;
    return { save };
  }
  const out = acceptOffer(input.mediaDays, offerId, now, input.squad.map((p) => p.id));
  if (out.error || !out.offer) return { save: input, error: out.error ?? "unknown" };
  const save = structuredClone(input);
  save.mediaDays = applyAbsences(save, out.state);
  if (out.tired && FEATURES.lockerRoom) {
    const res = nudgeMorale(save.lockerRoom ?? emptyLockerRoom(), { clock: now, careerSeed: save.careerSeed }, out.offer.playerId, -CAREER_MEDIA.fatigue.morale, "mediaFatigue");
    save.lockerRoom = res.state;
    for (const n of res.notes) {
      if (n.kind !== "mood") continue;
      const changes = n.changes.map((c) => `${nameOf(save, c.playerId)}~${c.mood}`).join("|");
      deliverMail(save, {
        kind: "club",
        titleKey: "lockerMood",
        params: { event: `mood:${n.reason}:${save.seq + 1}`, reason: n.reason, changes, count: n.changes.length },
        fromKey: "staff",
      });
    }
  }
  return { save };
}
