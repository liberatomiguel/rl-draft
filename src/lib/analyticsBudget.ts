/**
 * The analytics budget guard — keeps the game under the PostHog plan (1 million
 * events per MONTH) when the launch multiplies the players, with no server.
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
 *    stay coherent inside the sample (`sampleBucket` is sent with every event).
 *
 * "critical" events (funnel firsts, sessions, summaries, rare decisions,
 * accounts, health) are never sampled or capped. One thing is always on, at any
 * player count: the circuit breaker, a hard per-device daily ceiling far above
 * real play, against a loop or a bot.
 *
 * These are reporting numbers, not gameplay: they live here, not in balance.ts.
 */

import type { EventPriority } from "./analyticsCatalog";

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
}

export interface BudgetConfig {
  playersPerDay: number;
  /** Hard ceiling of events per device per UTC day — always on. */
  breakerPerDay: number;
  /** Ascending by `minPlayers`; the last one whose threshold is met applies. */
  levels: readonly BudgetLevel[];
}

/**
 * The default ladder (docs/ANALYTICS-EVENTS-2.0.md, "Budget"). Sized on the 30
 * days measured before the launch: about 40 events per player per day with
 * everything sent, so level 0 holds until roughly 800 players per day.
 */
export const DEFAULT_BUDGET_LEVELS: readonly BudgetLevel[] = [
  { minPlayers: 0, dailyCap: null, thinTo: 1, deviceRate: 1 },
  { minPlayers: 700, dailyCap: 30, thinTo: 4, deviceRate: 1 },
  { minPlayers: 1000, dailyCap: 15, thinTo: 8, deviceRate: 1, eventRates: { $pageview: 0.5 } },
  { minPlayers: 1400, dailyCap: 15, thinTo: 8, deviceRate: 0.5 },
  { minPlayers: 2500, dailyCap: 15, thinTo: 8, deviceRate: 0.25 },
];

/** Far above real play (the new design's 99th percentile is about 220 a day). */
export const DEFAULT_BREAKER_PER_DAY = 400;

function buildPlayersPerDay(): number {
  const n = Number(process.env.NEXT_PUBLIC_ANALYTICS_PLAYERS_PER_DAY);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function defaultBudget(): BudgetConfig {
  return { playersPerDay: buildPlayersPerDay(), breakerPerDay: DEFAULT_BREAKER_PER_DAY, levels: DEFAULT_BUDGET_LEVELS };
}

const rate = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;

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
  return {
    minPlayers: Math.max(0, r.minPlayers),
    dailyCap: typeof r.dailyCap === "number" && Number.isFinite(r.dailyCap) ? Math.max(0, Math.floor(r.dailyCap)) : null,
    thinTo: typeof r.thinTo === "number" && Number.isFinite(r.thinTo) ? Math.max(0, Math.floor(r.thinTo)) : 1,
    deviceRate: rate(r.deviceRate) ?? 1,
    eventRates,
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
    breakerPerDay:
      typeof r.breakerPerDay === "number" && Number.isFinite(r.breakerPerDay) && r.breakerPerDay > 0
        ? Math.floor(r.breakerPerDay)
        : base.breakerPerDay,
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
  capNoted?: boolean;
  breakerNoted?: boolean;
}

export function freshBudgetDay(key: string): BudgetDay {
  return { key, sent: 0, standard: 0 };
}

export interface BudgetDecision {
  send: boolean;
  /** How many real events this one stands for (1 = nothing was dropped). */
  weight: number;
  /** Set the first time today the cap or the breaker dropped an event. */
  note?: "cap" | "breaker";
}

/**
 * Should this event go out? Mutates `day` (the device's counters). `bucket` is
 * the device's fixed 0–99 sample bucket; `random` draws the thinning past the cap.
 */
export function decideBudget(
  config: BudgetConfig,
  name: string,
  priority: EventPriority,
  bucket: number,
  day: BudgetDay,
  random: () => number = Math.random,
): BudgetDecision {
  if (day.sent >= config.breakerPerDay) {
    if (day.breakerNoted) return { send: false, weight: 0 };
    day.breakerNoted = true;
    return { send: false, weight: 0, note: "breaker" };
  }
  if (priority === "critical") {
    day.sent += 1;
    return { send: true, weight: 1 };
  }
  const { level } = budgetLevelOf(config);
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
