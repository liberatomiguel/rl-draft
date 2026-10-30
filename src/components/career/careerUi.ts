"use client";

/**
 * Road to Worlds — shared UI helpers (read-side view-models over the save).
 *
 * Screen components import from HERE (never from engine internals directly)
 * so the UI stays a thin skin: derived rows, labels, and wrapped selectors.
 * v0.2: day-clock aware (dates, week agenda, next-stop preview) + gear ladder.
 */

import {
  CAREER_GEAR,
  CAREER_PRIZES,
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
  nextPaydayFor,
  repTierOf,
  runwayWeeks,
  unlocksFor,
  weeklyStatement,
  weeklyWage,
} from "@/engine/career/economy";
import type { CareerCopy } from "@/content/careerCopy";
import { formatMoney } from "@/lib/format";
import {
  ageOf,
  exactAgeOf,
  growthCtxOf,
  growthModelOf,
  phaseTagFor,
  playerViewById,
  scoutedBand,
  type PhaseTag,
  statsFromView,
  trainingEta,
  trainingProjection,
  type ViewCtx,
} from "@/engine/career/development";
import { askPackageFor, contractedSplitsRemaining, listingFor } from "@/engine/career/market";
import { localRegionOf } from "@/engine/career/localScene";
import {
  raceLineOf,
  raceTableFor,
  type RaceKind,
  type RaceLine,
  type RaceRow,
  type RaceSide,
  type RaceStatus,
  type RaceTable,
} from "@/engine/career/raceTable";
import {
  localAnchorFor,
  localAnchorForEvent,
  localTeamFor,
  localTeamTarget,
  userStarsFor,
  userTeamFor,
} from "@/engine/career/worldSim";
import type {
  CareerEventDef,
  CareerPlayerView,
  CareerSave,
  PotentialBand,
  SquadPlayer,
} from "@/engine/career/types";
import type { Region, Stats, TournamentTeam } from "@/engine/types";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { revealCursorKey, useCareerRevealStore } from "@/store/careerRevealStore";
import { roundsOf } from "@/components/career/event/eventPlayback";
import { participationOf, type Participation } from "@/components/career/event/weekendView";
import {
  activeDrillFor,
  eventDayPhaseOf,
  isChampionshipSunday,
  isEventPaused,
  isLegacySaturdayPlayoffs,
  nameOfRef,
  regionalUserEligible,
  scrimOpponentFor,
  squadHoldFor,
  userEventDefOnDay,
  userIsDirect,
  userOwnsQualifier,
  userSeedingFor,
  userTeamForEvent,
} from "@/store/careerFlow";

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
  /**
   * v2.0 (R40): is the user IN `event`? A Major / Worlds reaches the agenda
   * for spectators too — "spectating" days read as not-a-matchday.
   */
  participation: Participation | null;
  isToday: boolean;
  isPast: boolean;
  windowOpen: boolean;
}

/** True when the def is one the user plays (own-region official or qualified). */
export function isUserEventDef(save: CareerSave, def: CareerEventDef): boolean {
  if (def.tier === "regional") return regionalUserEligible(save, def);
  // R40: the week's commit / result decides; future weeks preview today's seeding.
  if (def.tier === "qualifier") return userOwnsQualifier(save, def);
  if (def.tier === "major") return save.competition.majorFieldRefs?.includes("user") ?? false;
  if (def.tier === "worlds") return save.competition.worldsFieldRefs?.includes("user") ?? false;
  return true;
}

/**
 * The user-relevant event def landing on `day`, if any (committed, in
 * progress or scheduled). v2.0 (R40): the qualifier on Saturday (outside the
 * direct 8 of the CURRENT split standings — the honest preview), the
 * regional on Sunday until a played qualifier rules the user out, a
 * Major/Worlds on both weekend days. Pure logic lives in the flow
 * (`userEventDefOnDay`).
 */
export function userEventOnDay(save: CareerSave, day: number): CareerEventDef | null {
  return userEventDefOnDay(save, day);
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
    const participation = event ? participationOf(save, event) : null;
    const playing = event !== null && participation !== "spectating";
    const kinds: DayKind[] = [];
    if (event) kinds.push("matchday");
    if (dow === 1 && isWindowStartWeek(week)) kinds.push("windowOpen");
    // v2.0 (R20): payroll books every Monday but the founding day.
    if (dow === 1 && !(save.clock.seasonIndex === 0 && week === 1)) kinds.push("payday");
    // v0.3: booked scrims show as training events on the calendar.
    if (save.scheduledScrims?.some((s) => s.day === day)) kinds.push("scrim");
    if (!event && dow <= CAREER_TRAINING.trainingDaysPerWeek) kinds.push("training");
    // v2.0 (R40): the weekend is matchday (qualifier / Swiss stage Saturday,
    // regional / Championship Sunday Sunday); a weekend day without a match
    // for the user — a direct seed's Saturday, a spectated Major — is rest.
    if (dow > CAREER_TRAINING.trainingDaysPerWeek && !playing) kinds.push("rest");
    if (kinds.length === 0) kinds.push("idle");
    out.push({
      day,
      date: dateOfDay(save.clock.seasonIndex, day),
      dow,
      kinds,
      event,
      participation,
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
  // R40: a Major/Worlds paused after its Saturday Swiss is a stop TOMORROW
  // (Championship Sunday), not today; on Sunday the event in progress is
  // today's stop. Today otherwise counts for a lobby that opens today.
  const paused = isEventPaused(save);
  const isTodaysStop = (event: CareerEventDef): boolean =>
    !paused &&
    (save.activeEvent?.def.id === event.id ||
      (save.pendingEventDef?.id === event.id && save.pendingEventDef.day === today));
  for (let day = today; day <= DAYS_PER_SEASON && out.length < count; day++) {
    const week = weekOfDay(day);
    const dow = dayOfWeekOf(day);
    const found = userEventOnDay(save, day);
    // R40: a spectated Major/Worlds is not a stop (the batched Advance runs
    // through it) — the preview must not promise one.
    const event = found && participationOf(save, found) !== "spectating" ? found : null;
    // R40: a two-day Major/Worlds covers Saturday AND Sunday — list it once.
    const listed = event !== null && out.some((s) => s.event?.id === event.id);
    if (event && !listed && (day > today || isTodaysStop(event))) {
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

// DEV-04 (rc.33): the band is capped at what the age clock still lets him reach (model 2),
// and a career created before rc.33 keeps its bought reports inside rc.32's band.
export function potBandOfSquad(save: CareerSave, p: SquadPlayer): PotentialBand {
  const arc = { peakAge: p.peakAge, exactAge: exactAgeOf(squadAge(save, p), save.clock.day) };
  return scoutedBand(p.potential, p.overall, p.scoutLevel, save.careerSeed, p.id, growthModelOf(save.world), {
    arc,
    rc32Reports: save.bandModel === undefined,
  });
}

/** The report level the user holds on a market player (bought reports, capped at reportMaxLevel). */
function marketLevelOf(save: CareerSave, id: string): 0 | 1 | 2 | 3 {
  const paid = Number(save.scouted[id] ?? 0);
  return Math.min(CAREER_SCOUT.reportMaxLevel, Math.max(0, paid)) as 0 | 1 | 2 | 3;
}

export function potBandOfView(save: CareerSave, view: CareerPlayerView): PotentialBand {
  const arc = { peakAge: view.peakAge, exactAge: exactAgeOf(view.age, save.clock.day) };
  return scoutedBand(
    view.potential,
    view.overall,
    marketLevelOf(save, view.id),
    save.careerSeed,
    view.id,
    growthModelOf(save.world),
    { arc, rc32Reports: save.bandModel === undefined },
  );
}

/** DEV-04 (rc.33): a market player's phase tag — "unknown" until a report reveals it. */
export function phaseOfView(save: CareerSave, view: CareerPlayerView): PhaseTag {
  return phaseTagFor(view, {
    level: marketLevelOf(save, view.id),
    careerSeed: save.careerSeed,
    model: growthModelOf(save.world),
    seasonAge: view.age,
    day: save.clock.day,
  });
}

/** ECO-10 (rc.33): the prize share a squad contract carries, as a label (an older deal reads the rc.32 rule). */
export function prizeShareLabelOf(C: CareerCopy, p: Pick<SquadPlayer, "prizeSharePct">): string {
  if (p.prizeSharePct !== undefined) return C.player.prizeSharePct(p.prizeSharePct);
  const s = CAREER_PRIZES.playerShare;
  return C.player.prizeShareLegacy(Math.round(s.regional * 100), Math.round(s.major * 100), Math.round(s.worlds * 100));
}

export function statsOfSquad(p: SquadPlayer): Stats {
  return statsFromView(p);
}

/** A squad player's phase tag (the copy's keys: growing / prime / declining / unknown). */
export type PhaseLabel = "growing" | "prime" | "declining" | "unknown";

/** The copy key of an engine phase tag ("peak" reads "prime"). */
export function phaseLabelOf(tag: PhaseTag): PhaseLabel {
  return tag === "peak" ? "prime" : tag;
}

export function agePhase(save: CareerSave, p: SquadPlayer): PhaseLabel {
  // DEV-01 (model 2): his own arc — growing to his peak age, at the top for
  // his plateau, then declining (rc.31: fixed ages 20 / 22). DEV-04 (rc.33):
  // the engine's tag, "unknown" until his report level reveals it.
  return phaseLabelOf(
    phaseTagFor(p, {
      level: p.scoutLevel,
      careerSeed: save.careerSeed,
      model: growthModelOf(save.world),
      seasonAge: squadAge(save, p),
      day: save.clock.day,
    }),
  );
}

/** Truthful training projection straight from the engine (no UI math). */
export function squadTrainingProjection(
  save: CareerSave,
  p: SquadPlayer,
): ReturnType<typeof trainingProjection> {
  return trainingProjection(p, {
    seasonIndex: save.clock.seasonIndex,
    coachOverall: save.coach?.overall ?? null,
    gearBonus: gearTrainingBonus(save.finances.gear),
    drill: activeDrillFor(save),
    trainingWeekBonus: false,
    ...growthCtxOf(save),
  });
}

/** v2.0 (R29): growth made tangible — progress to the next point + ETA. */
export function squadTrainingEta(save: CareerSave, p: SquadPlayer): ReturnType<typeof trainingEta> {
  const week = weekAt(weekOfDay(save.clock.day));
  return trainingEta(p, {
    seasonIndex: save.clock.seasonIndex,
    coachOverall: save.coach?.overall ?? null,
    gearBonus: gearTrainingBonus(save.finances.gear),
    trainingWeekBonus: (week.kind === "open" || week.kind === "preseason") && !save.pendingEventDef,
    drill: activeDrillFor(save),
    ...growthCtxOf(save),
  });
}

export { ageOf, playerViewById, statsFromView, activeDrillFor, userIsDirect, userSeedingFor };
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

/**
 * rc.29 (CAR-06): the team the user fields at `def` — startEvent's own build
 * (this event's ruled-out player included), for the lobby's field and ratings.
 */
export function eventTeamPreview(save: CareerSave, def: CareerEventDef): TournamentTeam {
  return userTeamForEvent(save, def).team;
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
// The two race tables (RTW-01, R49) — the Standings screen and the HQ toggle
// ---------------------------------------------------------------------------

/**
 * A region's Major table (this split's regional points) or Worlds table (the
 * season's regional + Major points) — engine/career/raceTable.ts, the order
 * and the cut the Major / Worlds selection uses, local sides included.
 */
export function raceTableOf(save: CareerSave, region: Region, kind: RaceKind): RaceTable {
  return raceTableFor({
    kind,
    region,
    competition: save.competition,
    world: save.world,
    clock: save.clock,
    userRegion: save.identity.region,
    careerSeed: save.careerSeed,
    results: save.eventResults,
    nameOf: (ref) => nameOfRef(save, ref),
  });
}

export type { RaceKind, RaceLine, RaceRow, RaceSide, RaceStatus, RaceTable };
export { raceLineOf };

/** Qualification cut-line size for a region (Major/Worlds slot table). */
export { CAREER_SLOTS } from "@/config/balance";

/**
 * R49: the anchor a region's local sides are rated around this season — the
 * user's region reads its frozen anchor (before it freezes, the user's
 * current team, as the season's first cups field them); other regions their
 * stored median.
 */
function seasonLocalAnchorOf(save: CareerSave, region: Region): number {
  const live =
    region === save.identity.region && !save.competition.localAnchor ? userTeamPreview(save).rating.total : null;
  return localAnchorFor(region, { world: save.world, competition: save.competition, liveUserRating: live });
}

/**
 * R49: a local side's rating (its region's anchor + its offset) — the number
 * the event lobby and the side's sheet show, the target the engine fits its
 * team to. With `at` (the event and the user's fielded rating) it applies the
 * engine's own anchor rule for that event (`localAnchorForEvent`).
 */
export function localSideRatingOf(
  save: CareerSave,
  ref: string,
  at?: { def: Pick<CareerEventDef, "tier">; userRating: number },
): number {
  const region = localRegionOf(ref) ?? save.identity.region;
  const anchor = at
    ? localAnchorForEvent(at.def, region, {
        world: save.world,
        competition: save.competition,
        userRegion: save.identity.region,
        userTeamRating: at.userRating,
      })
    : seasonLocalAnchorOf(save, region);
  return localTeamTarget(ref, anchor, save.careerSeed);
}

/** R49: a local side as the engine fields it this season (its sheet's roster and rating). */
export function localSideTeamOf(save: CareerSave, ref: string): TournamentTeam {
  const region = localRegionOf(ref) ?? save.identity.region;
  return localTeamFor(ref, {
    careerSeed: save.careerSeed,
    seasonIndex: save.clock.seasonIndex,
    difficulty: save.difficulty,
    anchor: seasonLocalAnchorOf(save, region),
    region,
  });
}

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
export { weeklyWage, weeklyStatement, runwayWeeks, nextPaydayFor };

/** v2.0: every wage label shows the WEEKLY figure of a per-split contract. */
export function wageLabel(C: CareerCopy, salaryPerSplit: number, compact = true): string {
  return C.squad.perWeek(formatMoney(weeklyWage(salaryPerSplit), { compact }));
}
export { CAREER_GEAR };

// ---------------------------------------------------------------------------
// Continue: where does the primary button go / what does it say?
// ---------------------------------------------------------------------------

export type ContinueKind =
  | "event" // an event awaits (lobby or in progress) → /career/event
  | "eventPaused" // v2.0 (R40): Major/Worlds Saturday Swiss done → continueEventToNextDay
  | "seasonReview" // → /career/season
  | "ended" // → /career/season (legacy screen)
  | "decision" // pending out-bid / sponsor choice on the hub
  | "advance"; // plain advance

export function continueKind(save: CareerSave): ContinueKind {
  if (save.phase === "ended") return "ended";
  if (save.phase === "seasonReview") return "seasonReview";
  // v2.0 (R40): a Major/Worlds paused after its Saturday Swiss — the routed
  // CONTINUE moves the clock to Championship Sunday (continueEventToNextDay).
  // A kind of its own, so the day autopilot never rolls into Sunday alone.
  if (isEventPaused(save)) return "eventPaused";
  if (save.activeEvent) return "event";
  // RTW-05 (rc.33): a short squad holds the clock on its event's eve and day.
  if (squadHoldFor(save)) return "decision";
  if (save.pendingEventDef && save.clock.day === save.pendingEventDef.day) return "event";
  if (save.pendingInsert && save.pendingInsert.day === save.clock.day) return "decision";
  if (save.pendingOffers.some((o) => o.status === "pending" && o.direction === "out")) {
    return "decision";
  }
  if (save.sponsorOffers && save.sponsorOffers.length > 0) {
    return "decision";
  }
  return "advance";
}

/**
 * R40 review: what the top bar's routed Continue shows. While the event
 * screen is still revealing a Major / Worlds Saturday (`revealHeldEventId`,
 * careerRevealStore), the engine may already sit at the pause — the bar keeps
 * the event's own Continue until the playback lands the verdict, or its
 * "Championship Sunday" label would spoil the deciding series.
 */
export function visibleContinueKind(save: CareerSave, revealHeldEventId: string | null): ContinueKind {
  const kind = continueKind(save);
  return kind === "eventPaused" && revealHeldEventId !== null && revealHeldEventId === save.activeEvent?.def.id
    ? "event"
    : kind;
}

/**
 * rc.29 (CAR-02): the hold the session reveal cursor implies when the event
 * screen is NOT mounted (a reload, a trip to HQ mid-round): a watched Major /
 * Worlds paused after its Saturday Swiss whose playback has not revealed every
 * Saturday round yet. HQ, the calendar and the top bar then keep the event's
 * own Continue — it leads back to the replay — instead of "Championship
 * Sunday" (a spoiler, and a skip of the unfinished round). No cursor = no hold.
 */
export function persistedRevealHold(save: CareerSave, cursor: number | null | undefined): string | null {
  const ev = save.activeEvent;
  if (!ev || !ev.watched || cursor === null || cursor === undefined) return null;
  if (!isEventPaused(save)) return null;
  return cursor < roundsOf(ev.tournament).length ? ev.def.id : null;
}

/** rc.29 (CAR-02): the playback's live hold, else the one its session cursor implies. */
export function useRevealHeldEventId(save: CareerSave | null): string | null {
  const live = useCareerRevealStore((s) => s.heldEventId);
  const key = save?.activeEvent ? revealCursorKey(save.careerSeed, save.activeEvent.def.id) : null;
  const cursor = useCareerRevealStore((s) => (key ? s.cursors[key] : undefined));
  if (live) return live;
  return save ? persistedRevealHold(save, cursor) : null;
}

export { nameOfRef };

// v2.0 (R40): the weekend's event phases (single source: careerFlow).
export { eventDayPhaseOf, isChampionshipSunday, isEventPaused, isLegacySaturdayPlayoffs };
// v2.0 (R40): a qualifier row reads Qualified / Eliminated, never a placement.
export { qualifierOutcomeOf } from "@/engine/career/careerResults";
