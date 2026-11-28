/**
 * Road to Worlds — the locker room's store side (v2.3 LOCKER, wave 1; rc9 LOCKER).
 *
 * The career store calls `lockerRoomAfter(prev, next)` once per write (its
 * `withSave` / `withResult`, marked `// v2.3 LOCKER`; since rc9 the arc bot
 * does too). The facts of the write are read from the two saves, so no career
 * flow changes:
 *   - the weekly tick: the Mondays the clock crossed, with each player's
 *     training load in the week that ended (rc9, R214);
 *   - a series settled: a new result in `eventResults` the club played (its
 *     lineup: the event's `fieldedIds`, else the starters), with the user's
 *     series and the win chance the ratings gave each (rc9, R212); a 1v1 / 2v2
 *     cup counts for its participants only;
 *   - the box score's new games (rc9, R213);
 *   - a player listed (a new `transferList` entry) or sold (gone from the
 *     squad with a fresh `soldOn` entry);
 *   - an AI bid refused: an incoming bid gone the same day, the player still here;
 *   - rc9 (R216): a 1v1 / 2v2 cup surfaced, the regional became the next event;
 *   - a talk answered: `answerLockerTalkFlow`, the store's `answerLockerTalk`.
 * `engine/career/lockerRoom.ts` applies them; the notes become mail.
 *
 * FEATURES.lockerRoom off: nothing runs and nothing is written. On, the save
 * gets `lockerRoom` at its first fact (in practice its first Monday).
 */

import { CAREER_LOCKER as L, FEATURES } from "@/config/balance";
import { weekOfDay } from "@/engine/career/calendar";
import { communityParticipantsFor } from "@/engine/career/community";
import { deliverMail } from "@/engine/career/communications";
import {
  answerLockerTalk,
  emptyLockerRoom,
  lockerStep,
  type LockerEffect,
  type LockerNote,
  type LockerStepInput,
  type TalkAnswer,
} from "@/engine/career/lockerRoom";
import { boxDeltaOf, loadsOf, seriesOfUser, userWasFavourite } from "@/engine/career/lockerRoomFacts";
import type { CareerSave } from "@/engine/career/types";
import { listPlayerFlow, listingPlanFor, setStartersFlow, type FlowResult } from "./careerFlow";

const absWeek = (c: { seasonIndex: number; day: number }) => c.seasonIndex * 32 + weekOfDay(c.day);

/** The facts of one write, or null when nothing in it concerns the locker room. */
export function lockerFactsOf(prev: CareerSave, next: CareerSave): LockerStepInput | null {
  const nextIds = new Set(next.squad.map((p) => p.id));
  const departed = prev.squad
    .filter((p) => !nextIds.has(p.id))
    .map((p) => {
      const sold = next.soldOn?.[p.id];
      const before = prev.soldOn?.[p.id];
      return { id: p.id, sold: Boolean(sold && (!before || before.seasonIndex !== sold.seasonIndex || before.day !== sold.day)) };
    });

  const wasListed = new Set((prev.transferList ?? []).map((l) => l.playerId));
  const listed = (next.transferList ?? []).map((l) => l.playerId).filter((id) => !wasListed.has(id));

  const sameDay = prev.clock.seasonIndex === next.clock.seasonIndex && prev.clock.day === next.clock.day;
  const stillOffered = new Set(next.pendingOffers.map((o) => o.id));
  const bidsRefused = sameDay
    ? prev.pendingOffers
        .filter((o) => o.direction === "out" && o.status === "pending" && !o.listed && !stillOffered.has(o.id) && nextIds.has(o.playerId))
        .map((o) => o.playerId)
    : [];

  const seen = new Set(prev.eventResults.map((r) => `${r.seasonIndex}:${r.eventId}`));
  const events: NonNullable<LockerStepInput["events"]> = [];
  for (const r of next.eventResults) {
    if (seen.has(`${r.seasonIndex}:${r.eventId}`)) continue;
    if (r.userPlacement === undefined && !r.rows.some((row) => row.ref === "user")) continue;
    const active = prev.activeEvent?.def.id === r.eventId ? prev.activeEvent : null;
    const def = active?.def ?? (prev.pendingEventDef?.id === r.eventId ? prev.pendingEventDef : null);
    const key = `${r.seasonIndex}:${r.eventId}`;
    if (def?.teamSize) {
      // A 1v1 / 2v2 side event is not the club's lineup: rc9 credits its participants only.
      events.push({ eventId: r.eventId, tier: r.tier, placement: r.userPlacement, lineup: active?.fieldedIds ?? communityParticipantsFor(prev, def), key, side: true });
      continue;
    }
    const tournament = active?.tournament ?? null;
    events.push({
      eventId: r.eventId,
      tier: r.tier,
      placement: r.userPlacement,
      lineup: active?.fieldedIds ?? [...prev.starterIds],
      key,
      ...(tournament ? { series: seriesOfUser(tournament, "user", prev.difficulty), favourite: userWasFavourite(tournament) } : {}),
    });
  }

  const ids = next.squad.map((p) => p.id);
  const weeks = Math.max(0, absWeek(next.clock) - absWeek(prev.clock));
  const box = boxDeltaOf(prev.boxStats, next.boxStats, next.clock.seasonIndex, ids);
  const offer = next.unofficialOffer;
  const sideOffer =
    offer?.teamSize && offer.tier === "t3" && prev.unofficialOffer?.id !== offer.id
      ? { eventId: offer.id, teamSize: offer.teamSize, day: offer.day }
      : undefined;
  const pend = next.pendingEventDef;
  const nextOfficial = pend && !pend.teamSize && prev.pendingEventDef?.id !== pend.id ? { eventId: pend.id, tier: pend.tier, day: pend.day } : undefined;
  const due = Boolean(
    next.lockerRoom && (next.lockerRoom.promises.length > 0 || next.lockerRoom.swap || next.lockerRoom.talks.some((t) => t.answer === undefined)),
  );
  if (!departed.length && !listed.length && !bidsRefused.length && !events.length && !weeks && !due && !Object.keys(box).length && !sideOffer && !nextOfficial) {
    return null;
  }
  return {
    clock: { seasonIndex: next.clock.seasonIndex, day: next.clock.day },
    careerSeed: next.careerSeed,
    squad: next.squad.map((p) => ({ id: p.id, overall: p.overall })),
    departed,
    listed,
    bidsRefused,
    events,
    weeks,
    box,
    // The week that ended trained on the plan that ran in it.
    ...(weeks > 0 ? { loads: loadsOf(prev.training, ids) } : {}),
    starters: [...next.starterIds],
    ...(sideOffer ? { sideOffer } : {}),
    ...(nextOfficial ? { nextOfficial } : {}),
  };
}

/**
 * The store's hook: apply one write's facts to `next` in place (its
 * `lockerRoom`, its mail, and rc9: the lineup back after a reserve's one
 * event). Never throws into gameplay: a failure leaves `next` as the flow made it.
 */
export function lockerRoomAfter(prev: CareerSave, next: CareerSave): void {
  if (!FEATURES.lockerRoom || prev === next || next.proHost || next.phase === "ended") return;
  try {
    const facts = lockerFactsOf(prev, next);
    if (!facts) return;
    const { state, notes } = lockerStep(next.lockerRoom ?? emptyLockerRoom(), facts);
    next.lockerRoom = state;
    for (const n of notes) if (n.kind === "swapBack") swapBack(next, n.inId, n.outId);
    deliverNotes(next, notes, prev);
  } catch (error) {
    console.error("[career] locker room step failed; skipped", error);
  }
}

/**
 * L3: the manager answers a talk from the inbox. "sell" (an agreed sale) also
 * puts him on the transfer list at his value when a window is open; when it
 * is closed the mail says so and the listing is the manager's to make. rc9
 * (R216): a load answer tweaks his workload in the running package, a cup
 * answer enters the cup with him, a start answer swaps him in for the event.
 */
export function answerLockerTalkFlow(input: CareerSave, talkId: string, answer: TalkAnswer): FlowResult {
  if (!FEATURES.lockerRoom || !input.lockerRoom) return { save: input, error: "unknown" };
  const out = answerLockerTalk(input.lockerRoom, talkId, answer, {
    clock: { seasonIndex: input.clock.seasonIndex, day: input.clock.day },
    careerSeed: input.careerSeed,
    squad: input.squad.map((p) => ({ id: p.id, overall: p.overall })),
  });
  if (out.error) return { save: input, error: out.error };
  let save = structuredClone(input);
  save.lockerRoom = out.state;
  const talk = out.state.talks.find((t) => t.id === talkId)!;
  deliverNotes(save, out.notes, input);
  if (out.effect === "list") {
    const plan = listingPlanFor(save, talk.playerId);
    const listed = plan && !plan.error ? listPlayerFlow(save, talk.playerId, plan.value) : null;
    if (listed && !listed.error) save = listed.save;
    else noteListingLater(save, talk.playerId);
  } else if (out.effect) {
    save = applyEffect(save, out.effect);
  }
  return { save };
}

/** rc9 (R216): what a yes changes outside the locker room. Each one is a no-op when its moment has passed. */
function applyEffect(save: CareerSave, effect: Exclude<LockerEffect, "list">): CareerSave {
  if (effect.kind === "load") {
    // His tweak in the running package, until the block ends (the next package starts clean).
    const pkg = save.training?.plan?.package;
    if (!pkg || !save.squad.some((p) => p.id === effect.playerId)) return save;
    const tweak = { ...(pkg.tweaks?.[effect.playerId] ?? {}) };
    if (tweak.rest && effect.workload === "light") return save;
    delete tweak.rest;
    tweak.workload = effect.workload;
    pkg.tweaks = { ...(pkg.tweaks ?? {}), [effect.playerId]: tweak };
    return save;
  }
  if (effect.kind === "enterSide") {
    const offer = save.unofficialOffer;
    const entered = save.pendingEventDef;
    const def = entered?.id === effect.eventId ? entered : offer?.id === effect.eventId && !entered ? offer : null;
    if (!def?.teamSize || save.activeEvent) return save;
    const rest = communityParticipantsFor(save, def).filter((id) => id !== effect.playerId);
    const participantIds = [effect.playerId, ...rest].slice(0, def.teamSize);
    save.pendingEventDef = { ...def, participantIds };
    if (offer?.id === effect.eventId) save.unofficialOffer = { ...offer, participantIds };
    return save;
  }
  // startSub: him in the starter's seat, for the coming event only.
  if (save.activeEvent || save.pendingEventDef?.id !== effect.eventId) return save;
  if (!save.starterIds.includes(effect.outId as never) || save.starterIds.includes(effect.inId as never)) return save;
  const ids = save.starterIds.map((id) => (id === effect.outId ? effect.inId : id)) as [string, string, string];
  const r = setStartersFlow(save, ids);
  return r.error ? save : r.save;
}

/** rc9 (R216): the regional is over: the starter takes his seat back (when the lineup still has the reserve in it). */
function swapBack(next: CareerSave, inId: string, outId: string): void {
  if (!next.starterIds.includes(inId as never) || next.starterIds.includes(outId as never) || !next.squad.some((p) => p.id === outId)) return;
  const ids = next.starterIds.map((id) => (id === inId ? outId : id)) as [string, string, string];
  const r = setStartersFlow(next, ids);
  if (r.error) return;
  next.starterIds = r.save.starterIds;
  next.squad = r.save.squad;
}

// ---------------------------------------------------------------------------
// Notes → mail
// ---------------------------------------------------------------------------

function nameOf(id: string, save: CareerSave, prev: CareerSave): string {
  return save.squad.find((p) => p.id === id)?.name ?? prev.squad.find((p) => p.id === id)?.name ?? id;
}

function deliverNotes(save: CareerSave, notes: LockerNote[], prev: CareerSave): void {
  if (notes.length === 0) return;
  save.mail = [...save.mail];
  for (const n of notes) {
    if (n.kind === "talk") {
      deliverMail(save, {
        kind: "club",
        titleKey: `lockerTalk_${n.topic}`,
        bodyKey: `lockerTalk_${n.topic}_${n.variant}`,
        params: { ...(n.params ?? {}), player: nameOf(n.playerId, save, prev), talkId: n.talkId, n: L.benchRunTalk, need: L.promise.minutesNeed, of: L.promise.minutesOf },
        fromKey: "staff",
      });
    } else if (n.kind === "talkAuto") {
      deliverMail(save, {
        kind: "club",
        titleKey: "lockerTalkAuto",
        params: { player: nameOf(n.playerId, save, prev), talkId: n.talkId, answer: n.answer, topic: n.topic },
        fromKey: "staff",
      });
    } else if (n.kind === "promiseKept" || n.kind === "promiseBroken") {
      deliverMail(save, {
        kind: "club",
        titleKey: n.kind === "promiseKept" ? "lockerPromiseKept" : "lockerPromiseBroken",
        bodyKey: `${n.kind === "promiseKept" ? "lockerPromiseKept" : "lockerPromiseBroken"}_${n.promise}`,
        params: { player: nameOf(n.playerId, save, prev), inherited: n.inherited ? 1 : 0, need: L.promise.minutesNeed, of: L.promise.minutesOf },
        fromKey: "staff",
      });
    } else if (n.kind === "swapBack") {
      deliverMail(save, {
        kind: "club",
        titleKey: "lockerSwapBack",
        bodyKey: "lockerSwapBack",
        params: { player: nameOf(n.outId, save, prev), sub: nameOf(n.inId, save, prev) },
        fromKey: "staff",
      });
    } else if (n.kind === "mood") {
      // One mail per reason: who changed mood, to which mood, and why.
      const changes = n.changes.map((c) => `${nameOf(c.playerId, save, prev)}~${c.mood}`).join("|");
      deliverMail(save, {
        kind: "club",
        titleKey: "lockerMood",
        params: { event: `mood:${n.reason}:${save.seq + 1}`, reason: n.reason, changes, count: n.changes.length },
        fromKey: "staff",
      });
    }
  }
}

function noteListingLater(save: CareerSave, playerId: string): void {
  deliverMail(save, {
    kind: "club",
    titleKey: "lockerListLater",
    params: { player: nameOf(playerId, save, save) },
    fromKey: "staff",
    linkTo: "/career/market",
  });
}
