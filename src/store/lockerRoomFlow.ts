/**
 * Road to Worlds — the locker room's store side (v2.3 LOCKER, wave 1).
 *
 * The career store calls `lockerRoomAfter(prev, next)` once per write (its
 * `withSave` / `withResult`, marked `// v2.3 LOCKER`). The facts of the write
 * are read from the two saves, so no career flow changes:
 *   - the weekly tick: the Mondays the clock crossed;
 *   - a series settled: a new result in `eventResults` the club played (its
 *     lineup: the event's `fieldedIds`, else the starters);
 *   - a player listed (a new `transferList` entry) or sold (gone from the
 *     squad with a fresh `soldOn` entry);
 *   - an AI bid refused: an incoming bid gone the same day, the player still here;
 *   - a talk answered: `answerLockerTalkFlow`, the store's `answerLockerTalk`.
 * `engine/career/lockerRoom.ts` applies them; the notes become mail.
 *
 * FEATURES.lockerRoom off: nothing runs and nothing is written. On, the save
 * gets `lockerRoom` at its first fact (in practice its first Monday).
 */

import { CAREER_LOCKER as L, FEATURES } from "@/config/balance";
import { weekOfDay } from "@/engine/career/calendar";
import { deliverMail } from "@/engine/career/communications";
import {
  answerLockerTalk,
  emptyLockerRoom,
  lockerStep,
  type LockerNote,
  type LockerStepInput,
  type TalkAnswer,
} from "@/engine/career/lockerRoom";
import type { CareerSave } from "@/engine/career/types";
import { listPlayerFlow, listingPlanFor, type FlowResult } from "./careerFlow";

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
    if (def?.teamSize) continue; // a 1v1 / 2v2 side event is not the club's lineup
    events.push({ eventId: r.eventId, tier: r.tier, placement: r.userPlacement, lineup: active?.fieldedIds ?? [...prev.starterIds] });
  }

  const weeks = Math.max(0, absWeek(next.clock) - absWeek(prev.clock));
  const due = Boolean(next.lockerRoom && (next.lockerRoom.promises.length > 0 || next.lockerRoom.talks.some((t) => t.answer === undefined)));
  if (!departed.length && !listed.length && !bidsRefused.length && !events.length && !weeks && !due) return null;
  return {
    clock: { seasonIndex: next.clock.seasonIndex, day: next.clock.day },
    careerSeed: next.careerSeed,
    squad: next.squad.map((p) => ({ id: p.id, overall: p.overall })),
    departed,
    listed,
    bidsRefused,
    events,
    weeks,
  };
}

/**
 * The store's hook: apply one write's facts to `next` in place (its
 * `lockerRoom` and its mail). Never throws into gameplay: a failure leaves
 * `next` as the flow made it.
 */
export function lockerRoomAfter(prev: CareerSave, next: CareerSave): void {
  if (!FEATURES.lockerRoom || prev === next || next.proHost || next.phase === "ended") return;
  try {
    const facts = lockerFactsOf(prev, next);
    if (!facts) return;
    const { state, notes } = lockerStep(next.lockerRoom ?? emptyLockerRoom(), facts);
    next.lockerRoom = state;
    deliverNotes(next, notes, prev);
  } catch (error) {
    console.error("[career] locker room step failed; skipped", error);
  }
}

/**
 * L3: the manager answers a talk from the inbox. "sell" (an agreed sale) also
 * puts him on the transfer list at his value when a window is open; when it
 * is closed the mail says so and the listing is the manager's to make.
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
  }
  return { save };
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
    const player = n.kind === "mood" ? undefined : nameOf(n.playerId, save, prev);
    if (n.kind === "talk") {
      deliverMail(save, {
        kind: "club",
        titleKey: `lockerTalk_${n.topic}`,
        bodyKey: `lockerTalk_${n.topic}_${n.variant}`,
        params: { player: player!, talkId: n.talkId, n: L.benchRunTalk, need: L.promise.minutesNeed, of: L.promise.minutesOf },
        fromKey: "staff",
      });
    } else if (n.kind === "talkAuto") {
      deliverMail(save, {
        kind: "club",
        titleKey: "lockerTalkAuto",
        params: { player: player!, talkId: n.talkId, answer: n.answer, topic: n.topic },
        fromKey: "staff",
      });
    } else if (n.kind === "promiseKept" || n.kind === "promiseBroken") {
      deliverMail(save, {
        kind: "club",
        titleKey: n.kind === "promiseKept" ? "lockerPromiseKept" : "lockerPromiseBroken",
        bodyKey: `${n.kind === "promiseKept" ? "lockerPromiseKept" : "lockerPromiseBroken"}_${n.promise}`,
        params: { player: player!, inherited: n.inherited ? 1 : 0, need: L.promise.minutesNeed, of: L.promise.minutesOf },
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
