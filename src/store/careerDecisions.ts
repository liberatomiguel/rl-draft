/**
 * Road to Worlds — the decision queue (rc.34, ROADMAP UX-01a; HQ-CONTRACT H1,
 * Gate 3a decision 1-B).
 *
 * ONE ordered list of what the manager owes, read by everything that moves
 * the clock or shows what is due: `advanceDayFlow` refuses while an entry
 * holds (so the batched Advance, the autoplay, Championship Sunday's
 * continue and a reload all hold too — the hold is derived from the save),
 * `isStopState`, `continueKind` (the top bar), HQ's decision block and the
 * season's continue (`continueToNextSeasonFlow`).
 *
 * Each kind is one small adapter over the save. Three kinds come from other
 * fronts and are plugged in as SOURCES (`DecisionSourceItem`): DEV-03's
 * training proposal (`trainingDecisionSource`, front E), ECO-04's sponsor
 * choice (`sponsorDecisionSource`, front F) and the money notice to
 * acknowledge (`moneyNoticeSource`, front H). Point them at the fronts' own
 * functions; the queue, the hold, "Later" and the order need nothing else.
 *
 * Decision 1-B: bids and sponsor offers offer "Later" (CAREER_HQ.laterKinds)
 * up to their deadline day — parked, they stop holding until that day, when
 * the clock stops again and only an answer moves it (a bid: accept or
 * decline; offers: sign one or decline them). One due on the season's last
 * day holds the season review's continue instead (`rolloverHoldOf`; rc.34
 * review: the Worlds window's sponsor offers too). Every other needed decision
 * holds until answered, like the weekly insert. The order (urgent first):
 * today's matchday and the season review, the contract review, a short
 * squad, what is due today, then by deadline; parked ones last.
 */

import { CAREER_HQ, CAREER_SPONSOR } from "@/config/balance";
import type { CareerSave } from "@/engine/career/types";
import {
  isEventPaused,
  moneyNoticeOf,
  moneyNoticeRaisedToday,
  rolloverToNextSeason,
  sponsorDecisionOf,
  squadHoldFor,
  type FlowResult,
} from "./careerFlow";
import { trainingDecisionOf } from "./careerTraining";
import { followCardOf, sundayStopHolds, sundayWithoutYouOf } from "./careerSunday";

export type DecisionKind =
  | "event" // today's matchday, an event in progress, the Saturday pause (R40)
  | "sunday" // rc.36 (SUN-01): the Saturday evening before the user's Sunday — start it (an optional briefing)
  | "seasonReview" // the season review (and an ended career's legacy screen)
  | "notice" // a notice to acknowledge (front H's money notice): no deadline, no "Later"
  | "contractReview" // UX-06b: the explicit review before the rollover
  | "squadShort" // R67: under three players on the eve / day of an event
  | "insert" // R33: the weekly insert
  | "invite" // a fresh unofficial invite (not auto-entered)
  | "training" // DEV-03: the coach's period proposal (front E)
  | "bid" // an incoming bid for a squad player
  | "sponsor" // the sponsor offers (front F's deals replace rc.33's)
  | "follow"; // rc.36 (SUN-03): an event the user is out of — watch / results / skip (never holds)

/** A day of the save's calendar. */
export interface DecisionDate {
  seasonIndex: number;
  day: number;
}

export interface PendingDecision {
  kind: DecisionKind;
  /** Unique in the save while this decision stands (a new decision gets a new id). */
  id: string;
  /** The day the clock stops again for it, or null when it is due now. */
  deadline: DecisionDate | null;
  /** 1-B: "Later" is offered (a bid or a sponsor choice before its deadline day). */
  canWait: boolean;
  /** Parked with "Later": listed under the block, not holding the clock until its deadline day. */
  parked: boolean;
  /** The clock does not move while this stands. */
  holds: boolean;
}

/** What another front's flow reports: the decision it is waiting on, or null. */
export interface DecisionSourceItem {
  /** Stable while the same decision stands. */
  id: string;
  /** The last day it may be answered on; null / absent = due now. */
  deadline?: DecisionDate | null;
  /** rc.34: false = shown (and outranked) but not holding the clock today; absent = holds. */
  holds?: boolean;
}

// ---------------------------------------------------------------------------
// Sources from the other Etapa 3 fronts
// ---------------------------------------------------------------------------

/**
 * DEV-03 (front E): the coach's period proposal on Normal ("the coach
 * proposes"; delegated training proposes nothing). rc.33's weekly drill asks
 * nothing, so this reports none — the integrator points it at E's
 * `trainingDecisionOf(save)`. Kind "training": no "Later" (1-B).
 */
export function trainingDecisionSource(save: CareerSave): DecisionSourceItem | null {
  const d = trainingDecisionOf(save);
  return d ? { id: d.id, deadline: { seasonIndex: d.seasonIndex, day: d.deadlineDay } } : null;
}

/**
 * A notice the manager must acknowledge before the clock moves (front H: the
 * bank's emergency loan replacing the Backer exposes `moneyNoticeOf(save)` →
 * {id, kind, params} | null and `acknowledgeMoneyNoticeFlow`, and renders
 * the modal at the career shell). It holds from the Monday it fires — the
 * autoplay and the batched Advance stop there — until acknowledged; no
 * deadline, no "Later". rc.33 has no such notice: the integrator points this
 * at H's `moneyNoticeOf` (its `id` is all the queue needs).
 */
export function moneyNoticeSource(save: CareerSave): DecisionSourceItem | null {
  const notice = moneyNoticeOf(save);
  // Front H: the notice holds its own Monday (the batched Advance and the
  // autoplay stop there); the modal stays up until acknowledged.
  return notice ? { id: notice.id, holds: moneyNoticeRaisedToday(save) } : null;
}

/**
 * ECO-04 (front F): the sponsor choice — F's `sponsorDecisionOf(save)` (its
 * id and deadline: the Sunday before its first split's first event week,
 * never past the season's last day). "Later" parks it until that day.
 *
 * rc.34 review: a Worlds-window decision's deadline is the season's last day
 * (224), the day the season review opens — so it is reported in the review
 * too, where it holds the season's continue (`rolloverHoldOf`) until signed
 * or declined, as a bid on its last day does. The rollover never replaces a
 * parked decision unanswered.
 *
 * rc.36 (front S2, Miguel on rc.35: only "Decide later", no "No deal for
 * now"): CAREER_SPONSOR.deadlineRule "hold" keeps that — the deadline day
 * holds until a card is signed. "signSafest": from the deadline day it holds
 * nothing (the day after it signs the safest offer, `lapseSponsorOffers`).
 */
export function sponsorDecisionSource(save: CareerSave): DecisionSourceItem | null {
  if (save.phase !== "running" && save.phase !== "seasonReview") return null;
  const decision = sponsorDecisionOf(save);
  if (!decision) return null;
  const deadline = { seasonIndex: decision.deadlineOn.seasonIndex, day: decision.deadlineOn.day };
  const autoSigns = CAREER_SPONSOR.deadlineRule === "signSafest" && !isBefore(save.clock, deadline);
  return autoSigns ? { id: decision.id, deadline, holds: false } : { id: decision.id, deadline };
}

/**
 * The slots the other fronts plug into — one adapter each. The integrator
 * points them at E's `trainingDecisionOf`, F's `sponsorDecisionOf` and H's
 * `moneyNoticeOf` (only `id` and `deadline` are read). Tests swap an entry
 * to exercise a kind rc.33 cannot produce yet, and restore it.
 */
export const DECISION_SOURCES: {
  training: (save: CareerSave) => DecisionSourceItem | null;
  sponsor: (save: CareerSave) => DecisionSourceItem | null;
  notice: (save: CareerSave) => DecisionSourceItem | null;
} = {
  training: trainingDecisionSource,
  sponsor: sponsorDecisionSource,
  notice: moneyNoticeSource,
};

// ---------------------------------------------------------------------------
// The adapters (one per kind)
// ---------------------------------------------------------------------------

const isBefore = (a: DecisionDate, b: DecisionDate): boolean =>
  a.seasonIndex < b.seasonIndex || (a.seasonIndex === b.seasonIndex && a.day < b.day);

const laterKind = (kind: DecisionKind): boolean => CAREER_HQ.laterKinds.includes(kind);

/** A decision with a deadline: "Later" before its day (1-B kinds only), a hold on it (unless its source holds nothing today). */
function decisionFrom(kind: DecisionKind, item: DecisionSourceItem, save: CareerSave): PendingDecision {
  const deadline = item.deadline ?? null;
  const canWait = laterKind(kind) && save.phase === "running" && deadline !== null && isBefore(save.clock, deadline);
  const parked = canWait && (save.parkedDecisions ?? []).includes(item.id);
  return { kind, id: item.id, deadline, canWait, parked, holds: !parked && item.holds !== false };
}

/** A decision due now: no deadline, no "Later", it holds. */
function dueNow(kind: DecisionKind, id: string, holds = true): PendingDecision {
  return { kind, id, deadline: null, canWait: false, parked: false, holds };
}

/** R40: an event in progress (the Saturday pause waits for the clock to move — it does not hold) or today's matchday. */
function eventDecisionOf(save: CareerSave): PendingDecision | null {
  if (save.phase !== "running") return null;
  const active = save.activeEvent;
  // rc.36 (SUN-01): a paused Saturday not started yet is the "sunday" stop instead.
  if (active && isEventPaused(save) && sundayStopHolds(save)) return null;
  if (active) return dueNow("event", `event:${active.def.id}`, !isEventPaused(save));
  // R67: a short squad's matchday is the squad's decision first.
  if (squadHoldFor(save)) return null;
  const pending = save.pendingEventDef;
  // Every user matchday holds, a Community Cup's too: it is played, or passed explicitly.
  return pending && pending.day === save.clock.day ? dueNow("event", `event:${pending.id}`) : null;
}

/**
 * rc.36 (SUN-01, R88): Saturday evening after the user's Saturday (the
 * qualifier won; a Major / Worlds paused after its Swiss) — it holds until
 * Sunday is started from HQ (careerSunday.startSundayFlow records the
 * briefing and moves the clock one day). No "Later": its answer is the clock.
 */
function sundayDecisionOf(save: CareerSave): PendingDecision | null {
  if (save.phase !== "running" || !sundayStopHolds(save)) return null;
  const def = save.activeEvent?.def ?? save.pendingEventDef;
  return def ? dueNow("sunday", `sunday:${def.id}`) : null;
}

/**
 * rc.36 (SUN-03, R88): an event the user is out of — the eliminated
 * Saturday's "Sunday without you", or a followed event that resolved within
 * CAREER_SUNDAY.followCardDays. Never holds (its default is "skip"): HQ
 * shows it above the clock when nothing else is due.
 */
function followDecisionOf(save: CareerSave): PendingDecision | null {
  if (save.phase !== "running") return null;
  const out = sundayWithoutYouOf(save);
  if (out) return dueNow("follow", `follow:${out.def.id}`, false);
  const card = followCardOf(save);
  return card ? dueNow("follow", `follow:${card.def.id}`, false) : null;
}

function seasonDecisionOf(save: CareerSave): PendingDecision | null {
  if (save.phase === "seasonReview") return dueNow("seasonReview", `season:${save.clock.seasonIndex}`);
  if (save.phase === "ended") return dueNow("seasonReview", `ended:${save.clock.seasonIndex}`);
  return null;
}

/** UX-06b: the squad players whose contract ends with this season — they leave at the rollover. */
export function leavingAtRolloverOf(save: CareerSave): CareerSave["squad"] {
  return save.squad.filter((p) => p.contractEndSeason <= save.clock.seasonIndex);
}

/** UX-06b: the save flag the explicit contract review sets for a season. */
export function contractReviewFlagFor(seasonIndex: number): string {
  return `contractsReviewed:${seasonIndex}`;
}

function contractReviewDecisionOf(save: CareerSave): PendingDecision | null {
  if (save.phase !== "seasonReview") return null;
  if (save.flags[contractReviewFlagFor(save.clock.seasonIndex)]) return null;
  return leavingAtRolloverOf(save).length > 0 ? dueNow("contractReview", `contracts:${save.clock.seasonIndex}`) : null;
}

function squadShortDecisionOf(save: CareerSave): PendingDecision | null {
  const def = squadHoldFor(save);
  return def ? dueNow("squadShort", `squad:${def.id}`) : null;
}

function insertDecisionOf(save: CareerSave): PendingDecision | null {
  const ins = save.pendingInsert;
  if (save.phase !== "running" || !ins || ins.day !== save.clock.day) return null;
  return dueNow("insert", `insert:${ins.id}:${save.clock.seasonIndex}:${ins.day}`);
}

/**
 * A fresh invite (not auto-entered): HQ shows it with Accept / Pass. rc.34
 * review (Gate 3b, "no repetitive weekly chore" — on Hard an invite held
 * every open Monday): it is NOT a needed decision, its default is "not
 * entered" — it never holds the clock; the batched Advance and the autoplay
 * stop on it once, the Monday it surfaces (careerFlow.inviteSurfacedToday);
 * walked past its matchday, it is passed. An accepted cup is the user's
 * matchday ("event"), which holds (Play, or Pass).
 */
function inviteDecisionOf(save: CareerSave): PendingDecision | null {
  const offer = save.unofficialOffer;
  if (save.phase !== "running" || save.activeEvent || save.pendingEventDef || !offer) return null;
  // Past its matchday it is passed (the next day's arrival clears it; an older save may still hold one).
  if (offer.seasonIndex !== save.clock.seasonIndex || offer.day < save.clock.day) return null;
  return dueNow("invite", `invite:${offer.id}`, false);
}

function bidDecisionsOf(save: CareerSave): PendingDecision[] {
  if (save.phase === "ended") return [];
  return save.pendingOffers
    .filter((o) => o.status === "pending" && o.direction === "out")
    .map((o) => decisionFrom("bid", { id: o.id, deadline: { seasonIndex: o.resolveSeason, day: o.resolveDay } }, save));
}

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

const KIND_ORDER: DecisionKind[] = [
  "event",
  "sunday",
  "seasonReview",
  "notice",
  "contractReview",
  "squadShort",
  "insert",
  "invite",
  "training",
  "bid",
  "sponsor",
  "follow",
];

/**
 * Urgent first: 0 a matchday / event in progress and the season review ·
 * 1 a notice to acknowledge · 2 the contract review · 3 a short squad ·
 * 4 what is due today (an insert, an invite, a proposal, a bid or offers on
 * their deadline day) · 5 what can still wait, by deadline · 6 the Saturday
 * pause (its answer moves the clock, so it waits for every hold) · 7 parked,
 * by deadline. rc.36: the Saturday-evening stop sits with the pause (6), and
 * following an event the user is out of comes last (8).
 */
function groupOf(d: PendingDecision): number {
  if (d.kind === "event") return d.holds ? 0 : 6;
  if (d.kind === "sunday") return 6;
  if (d.kind === "follow") return 8;
  if (d.kind === "seasonReview") return 0;
  if (d.kind === "notice") return 1;
  if (d.kind === "contractReview") return 2;
  if (d.kind === "squadShort") return 3;
  if (d.parked) return 7;
  return d.canWait ? 5 : 4;
}

function compareDecisions(a: PendingDecision, b: PendingDecision): number {
  const g = groupOf(a) - groupOf(b);
  if (g !== 0) return g;
  if (a.deadline && b.deadline && (a.deadline.seasonIndex !== b.deadline.seasonIndex || a.deadline.day !== b.deadline.day)) {
    return isBefore(a.deadline, b.deadline) ? -1 : 1;
  }
  if (Boolean(a.deadline) !== Boolean(b.deadline)) return a.deadline ? 1 : -1;
  const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  return k !== 0 ? k : a.id.localeCompare(b.id);
}

/** Every decision the manager owes on this save, urgent first. */
export function pendingDecisionsOf(save: CareerSave): PendingDecision[] {
  const out: PendingDecision[] = [];
  const push = (d: PendingDecision | null) => {
    if (d) out.push(d);
  };
  push(eventDecisionOf(save));
  push(sundayDecisionOf(save));
  push(seasonDecisionOf(save));
  const notice = save.phase === "ended" ? null : DECISION_SOURCES.notice(save);
  if (notice) out.push(dueNow("notice", notice.id, notice.holds ?? true));
  push(contractReviewDecisionOf(save));
  push(squadShortDecisionOf(save));
  push(insertDecisionOf(save));
  push(inviteDecisionOf(save));
  const training = save.phase === "running" ? DECISION_SOURCES.training(save) : null;
  if (training) out.push(decisionFrom("training", training, save));
  out.push(...bidDecisionsOf(save));
  const sponsor = DECISION_SOURCES.sponsor(save);
  if (sponsor) out.push(decisionFrom("sponsor", sponsor, save));
  push(followDecisionOf(save));
  return out.sort(compareDecisions);
}

/** The decision holding the clock today (advanceDayFlow refuses while one exists), or null. */
export function clockHoldOf(save: CareerSave): PendingDecision | null {
  return pendingDecisionsOf(save).find((d) => d.holds) ?? null;
}

/** HQ's top block: the first decision not parked (the Saturday pause included), or null for the clock. */
export function topDecisionOf(save: CareerSave): PendingDecision | null {
  return pendingDecisionsOf(save).find((d) => !d.parked) ?? null;
}

/** What still holds the season's continue (the rollover): the season review itself aside. */
export function rolloverHoldOf(save: CareerSave): PendingDecision | null {
  if (save.phase !== "seasonReview") return null;
  return pendingDecisionsOf(save).find((d) => d.holds && d.kind !== "seasonReview") ?? null;
}

// ---------------------------------------------------------------------------
// The answers the queue adds
// ---------------------------------------------------------------------------

/**
 * 1-B "Later": park a bid or the sponsor offers until their deadline day.
 * Refused for any other kind and on the deadline day itself ("cannotWait").
 */
export function parkDecisionFlow(input: CareerSave, id: string): FlowResult {
  const queue = pendingDecisionsOf(input);
  const d = queue.find((x) => x.id === id);
  if (!d) return { save: input, error: "unknown" };
  if (!d.canWait) return { save: input, error: "cannotWait" };
  if (d.parked) return { save: input };
  const save = structuredClone(input);
  const live = new Set(queue.map((x) => x.id));
  save.parkedDecisions = [...(input.parkedDecisions ?? []).filter((x) => live.has(x)), id];
  return { save };
}

/**
 * The sponsor offers' answer besides signing: no deal for now — the Monday
 * of the next split boundary offers again (`maybeOfferSponsors`; after the
 * Worlds window, the rollover — one tier lower still when this was a
 * demoted renewal, `sponsorDemotedSlot`). Allowed any day, the deadline day
 * too, and in the season review (rc.34 review: a Worlds-window decision
 * holds the rollover there until answered). rc.36 (front S2, Miguel on
 * rc.35): HQ no longer offers it ("Decide later" only); kept for the tests'
 * clock walker and the store's API.
 */
export function declineSponsorOffersFlow(input: CareerSave): FlowResult {
  if ((input.phase !== "running" && input.phase !== "seasonReview") || !input.sponsorOffers?.length) {
    return { save: input, error: "none" };
  }
  const save = structuredClone(input);
  save.sponsorOffers = null;
  return { save };
}

/**
 * UX-06b: the explicit review before the rollover — the manager has seen who
 * leaves (`leavingAtRolloverOf`) and lets them go; renewing one first takes
 * him off the list. Only in the season review.
 */
export function reviewContractsFlow(input: CareerSave): FlowResult {
  if (input.phase !== "seasonReview") return { save: input, error: "none" };
  const flag = contractReviewFlagFor(input.clock.seasonIndex);
  if (input.flags[flag]) return { save: input };
  const save = structuredClone(input);
  save.flags[flag] = true;
  return { save };
}

/**
 * The season's continue (the store's `continueToNextSeason`, "Defend the
 * title"): refused while a decision still holds — the contract review, a bid
 * on its last day — so the rollover never passes one. `rolloverToNextSeason`
 * stays the engine step it calls (tests and the measuring bot call it after
 * answering).
 */
export function continueToNextSeasonFlow(input: CareerSave): FlowResult {
  if (rolloverHoldOf(input)) return { save: input, error: "decisionPending" };
  return { save: rolloverToNextSeason(input) };
}
