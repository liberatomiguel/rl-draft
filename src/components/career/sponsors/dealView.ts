/**
 * Road to Worlds — the sponsor deals' view model (rc.34, ECO-04,
 * SPONSOR-CONTRACT S5). Pure: every figure the comparison card and the
 * Finances desk print comes from the engine (`sponsorDeals`) and the flow
 * (`sponsorGoalProgressOf`), read here once so the card, HQ and the desk
 * cannot disagree with the ledger.
 */

import { CAREER_CALENDAR, CAREER_SPONSOR } from "@/config/balance";
import { dateOfDay, firstDayOfWeek, type CareerDate } from "@/engine/career/calendar";
import {
  fineMaxOf,
  mondaysBetween,
  goalDeadlineOf,
  goalForSlot,
  mondaysLeftOf,
  slotOf,
  slotsOfDeal,
  splitStartDayOf,
  sureMoneyOf,
  upToMoneyOf,
  type CareerDay,
  type GoalProgress,
} from "@/engine/career/sponsorDeals";
import { periodOfWeek, sponsorFineDueOf } from "@/engine/career/economy";
import { weekOfDay } from "@/engine/career/calendar";
import type {
  CareerSave,
  SponsorFineState,
  SponsorGoal,
  SponsorProfile,
  SponsorState,
} from "@/engine/career/types";
import { sponsorGoalProgressOf } from "@/store/careerFlow";

/** What the Risk row says. */
export type DealRisk =
  | { kind: "steady"; misses: number }
  | { kind: "fine"; max: number; mondays: number }
  | { kind: "none" };

/** One offer's five rows, from today. */
export interface OfferView {
  sponsorId: string;
  tier: 1 | 2 | 3 | 4;
  profile: SponsorProfile;
  weekly: number;
  fixed: number;
  fixedKind: "signing" | "milestone";
  /** Sure from today: the weekly pay on the Mondays left + the signing payment. */
  sure: number;
  /** The most it can pay from today. */
  upTo: number;
  /** Comparable return: maximum total divided by remaining payment weeks. */
  upToPerWeek: number;
  /** The Stability bar: the share of `upTo` that is sure (0–100, and in tenths 0–10). */
  stabilityPct: number;
  stabilityTenths: number;
  lengthSplits: number;
  endsOn: CareerDate;
  risk: DealRisk;
  /** The first split's goal and the day its last counting event ends. */
  goal: SponsorGoal | null;
  goalBy: CareerDate | null;
  /** More splits follow (a new goal each). */
  laterGoals: boolean;
  /** rc.35 (front S): the bonus per goal and the most a miss is fined (0 = none). */
  bonus: number;
  fineMax: number;
  /** The goal's difficulty on the meter: 1 Likely, 2 Even, 3 Stretch. */
  difficulty: 1 | 2 | 3;
  /** A global sponsor (the ladder's last level). */
  global: boolean;
}

const DIFFICULTY: Record<string, 1 | 2 | 3> = { likely: 1, even: 2, stretch: 3 };

function dateOf(d: CareerDay): CareerDate {
  return dateOfDay(d.seasonIndex, d.day);
}

/** The first Monday strictly after `today` (a season's day 1 is a Monday). */
function nextMondayOf(today: CareerDay): CareerDay {
  const days = CAREER_CALENDAR.weeksPerSeason * CAREER_CALENDAR.daysPerWeek;
  const next = firstDayOfWeek(weekOfDay(today.day) + 1);
  return next > days ? { seasonIndex: today.seasonIndex + 1, day: 1 } : { seasonIndex: today.seasonIndex, day: next };
}

function riskOf(state: SponsorState): DealRisk {
  const terms = state.terms!;
  const max = fineMaxOf(terms, state.bonus);
  if (max > 0) return { kind: "fine", max, mondays: Math.max(1, CAREER_SPONSOR.fines.spreadMondays) };
  if (terms.profile === "steady") return { kind: "steady", misses: CAREER_SPONSOR.patienceMisses };
  return { kind: "none" };
}

/** An rc.34 offer as the comparison card reads it (null for an offer from before rc.34). */
export function offerViewOf(offer: SponsorState, today: CareerDay): OfferView | null {
  const terms = offer.terms;
  if (!terms) return null;
  const sure = sureMoneyOf(terms, today);
  const upTo = upToMoneyOf(offer, today);
  const share = upTo > 0 ? sure / upTo : 1;
  const goal = terms.goals[0] ?? null;
  return {
    sponsorId: offer.sponsorId,
    tier: offer.tier,
    profile: terms.profile,
    weekly: terms.weekly,
    fixed: terms.fixed,
    fixedKind: terms.fixedKind,
    sure,
    upTo,
    upToPerWeek: upTo / Math.max(1, mondaysLeftOf(terms, today)),
    stabilityPct: Math.round(share * 100),
    stabilityTenths: Math.max(0, Math.min(10, Math.round(share * 10))),
    lengthSplits: terms.lengthSplits,
    endsOn: dateOf(terms.endsOn),
    risk: riskOf(offer),
    goal,
    goalBy: goal ? dateOf(goalDeadlineOf(goal)) : null,
    laterGoals: terms.lengthSplits > 1,
    bonus: offer.bonus,
    fineMax: fineMaxOf(terms, offer.bonus),
    difficulty: DIFFICULTY[goal?.word ?? terms.word] ?? 2,
    global: Boolean(terms.global),
  };
}

/** The running deal as the Finances desk reads it. */
export interface DealView extends OfferView {
  /** The goal of the split in progress (or the next one, in a window), with its progress. */
  current: { goal: SponsorGoal; progress: GoalProgress; by: CareerDate } | null;
  /** When the next goal is set (a split's first Monday), if the deal runs on and it is not set yet. */
  nextGoalOn: CareerDate | null;
  hits: number;
  misses: number;
  fixedPaid: boolean;
  /** Steady deals: the patience meter (misses so far). */
  patienceMisses: number | null;
  mondaysLeft: number;
  /** rc.35 (front S): the next Monday it pays (null once the last is paid), and the Mondays it pays in all. */
  nextPayOn: CareerDate | null;
  mondaysTotal: number;
}

/** The split slot the clock is in for the deals (W1–W10 → split 1, W11–W20 → 2, W21–W32 → 3). */
function currentSlotOf(save: CareerSave): number {
  return slotOf(save.clock.seasonIndex, periodOfWeek(weekOfDay(save.clock.day)));
}

/** The running rc.34 deal on the Finances desk (null without one, or for a deal from before rc.34). */
export function dealViewOf(save: CareerSave): DealView | null {
  const state = save.sponsor;
  if (!state?.terms) return null;
  const today: CareerDay = { seasonIndex: save.clock.seasonIndex, day: save.clock.day };
  const base = offerViewOf(state, today)!;
  const terms = state.terms;
  const slots = slotsOfDeal(terms);
  const open = terms.goals.filter((g) => !g.hitOn && g.missed === undefined);
  // The goal to show: the earliest one not settled; else the latest set.
  const goal = open[0] ?? terms.goals[terms.goals.length - 1] ?? null;
  const nextSlot = slots.find((s) => s > currentSlotOf(save) && !goalForSlot(terms, s));
  const mondaysLeft = mondaysLeftOf(terms, today);
  return {
    ...base,
    current: goal ? { goal, progress: sponsorGoalProgressOf(save, goal), by: dateOf(goalDeadlineOf(goal)) } : null,
    nextGoalOn: nextSlot !== undefined ? dateOf(splitStartDayOf(nextSlot)) : null,
    hits: terms.goals.filter((g) => g.hitOn).length,
    misses: terms.goals.filter((g) => g.missed !== undefined).length,
    fixedPaid: Boolean(terms.fixedPaid),
    patienceMisses: terms.profile === "steady" ? state.missedCount : null,
    mondaysLeft,
    nextPayOn:
      mondaysLeft > 0 ? dateOf(nextMondayOf(today)) : null,
    mondaysTotal: Math.max(mondaysLeft, mondaysBetween(terms.offeredOn, terms.endsOn)),
  };
}

/** Fines still owed: the total and the Mondays left at their instalments. */
export function finesOwedOf(fines: readonly SponsorFineState[] | null | undefined): { total: number; mondays: number } {
  const list = fines ?? [];
  const total = list.reduce((n, f) => n + f.remaining, 0);
  const mondays = list.reduce((n, f) => Math.max(n, Math.ceil(f.remaining / Math.max(1, f.perMonday))), 0);
  return { total, mondays: total > 0 ? Math.max(mondays, sponsorFineDueOf(list) > 0 ? 1 : 0) : 0 };
}
