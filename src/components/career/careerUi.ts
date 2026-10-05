"use client";

/**
 * Road to Worlds — shared UI helpers (read-side view-models over the save).
 *
 * Screen components import from HERE (never from engine internals directly)
 * so the UI stays a thin skin: derived rows, labels, and wrapped selectors.
 * v0.2: day-clock aware (dates, week agenda, next-stop preview) + gear ladder.
 */

import {
  CAREER_CALENDAR,
  CAREER_GEAR,
  CAREER_SCOUT,
  CAREER_SCRIM,
  CAREER_SPONSOR,
  CAREER_TRAINING,
  CAREER_UNLOCKS,
} from "@/config/balance";
import {
  DAYS_PER_SEASON,
  dateOfDay,
  dayOfWeekOf,
  eventDayFor,
  isWindowStartWeek,
  isWindowWeek,
  seasonLabelFor,
  splitOfWeek,
  officialEventDefsForWeek,
  weekAt,
  weekOfDay,
  windowCloseDayFor,
  windowIndexOf,
  type CareerDate,
} from "@/engine/career/calendar";
import {
  bootcampTierFor,
  gearNextItem,
  gearPriceFor,
  gearTrainingBonus,
  repTierOf,
  unlocksFor,
} from "@/engine/career/economy";
import {
  ageOf,
  playerViewById,
  scoutedBand,
  statsFromView,
  trainingProjection,
  type ViewCtx,
} from "@/engine/career/development";
import { askPackageFor, contractedSplitsRemaining, listingFor } from "@/engine/career/market";
import { userStarsFor, userTeamFor } from "@/engine/career/worldSim";
import type {
  CareerEventDef,
  CareerPlayerView,
  CareerSave,
  PotentialBand,
  SquadPlayer,
} from "@/engine/career/types";
import type { Region, Stats, TournamentTeam } from "@/engine/types";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { nameOfRef, scrimOpponentFor } from "@/store/careerFlow";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** The active career save (null when none) — the one hook every screen uses. */
export function useCareerSave(): CareerSave | null {
  return useCareerStore(selectActiveSave);
}

// ---------------------------------------------------------------------------
// Clock & labels (v0.2 day clock)
// ---------------------------------------------------------------------------

export function clockLabel(save: CareerSave): {
  season: string;
  day: number;
  week: number;
  /** 1=Mon .. 7=Sun */
  dow: number;
  split: 1 | 2 | 3 | null;
  kind: string;
  windowOpen: boolean;
  date: CareerDate;
} {
  const day = save.clock.day;
  const week = weekOfDay(day);
  const cal = weekAt(week);
  return {
    season: seasonLabelFor(save.clock.seasonIndex),
    day,
    week,
    dow: dayOfWeekOf(day),
    split: splitOfWeek(week),
    kind: cal.kind,
    windowOpen: cal.windowOpen,
    date: dateOfDay(save.clock.seasonIndex, day),
  };
}

export {
  DAYS_PER_SEASON,
  dateOfDay,
  dayOfWeekOf,
  eventDayFor,
  isWindowStartWeek,
  isWindowWeek,
  seasonLabelFor,
  splitOfWeek,
  weekAt,
  weekOfDay,
  windowIndexOf,
};
export type { CareerDate };

// ---------------------------------------------------------------------------
// Schedule views (calendar / hub agenda)
// ---------------------------------------------------------------------------

export type DayKind =
  | "today"
  | "training"
  | "matchday"
  | "windowOpen"
  | "payday"
  | "scrim" // v0.3: a booked scrim runs on this day
  | "rest"
  | "idle";

export interface AgendaDay {
  day: number;
  date: CareerDate;
  dow: number;
  kinds: DayKind[];
  /** The user-relevant event on this day, when any. */
  event: CareerEventDef | null;
  isToday: boolean;
  isPast: boolean;
  windowOpen: boolean;
}

/** True when the def is one the user plays (own-region official or qualified). */
export function isUserEventDef(save: CareerSave, def: CareerEventDef): boolean {
  if (def.tier === "regional") return def.region === save.identity.region;
  if (def.tier === "major") return save.competition.majorFieldRefs?.includes("user") ?? false;
  if (def.tier === "worlds") return save.competition.worldsFieldRefs?.includes("user") ?? false;
  return true;
}

/** The user-relevant event def landing on `day`, if any (committed or scheduled). */
export function userEventOnDay(save: CareerSave, day: number): CareerEventDef | null {
  if (save.pendingEventDef?.day === day) return save.pendingEventDef;
  const week = weekOfDay(day);
  if (day !== eventDayFor(week)) return null;
  const defs = officialEventDefsForWeek(save.clock.seasonIndex, week);
  for (const def of defs) {
    if (def.tier === "regional" && def.region === save.identity.region) return def;
    if (def.tier === "major" || def.tier === "worlds") return def;
  }
  return null;
}

/** A day-by-day agenda strip: `count` days starting at `fromDay`. */
export function agendaDays(save: CareerSave, fromDay: number, count: number): AgendaDay[] {
  const out: AgendaDay[] = [];
  const today = save.clock.day;
  for (let day = fromDay; day < fromDay + count && day <= DAYS_PER_SEASON; day++) {
    const week = weekOfDay(day);
    const dow = dayOfWeekOf(day);
    const cal = weekAt(week);
    const event = userEventOnDay(save, day);
    const kinds: DayKind[] = [];
    if (event) kinds.push("matchday");
    if (dow === 1 && isWindowStartWeek(week)) kinds.push("windowOpen");
    if (dow === 1 && (week === 11 || week === 21 || week === CAREER_CALENDAR.worldsWindowWeek)) {
      kinds.push("payday");
    }
    // v0.3: booked scrims show as training events on the calendar.
    if (save.scheduledScrims?.some((s) => s.day === day)) kinds.push("scrim");
    if (!event && dow <= CAREER_TRAINING.trainingDaysPerWeek) kinds.push("training");
    if (dow === 7) kinds.push("rest");
    if (kinds.length === 0) kinds.push("idle");
    out.push({
      day,
      date: dateOfDay(save.clock.seasonIndex, day),
      dow,
      kinds,
      event,
      isToday: day === today,
      isPast: day < today,
      windowOpen: cal.windowOpen,
    });
  }
  return out;
}

export interface UpcomingStop {
  day: number;
  date: CareerDate;
  kind: "event" | "window" | "payday" | "seasonEnd";
  event: CareerEventDef | null;
  daysAway: number;
}

/** The next `count` meaningful stops ahead of the clock (hub / continue preview). */
export function upcomingStops(save: CareerSave, count: number): UpcomingStop[] {
  const out: UpcomingStop[] = [];
  const today = save.clock.day;
  for (let day = today; day <= DAYS_PER_SEASON && out.length < count; day++) {
    const week = weekOfDay(day);
    const dow = dayOfWeekOf(day);
    const event = userEventOnDay(save, day);
    if (event && (day > today || save.pendingEventDef?.day === day)) {
      out.push({
        day,
        date: dateOfDay(save.clock.seasonIndex, day),
        kind: "event",
        event,
        daysAway: day - today,
      });
      continue;
    }
    if (day > today && dow === 1 && isWindowStartWeek(week)) {
      out.push({
        day,
        date: dateOfDay(save.clock.seasonIndex, day),
        kind: "window",
        event: null,
        daysAway: day - today,
      });
    }
  }
  if (out.length < count) {
    out.push({
      day: DAYS_PER_SEASON,
      date: dateOfDay(save.clock.seasonIndex, DAYS_PER_SEASON),
      kind: "seasonEnd",
      event: null,
      daysAway: DAYS_PER_SEASON - today,
    });
  }
  return out;
}

export function daysUntilWindowCloses(save: CareerSave): number | null {
  const week = weekOfDay(save.clock.day);
  const idx = windowIndexOf(week);
  if (idx === null) return null;
  return Math.max(0, windowCloseDayFor(idx) - save.clock.day);
}

// ---------------------------------------------------------------------------
// Players & potential bands (spoiler-safe)
// ---------------------------------------------------------------------------

export function viewCtxOf(save: CareerSave): ViewCtx {
  return {
    careerSeed: save.careerSeed,
    seasonIndex: save.clock.seasonIndex,
    world: save.world,
  };
}

export function squadAge(save: CareerSave, p: SquadPlayer): number {
  return ageOf(p.birthYear, save.clock.seasonIndex);
}

export function potBandOfSquad(save: CareerSave, p: SquadPlayer): PotentialBand {
  return scoutedBand(p.potential, p.overall, p.scoutLevel, save.careerSeed, p.id);
}

export function potBandOfView(save: CareerSave, view: CareerPlayerView): PotentialBand {
  const paid = Number(save.scouted[view.id] ?? 0);
  const level = Math.min(CAREER_SCOUT.reportMaxLevel, Math.max(0, paid)) as 0 | 1 | 2 | 3;
  return scoutedBand(view.potential, view.overall, level, save.careerSeed, view.id);
}

export function statsOfSquad(p: SquadPlayer): Stats {
  return statsFromView(p);
}

export function agePhase(save: CareerSave, p: SquadPlayer): "growing" | "prime" | "declining" {
  const age = squadAge(save, p);
  if (age <= 20) return "growing";
  if (age <= 22) return "prime";
  return "declining";
}

/** Truthful training projection straight from the engine (no UI math). */
export function squadTrainingProjection(
  save: CareerSave,
  p: SquadPlayer,
): { weeklyOverall: number; weeklyOffset: number } {
  return trainingProjection(p, {
    seasonIndex: save.clock.seasonIndex,
    coachOverall: save.coach?.overall ?? null,
    gearBonus: gearTrainingBonus(save.finances.gear),
    trainingWeekBonus: false,
  });
}

export { ageOf, playerViewById, statsFromView };
export { askPackageFor, contractedSplitsRemaining, listingFor };

// ---------------------------------------------------------------------------
// Team preview (rating + chemistry for the fielded trio)
// ---------------------------------------------------------------------------

export function userTeamPreview(save: CareerSave): TournamentTeam {
  return userTeamFor({
    identity: save.identity,
    squad: save.squad,
    starterIds: save.starterIds,
    coach: save.coach,
    gear: save.finances.gear,
    bootcampSharp: save.finances.bootcampSharp,
    seasonIndex: save.clock.seasonIndex,
    careerSeed: save.careerSeed,
    difficulty: save.difficulty,
    unavailablePlayerId: null,
  }).team;
}

/** The user org's star read (0-5, half steps) — world-percentile based. */
export function userStars(save: CareerSave): number {
  const team = userTeamPreview(save);
  return userStarsFor({
    userRating: team.rating.total,
    world: save.world,
    repTier: repTierOf(save.reputation),
  });
}

// ---------------------------------------------------------------------------
// Scrims (v0.2 daily action)
// ---------------------------------------------------------------------------

export function scrimAvailability(save: CareerSave): {
  available: boolean;
  remaining: number;
  opponentName: string | null;
  reason: "ok" | "restDay" | "used" | "event" | "blocked";
} {
  const dow = dayOfWeekOf(save.clock.day);
  const remaining = Math.max(0, CAREER_SCRIM.maxPerWeek - save.scrimsThisWeek);
  if (save.phase !== "running" || save.activeEvent) {
    return { available: false, remaining, opponentName: null, reason: "blocked" };
  }
  if (save.pendingEventDef && save.clock.day === save.pendingEventDef.day) {
    return { available: false, remaining, opponentName: null, reason: "event" };
  }
  if (dow > CAREER_TRAINING.trainingDaysPerWeek) {
    return { available: false, remaining, opponentName: null, reason: "restDay" };
  }
  if (remaining <= 0) {
    return { available: false, remaining, opponentName: null, reason: "used" };
  }
  const opponent = scrimOpponentFor(save);
  return {
    available: opponent !== null,
    remaining,
    opponentName: opponent?.name ?? null,
    reason: "ok",
  };
}

// ---------------------------------------------------------------------------
// Standings rows
// ---------------------------------------------------------------------------

export interface StandingsRow {
  ref: string;
  name: string;
  points: number;
  isUser: boolean;
  stars: number;
  rank: number;
}

export function standingsRows(
  save: CareerSave,
  region: Region,
  kind: "split" | "season",
): StandingsRow[] {
  const table =
    kind === "split" ? save.competition.splitPoints[region] : save.competition.seasonPoints[region];
  const rows = Object.entries(table ?? {}).map(([ref, points]) => ({
    ref,
    name: nameOfRef(save, ref),
    points,
    isUser: ref === "user",
    stars: save.world.orgs[ref]?.stars ?? 0,
  }));
  // Ensure the user row exists even before any points land.
  if (region === save.identity.region && !rows.some((r) => r.isUser)) {
    rows.push({ ref: "user", name: save.identity.orgName, points: 0, isUser: true, stars: 0 });
  }
  rows.sort((a, b) => b.points - a.points);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Qualification cut-line size for a region (Major/Worlds slot table). */
export { CAREER_SLOTS } from "@/config/balance";

// ---------------------------------------------------------------------------
// Progression track (v0.2 gear ladder — what's ahead is always visible)
// ---------------------------------------------------------------------------

export interface UnlockEntry {
  key: string;
  gate: number;
  unlocked: boolean;
  /** Owned = bought/active (gear items), vs merely rep-unlocked. */
  owned?: boolean;
  future?: boolean;
}

export function unlockTrack(save: CareerSave): UnlockEntry[] {
  const u = unlocksFor(save.reputation);
  const gear = save.finances.gear;
  const gearEntries: UnlockEntry[] = CAREER_GEAR.items.map((item) => ({
    key: item.id,
    gate: item.repGate,
    unlocked: u[item.id],
    owned: gear[item.id],
  }));
  return [
    ...gearEntries,
    {
      key: "bootcamp1",
      gate: CAREER_GEAR.bootcamp[0].repGate,
      unlocked: u.bootcamp1,
      owned: bootcampTierFor(save.reputation) >= 1,
    },
    {
      key: "bootcamp2",
      gate: CAREER_GEAR.bootcamp[1].repGate,
      unlocked: u.bootcamp2,
      owned: bootcampTierFor(save.reputation) >= 2,
    },
    {
      key: "psychologist",
      gate: CAREER_GEAR.psychologistRep,
      unlocked: u.psychologist,
      owned: gear.psychologist,
    },
    { key: "t2", gate: CAREER_UNLOCKS.t2InvitationalRep, unlocked: u.t2 },
    {
      key: "sponsorT2",
      gate: CAREER_SPONSOR.tiers[1].repGate,
      unlocked: save.reputation >= CAREER_SPONSOR.tiers[1].repGate,
    },
    {
      key: "sponsorT3",
      gate: CAREER_SPONSOR.tiers[2].repGate,
      unlocked: save.reputation >= CAREER_SPONSOR.tiers[2].repGate,
    },
    {
      key: "sponsorT4",
      gate: CAREER_SPONSOR.tiers[3].repGate,
      unlocked: save.reputation >= CAREER_SPONSOR.tiers[3].repGate,
    },
    { key: "relocation", gate: CAREER_UNLOCKS.relocationRep, unlocked: false, future: true },
  ];
}

export { bootcampTierFor, gearNextItem, gearPriceFor, gearTrainingBonus, repTierOf, unlocksFor };
export { CAREER_GEAR };

// ---------------------------------------------------------------------------
// Continue: where does the primary button go / what does it say?
// ---------------------------------------------------------------------------

export type ContinueKind =
  | "event" // an event awaits (lobby or in progress) → /career/event
  | "seasonReview" // → /career/season
  | "ended" // → /career/season (legacy screen)
  | "decision" // pending out-bid / sponsor choice on the hub
  | "advance"; // plain advance

export function continueKind(save: CareerSave): ContinueKind {
  if (save.phase === "ended") return "ended";
  if (save.phase === "seasonReview") return "seasonReview";
  if (save.activeEvent) return "event";
  if (save.pendingEventDef && save.clock.day === save.pendingEventDef.day) return "event";
  if (save.pendingOffers.some((o) => o.status === "pending" && o.direction === "out")) {
    return "decision";
  }
  if (save.sponsorOffers && save.sponsorOffers.length > 0) {
    return "decision";
  }
  return "advance";
}

export { nameOfRef };
