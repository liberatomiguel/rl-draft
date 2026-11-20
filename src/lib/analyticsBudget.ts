/**
 * The analytics budget guard — keeps the game under the PostHog FREE plan (1
 * million events per MONTH, checked in billing on 20/11/2026) when the launch
 * multiplies the players, with no server. Target: at most 70% of it.
 *
 * There is no way for a static site to know how many people are playing, so the
 * one input is a number someone keeps up to date: `playersPerDay`, read from the
 * build (`NEXT_PUBLIC_ANALYTICS_PLAYERS_PER_DAY`) and overridden by the static
 * file `public/analytics-budget.json` (edit the number, deploy). Below the first
 * threshold EVERYTHING is sent. Above it, in steps:
 *
 *  - a per-device daily cap on "standard" events: past the cap each event is
 *    sent with probability 1 in N, and carries `sampleWeight: N` so sums stay
 *    right (random, not "every Nth", so the estimate has no bias);
 *  - per-event sampling and device sampling, decided by the device's fixed
 *    bucket (0–99): a device is in or out for a whole event type, so funnels
 *    stay coherent inside the sample (`sampleBucket` is sent with every event);
 *  - on the levels sized for growth, CAREER sampling (`careerRate`): the
 *    per-tournament and decision events (`CAREER_SAMPLED_EVENTS`) of a share of
 *    careers, chosen by a hash of the careerId — whole careers in or out, so a
 *    sampled career is still complete. The split, season and end events are
 *    never sampled.
 *
 * "critical" events (funnel firsts, sessions, rare decisions) are never sampled
 * or capped. "essential" events (the career's spine, refused actions, accounts,
 * health) are never sampled or capped AND pass the circuit breaker; they have
 * their own, much higher ceiling (`essentialPerDay`) against a loop. The breaker
 * is always on, at any player count: a per-device daily count of everything
 * sent, past which only essential events go out — against a loop or a bot, and
 * it trims the longest days (v2.1.0-dev.4: 129 devices hit it in the launch week
 * and lost their career line, which is now essential).
 *
 * These are reporting numbers, not gameplay: they live here, not in balance.ts.
 */

import { CAREER_SAMPLED_EVENTS, type EventPriority } from "./analyticsCatalog";

export interface BudgetLevel {
  /** The level applies from this many players per day. */
  minPlayers: number;
  /** Standard events per device per UTC day sent in full; null = no cap. */
  dailyCap: number | null;
  /** Past the cap, each event is sent with probability 1 in `thinTo` (weight `thinTo`); 0 = none. */
  thinTo: number;
  /** Share of devices that send standard events at all (1 = every device). */
  deviceRate: number;
  /** Per-event share of devices, for events that need a different rate. */
  eventRates?: Readonly<Record<string, number>>;
  /** Share of CAREERS (by careerId hash) that send `CAREER_SAMPLED_EVENTS`; absent = 1 (all). */
  careerRate?: number;
}

export interface BudgetConfig {
  playersPerDay: number;
  /** Events per device per UTC day past which only essential events go out — always on. */
  breakerPerDay: number;
  /** Hard ceiling of ESSENTIAL events per device per UTC day (a loop in one of them). */
  essentialPerDay: number;
  /** Ascending by `minPlayers`; the last one whose threshold is met applies. */
  levels: readonly BudgetLevel[];
}

/**
 * The default ladder (docs/ANALYTICS-EVENTS-2.0.md, "Budget"). v2.1.0-dev.4:
 * re-sized on the launch week (14–19/11/2026: ~357 devices and ~26.5k events a
 * day, ~74 per device). Each level keeps the month at about 70% of the free
 * plan up to the next threshold, and under 100% well past it. "Players" =
 * devices per day (PostHog: unique `$device_id` per UTC day).
 */
export const DEFAULT_BUDGET_LEVELS: readonly BudgetLevel[] = [
  { minPlayers: 0, dailyCap: null, thinTo: 1, deviceRate: 1 },
  { minPlayers: 300, dailyCap: 20, thinTo: 8, deviceRate: 1 },
  { minPlayers: 370, dailyCap: 15, thinTo: 8, deviceRate: 1, eventRates: { $pageview: 0.5 }, careerRate: 0.75 },
  { minPlayers: 490, dailyCap: 15, thinTo: 8, deviceRate: 0.5, careerRate: 0.5 },
  { minPlayers: 670, dailyCap: 15, thinTo: 8, deviceRate: 0.25, careerRate: 0.3 },
  { minPlayers: 950, dailyCap: 15, thinTo: 8, deviceRate: 0.25, careerRate: 0.15 },
  { minPlayers: 1400, dailyCap: 15, thinTo: 8, deviceRate: 0.1, careerRate: 0.05 },
];

/** Past this many events in a day only essential events go out (the p99 device-day is ~400). */
export const DEFAULT_BREAKER_PER_DAY = 400;

/** Essential events per device per day: ~5x the longest day seen (279 tournaments before the breaker). */
export const DEFAULT_ESSENTIAL_PER_DAY = 1500;

function buildPlayersPerDay(): number {
  const n = Number(process.env.NEXT_PUBLIC_ANALYTICS_PLAYERS_PER_DAY);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function defaultBudget(): BudgetConfig {
  return {
    playersPerDay: buildPlayersPerDay(),
    breakerPerDay: DEFAULT_BREAKER_PER_DAY,
    essentialPerDay: DEFAULT_ESSENTIAL_PER_DAY,
    levels: DEFAULT_BUDGET_LEVELS,
  };
}

const rate = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;

const positiveInt = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : null;

function parseLevel(raw: unknown): BudgetLevel | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.minPlayers !== "number" || !Number.isFinite(r.minPlayers)) return null;
  const eventRates: Record<string, number> = {};
  if (r.eventRates && typeof r.eventRates === "object") {
    for (const [name, value] of Object.entries(r.eventRates as Record<string, unknown>)) {
      const parsed = rate(value);
      if (parsed !== null) eventRates[name] = parsed;
    }
  }
  const careerRate = rate(r.careerRate);
  return {
    minPlayers: Math.max(0, r.minPlayers),
    dailyCap: typeof r.dailyCap === "number" && Number.isFinite(r.dailyCap) ? Math.max(0, Math.floor(r.dailyCap)) : null,
    thinTo: typeof r.thinTo === "number" && Number.isFinite(r.thinTo) ? Math.max(0, Math.floor(r.thinTo)) : 1,
    deviceRate: rate(r.deviceRate) ?? 1,
    eventRates,
    ...(careerRate !== null ? { careerRate } : {}),
  };
}

/**
 * The static override (`/analytics-budget.json`) on top of a base config. Any
 * field may be missing; anything malformed is ignored, so a bad file can never
 * turn analytics off or break the page.
 */
export function parseBudgetConfig(raw: unknown, base: BudgetConfig = defaultBudget()): BudgetConfig {
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const levels = Array.isArray(r.levels)
    ? r.levels.map(parseLevel).filter((l): l is BudgetLevel => l !== null).sort((a, b) => a.minPlayers - b.minPlayers)
    : [];
  return {
    playersPerDay:
      typeof r.playersPerDay === "number" && Number.isFinite(r.playersPerDay) && r.playersPerDay >= 0
        ? r.playersPerDay
        : base.playersPerDay,
    breakerPerDay: positiveInt(r.breakerPerDay) ?? base.breakerPerDay,
    essentialPerDay: positiveInt(r.essentialPerDay) ?? base.essentialPerDay,
    levels: levels.length > 0 ? levels : base.levels,
  };
}

const OPEN_LEVEL: BudgetLevel = { minPlayers: 0, dailyCap: null, thinTo: 1, deviceRate: 1 };

/** The level in force for the configured player count (index 0 = everything is sent). */
export function budgetLevelOf(config: BudgetConfig): { index: number; level: BudgetLevel } {
  let index = -1;
  config.levels.forEach((level, i) => {
    if (config.playersPerDay >= level.minPlayers) index = i;
  });
  return index < 0 ? { index: 0, level: OPEN_LEVEL } : { index, level: config.levels[index] };
}

/** One device's counters for one UTC day. */
export interface BudgetDay {
  /** UTC date, YYYY-MM-DD. */
  key: string;
  /** Events sent today (every priority) — the breaker's count. */
  sent: number;
  /** Standard events that reached the cap check today (sent or thinned). */
  standard: number;
  /** Essential events sent today — the essential ceiling's count (absent = 0). */
  essential?: number;
  capNoted?: boolean;
  breakerNoted?: boolean;
  ceilingNoted?: boolean;
}

export function freshBudgetDay(key: string): BudgetDay {
  return { key, sent: 0, standard: 0 };
}

export interface BudgetDecision {
  send: boolean;
  /** How many real events this one stands for (1 = nothing was dropped). */
  weight: number;
  /** Set the first time today the cap, the breaker or the essential ceiling dropped an event. */
  note?: "cap" | "breaker" | "ceiling";
}

/** A stable 0–99 bucket for a careerId (FNV-1a), so a career is in or out of a sample as a whole. */
export function careerBucketOf(careerId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < careerId.length; i++) {
    h ^= careerId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

/**
 * Should this event go out? Mutates `day` (the device's counters). `bucket` is
 * the device's fixed 0–99 sample bucket; `random` draws the thinning past the
 * cap; `careerBucket` is the event's career bucket (`careerBucketOf`), for the
 * levels that sample careers (null = not a career event).
 */
export function decideBudget(
  config: BudgetConfig,
  name: string,
  priority: EventPriority,
  bucket: number,
  day: BudgetDay,
  random: () => number = Math.random,
  careerBucket: number | null = null,
): BudgetDecision {
  const { level } = budgetLevelOf(config);
  // Career sampling (growth levels only): a career outside the share sends none
  // of its per-tournament / decision events; the ones inside carry the weight.
  let careerWeight = 1;
  if (careerBucket !== null && CAREER_SAMPLED_EVENTS.includes(name)) {
    const share = level.careerRate ?? 1;
    if (share <= 0 || careerBucket >= share * 100) return { send: false, weight: 0 };
    careerWeight = 1 / share;
  }
  if (priority === "essential") {
    const sentEssential = day.essential ?? 0;
    if (sentEssential >= config.essentialPerDay) {
      if (day.ceilingNoted) return { send: false, weight: 0 };
      day.ceilingNoted = true;
      return { send: false, weight: 0, note: "ceiling" };
    }
    day.essential = sentEssential + 1;
    day.sent += 1;
    return { send: true, weight: careerWeight };
  }
  if (day.sent >= config.breakerPerDay) {
    if (day.breakerNoted) return { send: false, weight: 0 };
    day.breakerNoted = true;
    return { send: false, weight: 0, note: "breaker" };
  }
  if (priority === "critical") {
    day.sent += 1;
    return { send: true, weight: careerWeight };
  }
  const share = Math.min(level.deviceRate, level.eventRates?.[name] ?? 1);
  if (share <= 0 || bucket >= share * 100) return { send: false, weight: 0 };
  let weight = 1 / share;
  if (level.dailyCap !== null && day.standard >= level.dailyCap) {
    day.standard += 1;
    if (level.thinTo <= 0 || random() >= 1 / level.thinTo) {
      if (day.capNoted) return { send: false, weight: 0 };
      day.capNoted = true;
      return { send: false, weight: 0, note: "cap" };
    }
    weight *= level.thinTo;
  } else {
    day.standard += 1;
  }
  day.sent += 1;
  return { send: true, weight };
}
