/**
 * Road to Worlds — the season clock (design doc §7).
 *
 * One season = CAREER_CALENDAR.weeksPerSeason (32) weeks:
 *   W1-2   preseason (transfer window open, sponsor offers)
 *   W3-10  Split 1 — open, R1, open, R2, open, R3, open, Major
 *   W11-12 window
 *   W13-20 Split 2 (same shape)
 *   W21-22 window
 *   W23-30 Split 3 (same shape)
 *   W31    Worlds window (1-week last roster call)
 *   W32    Worlds
 *
 * Everything here is pure and derived from balance config; the ONLY random
 * surface is the t2-offer roll, which is cursor-free (`derivedFloat`).
 *
 * `eventIdFor` produces the STABLE event-id grammar that seed streams are
 * derived from — it is a compatibility surface and must never change:
 *   "{seasonIndex}:{split}:reg{ordinal}:{region}" | "{seasonIndex}:{split}:major" |
 *   "{seasonIndex}:worlds"
 */

import {
  CAREER_CALENDAR,
  CAREER_SEASONS,
  CAREER_SLOTS,
  CAREER_UNOFFICIAL,
} from "@/config/balance";
import { T2_EVENT_NAMES, T3_EVENT_NAMES } from "@/data/career/names";
import type { Region } from "../types";
import { derivedFloat, streams } from "./seeds";
import type { CalendarWeek, CareerEventDef } from "./types";

/** Canonical region order = the slot table's key order (single source). */
const REGION_ORDER = Object.keys(CAREER_SLOTS.major) as Region[];

// ---------------------------------------------------------------------------
// Day clock (v0.2) — the playable unit. Weeks stay the scheduling skeleton;
// every helper here is pure arithmetic over CAREER_CALENDAR.
// ---------------------------------------------------------------------------

export const DAYS_PER_SEASON = CAREER_CALENDAR.weeksPerSeason * CAREER_CALENDAR.daysPerWeek;

/** 1..32 — the schedule week a day belongs to. */
export function weekOfDay(day: number): number {
  return Math.floor((day - 1) / CAREER_CALENDAR.daysPerWeek) + 1;
}

/** 1=Mon .. 7=Sun. */
export function dayOfWeekOf(day: number): number {
  return ((day - 1) % CAREER_CALENDAR.daysPerWeek) + 1;
}

/** The Monday of a schedule week, as a day number. */
export function firstDayOfWeek(week: number): number {
  return (week - 1) * CAREER_CALENDAR.daysPerWeek + 1;
}

/** The matchday (Saturday) of a schedule week, as a day number. */
export function eventDayFor(week: number): number {
  return (week - 1) * CAREER_CALENDAR.daysPerWeek + CAREER_CALENDAR.eventDayOfWeek;
}

/** Mon-Fri are training days. */
export function isTrainingDay(day: number): boolean {
  return dayOfWeekOf(day) <= 5;
}

// --- Real calendar dates (pure civil-date arithmetic, no Date object) -------

/** days-from-civil (Howard Hinnant) — days since 1970-01-01 for y-m-d. */
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** civil-from-days — inverse of daysFromCivil. */
function civilFromDays(z: number): { y: number; m: number; d: number } {
  z += 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}

function parseIso(date: string): number {
  const [y, m, d] = date.split("-").map((n) => Number.parseInt(n, 10));
  return daysFromCivil(y, m, d);
}

/** Epoch-days of a season's day 1 (infinite era: +52 weeks per extra season). */
function seasonStartEpoch(seasonIndex: number): number {
  const last = CAREER_SEASONS.length - 1;
  if (seasonIndex <= last) return parseIso(CAREER_SEASONS[seasonIndex].startDate);
  // 364 days = 52 weeks — keeps day 1 on a Monday forever.
  return parseIso(CAREER_SEASONS[last].startDate) + 364 * (seasonIndex - last);
}

export interface CareerDate {
  y: number;
  /** 1..12 */
  m: number;
  /** 1..31 */
  d: number;
  /** 1=Mon .. 7=Sun (from the day grid, not recomputed). */
  dow: number;
}

/** The real calendar date of a season day. */
export function dateOfDay(seasonIndex: number, day: number): CareerDate {
  const { y, m, d } = civilFromDays(seasonStartEpoch(seasonIndex) + (day - 1));
  return { y, m, d, dow: dayOfWeekOf(day) };
}

/** The schedule week a transfer window closes on (0..3 → preseason/mid/mid/worlds). */
export function windowCloseWeekFor(windowIdx: 0 | 1 | 2 | 3): number {
  const C = CAREER_CALENDAR;
  if (windowIdx === 0) return C.preseasonWeeks;
  if (windowIdx === 3) return C.worldsWindowWeek;
  return C.preseasonWeeks + windowIdx * (C.splitWeeks + C.windowWeeks);
}

/** The last day of a transfer window (its closing week's Sunday). */
export function windowCloseDayFor(windowIdx: 0 | 1 | 2 | 3): number {
  return windowCloseWeekFor(windowIdx) * CAREER_CALENDAR.daysPerWeek;
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

function buildSchedule(): CalendarWeek[] {
  const C = CAREER_CALENDAR;
  const weeks: CalendarWeek[] = [];

  for (let w = 1; w <= C.preseasonWeeks; w++) {
    weeks.push({ week: w, kind: "preseason", windowOpen: true });
  }

  let week = C.preseasonWeeks;
  for (let s = 1; s <= 3; s++) {
    const split = s as 1 | 2 | 3;
    for (let offset = 1; offset <= C.splitWeeks; offset++) {
      week += 1;
      const ordIdx = (C.regionalOffsets as readonly number[]).indexOf(offset);
      if (ordIdx >= 0) {
        weeks.push({
          week,
          kind: "regional",
          split,
          ordinal: (ordIdx + 1) as 1 | 2 | 3,
          windowOpen: false,
        });
      } else if (offset === C.majorOffset) {
        weeks.push({ week, kind: "major", split, windowOpen: false });
      } else {
        weeks.push({ week, kind: "open", split, windowOpen: false });
      }
    }
    // Mid-season windows only after splits 1 and 2 (the Worlds window is W31).
    if (split < 3) {
      for (let i = 0; i < C.windowWeeks; i++) {
        week += 1;
        weeks.push({ week, kind: "window", windowOpen: true });
      }
    }
  }

  weeks.push({ week: C.worldsWindowWeek, kind: "worldsWindow", windowOpen: true });
  weeks.push({ week: C.worldsWeek, kind: "worlds", windowOpen: false });
  return weeks;
}

/** The template is static per config — built once, handed out as copies. */
const SCHEDULE: readonly CalendarWeek[] = buildSchedule();

/** The full 32-week season template (fresh copies — safe to annotate/mutate). */
export function seasonSchedule(): CalendarWeek[] {
  return SCHEDULE.map((w) => ({ ...w }));
}

export function weekAt(week: number): CalendarWeek {
  const wk = SCHEDULE[week - 1];
  if (!wk) {
    throw new Error(`weekAt: week ${week} outside 1..${CAREER_CALENDAR.weeksPerSeason}`);
  }
  return { ...wk };
}

export function splitOfWeek(week: number): 1 | 2 | 3 | null {
  return SCHEDULE[week - 1]?.split ?? null;
}

/** True on any transfer-window week (preseason, mid windows, Worlds window). */
export function isWindowWeek(week: number): boolean {
  return SCHEDULE[week - 1]?.windowOpen ?? false;
}

/**
 * Which of the season's 4 transfer windows a week belongs to:
 * 0 = preseason (W1-2) · 1 = W11-12 · 2 = W21-22 · 3 = Worlds window (W31).
 * Null outside windows.
 */
export function windowIndexOf(week: number): 0 | 1 | 2 | 3 | null {
  const wk = SCHEDULE[week - 1];
  if (!wk?.windowOpen) return null;
  if (wk.kind === "preseason") return 0;
  if (wk.kind === "worldsWindow") return 3;
  // Mid windows sit after each (splitWeeks + windowWeeks) block.
  const C = CAREER_CALENDAR;
  const block = Math.floor((week - C.preseasonWeeks - 1) / (C.splitWeeks + C.windowWeeks));
  return (block + 1) as 1 | 2;
}

// ---------------------------------------------------------------------------
// Event ids & official events
// ---------------------------------------------------------------------------

/**
 * STABLE event-id grammar — feeds seed streams; never change it.
 * regional → "{seasonIndex}:{split}:reg{ordinal}:{region}"
 * major    → "{seasonIndex}:{split}:major"
 * worlds   → "{seasonIndex}:worlds"
 */
export function eventIdFor(
  seasonIndex: number,
  kind: "regional" | "major" | "worlds",
  split?: 1 | 2 | 3,
  ordinal?: 1 | 2 | 3,
  region?: Region,
): string {
  if (kind === "worlds") return `${seasonIndex}:worlds`;
  if (split === undefined) throw new Error(`eventIdFor(${kind}) needs a split`);
  if (kind === "major") return `${seasonIndex}:${split}:major`;
  if (ordinal === undefined || region === undefined) {
    throw new Error("eventIdFor(regional) needs an ordinal and a region");
  }
  return `${seasonIndex}:${split}:reg${ordinal}:${region}`;
}

/**
 * The official events scheduled on a given week: one regional PER REGION on a
 * regional week (all 7 resolve in the same world tick), one cross-region Major
 * on a major week, the Worlds event on W32, [] otherwise.
 */
export function officialEventDefsForWeek(seasonIndex: number, week: number): CareerEventDef[] {
  const wk = weekAt(week);
  const day = eventDayFor(week);

  if (wk.kind === "regional") {
    const split = wk.split as 1 | 2 | 3;
    const ordinal = wk.ordinal as 1 | 2 | 3;
    return REGION_ORDER.map((region) => ({
      id: eventIdFor(seasonIndex, "regional", split, ordinal, region),
      tier: "regional" as const,
      region,
      seasonIndex,
      week,
      day,
      split,
      ordinal,
      name: `${region} Regional ${ordinal}`,
      format: "swiss" as const,
    }));
  }

  if (wk.kind === "major") {
    const split = wk.split as 1 | 2 | 3;
    return [
      {
        id: eventIdFor(seasonIndex, "major", split),
        tier: "major",
        seasonIndex,
        week,
        day,
        split,
        name: `Split ${split} Major`,
        format: "swiss",
      },
    ];
  }

  if (wk.kind === "worlds") {
    return [
      {
        id: eventIdFor(seasonIndex, "worlds"),
        tier: "worlds",
        seasonIndex,
        week,
        day,
        name: "World Championship",
        format: "swiss",
      },
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Unofficial offers (t3 Community Cup · t2 Invitational)
// ---------------------------------------------------------------------------

/**
 * The unofficial-tournament offer for an open week, if any. Deterministic per
 * (careerSeed, seasonIndex, week) — no RNG cursor. Precedence: a t2
 * Invitational (rep-gated, ~60% of eligible weeks) over the t3 Community Cup
 * (open to low-rated teams, capped entries per split); null when neither fits.
 * The def carries no region — unofficials are local to the user org, which the
 * store knows.
 */
export function unofficialOfferFor(
  seasonIndex: number,
  week: number,
  ctx: { userTeamRating: number; rep: number; t3EntriesThisSplit: number; careerSeed: number },
): CareerEventDef | null {
  const wk = weekAt(week);
  if (wk.kind !== "open") return null;

  const base = {
    id: `${seasonIndex}:${week}:unofficial`,
    seasonIndex,
    week,
    day: eventDayFor(week),
    split: wk.split,
    format: "single" as const,
  };
  // Cosmetic name rotation — deterministic, cycles the fictional banks.
  const rot = seasonIndex * CAREER_CALENDAR.weeksPerSeason + week;

  if (
    ctx.rep >= CAREER_UNOFFICIAL.t2RepGate &&
    derivedFloat(ctx.careerSeed, streams.gen("t2offer", `${seasonIndex}:${week}`)) <
      CAREER_UNOFFICIAL.t2OfferChance
  ) {
    return { ...base, tier: "t2", name: T2_EVENT_NAMES[rot % T2_EVENT_NAMES.length] };
  }

  if (
    ctx.userTeamRating <= CAREER_UNOFFICIAL.t3RatingCeiling &&
    ctx.t3EntriesThisSplit < CAREER_UNOFFICIAL.t3MaxEntriesPerSplit
  ) {
    return { ...base, tier: "t3", name: T3_EVENT_NAMES[rot % T3_EVENT_NAMES.length] };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Batched advance
// ---------------------------------------------------------------------------

/** True when `week` is the FIRST week of a transfer window. */
export function isWindowStartWeek(week: number): boolean {
  const wk = SCHEDULE[week - 1];
  if (!wk?.windowOpen) return false;
  return week === 1 || !SCHEDULE[week - 2].windowOpen;
}

/**
 * The next day ≥ fromDay the batched Advance must stop at: the matchday of an
 * official event relevant to the user (own-region regional, any Major,
 * Worlds), the Monday a transfer window opens, or — failing everything — the
 * season's last day. (The store adds dynamic stops: accepted unofficials,
 * pending decisions.)
 */
export function nextUserStopDay(seasonIndex: number, fromDay: number, userRegion: Region): number {
  const start = Math.max(1, Math.min(fromDay, DAYS_PER_SEASON));

  for (let day = start; day <= DAYS_PER_SEASON; day++) {
    const week = weekOfDay(day);
    if (dayOfWeekOf(day) === 1 && isWindowStartWeek(week)) return day;
    if (day === eventDayFor(week)) {
      const defs = officialEventDefsForWeek(seasonIndex, week);
      if (defs.some((d) => d.region === undefined || d.region === userRegion)) return day;
    }
  }
  return DAYS_PER_SEASON;
}

// ---------------------------------------------------------------------------
// Season identity
// ---------------------------------------------------------------------------

/** First seasonIndex of the infinite era (one past the dataset timeline). */
const INFINITE_FROM = CAREER_SEASONS.length;
/** Calendar year of the last dataset season (2026) — the infinite-era anchor. */
const LAST_DATASET_YEAR = Number.parseInt(CAREER_SEASONS[CAREER_SEASONS.length - 1].year, 10);

function infiniteYear(seasonIndex: number): number {
  return LAST_DATASET_YEAR + (seasonIndex - (INFINITE_FROM - 1));
}

/** Display label — dataset labels for 0..5, "RLCS 2027"… in the infinite era. */
export function seasonLabelFor(seasonIndex: number): string {
  if (seasonIndex < INFINITE_FROM) return CAREER_SEASONS[seasonIndex].label;
  return `RLCS ${infiniteYear(seasonIndex)}`;
}

/** Dataset season id for 0..5; "career-<year>" once the timeline runs out. */
export function seasonIdFor(seasonIndex: number): string {
  if (seasonIndex < INFINITE_FROM) return CAREER_SEASONS[seasonIndex].seasonId;
  return `career-${infiniteYear(seasonIndex)}`;
}

/** Dataset chronology order (10..15); the infinite era clamps at the last one. */
export function orderFor(seasonIndex: number): number {
  if (seasonIndex < INFINITE_FROM) return CAREER_SEASONS[seasonIndex].order;
  return CAREER_SEASONS[CAREER_SEASONS.length - 1].order;
}
