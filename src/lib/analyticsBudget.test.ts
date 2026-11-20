/**
 * The analytics budget guard (pure): the level ladder, the per-device daily
 * cap with thinning, device and per-event sampling by the fixed bucket, the
 * always-on circuit breaker and the tolerant parser of the static budget file.
 */
import { describe, expect, it } from "vitest";
import {
  budgetLevelOf,
  careerBucketOf,
  decideBudget,
  DEFAULT_BREAKER_PER_DAY,
  DEFAULT_BUDGET_LEVELS,
  DEFAULT_ESSENTIAL_PER_DAY,
  defaultBudget,
  freshBudgetDay,
  parseBudgetConfig,
  type BudgetConfig,
} from "./analyticsBudget";

const at = (playersPerDay: number): BudgetConfig => ({ ...defaultBudget(), playersPerDay });
const day = () => freshBudgetDay("2026-11-12");

/** A draw that passes a "1 in k" test exactly once every k calls (0, 1/k, 2/k, …). */
function cycle(k: number): () => number {
  let i = 0;
  return () => (i++ % k) / k;
}

/** Send `count` standard events from one device; returns what went out. */
function play(config: BudgetConfig, count: number, bucket = 0, name = "run_completed") {
  const d = day();
  const sent: number[] = [];
  const notes: string[] = [];
  const random = cycle(Math.max(1, budgetLevelOf(config).level.thinTo));
  for (let i = 0; i < count; i++) {
    const decision = decideBudget(config, name, "standard", bucket, d, random);
    if (decision.send) sent.push(decision.weight);
    if (decision.note) notes.push(decision.note);
  }
  return { sent, notes, weight: sent.reduce((total, w) => total + w, 0) };
}

describe("the level ladder", () => {
  it("level 0 holds below 300 players a day; the ladder steps at 300 / 370 / 490 / 670 / 950 / 1,400", () => {
    expect([0, 100, 299].map((n) => budgetLevelOf(at(n)).index)).toEqual([0, 0, 0]);
    expect([300, 369, 370, 489, 490, 669, 670, 949, 950, 1399, 1400, 9000].map((n) => budgetLevelOf(at(n)).index)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ]);
    expect(DEFAULT_BUDGET_LEVELS[0]).toMatchObject({ dailyCap: null, deviceRate: 1 });
    // Career sampling only on the growth levels, and it only ever goes down.
    const rates = DEFAULT_BUDGET_LEVELS.map((l) => l.careerRate ?? 1);
    expect(rates.slice(0, 2)).toEqual([1, 1]);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
  });

  it("the build's default is level 0 (everything is sent) until someone raises the number", () => {
    expect(defaultBudget().playersPerDay).toBe(0);
    expect(budgetLevelOf(defaultBudget()).index).toBe(0);
  });
});

describe("decideBudget", () => {
  it("level 0: everything is sent with weight 1, whatever the bucket", () => {
    for (const bucket of [0, 50, 99]) {
      const { sent, notes } = play(at(200), 300, bucket);
      expect(sent).toHaveLength(300);
      expect(new Set(sent)).toEqual(new Set([1]));
      expect(notes).toEqual([]);
    }
  });

  it("level 1: the first 20 standard events of the day in full, then 1 in 8 (at random) with weight 8 — the total is preserved", () => {
    const { sent, notes, weight } = play(at(360), 260);
    expect(sent.slice(0, 20)).toEqual(Array(20).fill(1));
    expect(sent.slice(20)).toEqual(Array(30).fill(8));
    expect(weight).toBe(260);
    expect(notes).toEqual(["cap"]);
  });

  it("level 2: a cap of 15 thinned 1 in 8, and $pageview from half of the devices", () => {
    const { sent, weight } = play(at(400), 175);
    expect(sent).toHaveLength(15 + 20);
    expect(weight).toBe(175);
    expect(play(at(400), 5, 49, "$pageview").sent).toEqual(Array(5).fill(2));
    expect(play(at(400), 5, 50, "$pageview").sent).toEqual([]);
    expect(play(at(400), 5, 50, "run_completed").sent).toHaveLength(5);
  });

  it("levels 3 to 6: half, a quarter, then a tenth of the devices send standard events, weighted", () => {
    expect(play(at(490), 10, 49).sent).toEqual(Array(10).fill(2));
    expect(play(at(490), 10, 50).sent).toEqual([]);
    expect(play(at(670), 10, 24).sent).toEqual(Array(10).fill(4));
    expect(play(at(670), 10, 25).sent).toEqual([]);
    expect(play(at(1400), 10, 9).sent).toEqual(Array(10).fill(10));
    expect(play(at(1400), 10, 10).sent).toEqual([]);
  });

  it("across all buckets, the weighted total estimates the real total at every level", () => {
    for (const players of [360, 400, 490, 670, 950, 1400]) {
      const count = (budgetLevelOf(at(players)).level.dailyCap ?? 0) + 40;
      let weight = 0;
      for (let bucket = 0; bucket < 100; bucket++) weight += play(at(players), count, bucket).weight;
      expect(weight, String(players)).toBe(100 * count);
    }
  });

  it("the thinning past the cap is a random 1 in N, so its estimate has no bias", () => {
    let weight = 0;
    const devices = 400;
    for (let i = 0; i < devices; i++) {
      const d = day();
      for (let n = 0; n < 63; n++) {
        const decision = decideBudget(at(360), "run_completed", "standard", 0, d);
        if (decision.send) weight += decision.weight;
      }
    }
    expect(Math.abs(weight / (devices * 63) - 1)).toBeLessThan(0.05);
  });

  it("critical events are never sampled or capped, at any level, for any bucket", () => {
    const d = day();
    for (let i = 0; i < 200; i++) {
      expect(decideBudget(at(9000), "career_season_completed", "critical", 99, d)).toEqual({ send: true, weight: 1 });
    }
  });

  it("the circuit breaker stops everything past the daily ceiling, at level 0 too, and notes it once", () => {
    const d = day();
    let sent = 0;
    const notes: string[] = [];
    for (let i = 0; i < DEFAULT_BREAKER_PER_DAY + 50; i++) {
      const decision = decideBudget(at(0), "session_started", "critical", 0, d);
      if (decision.send) sent += 1;
      if (decision.note) notes.push(decision.note);
    }
    expect(sent).toBe(DEFAULT_BREAKER_PER_DAY);
    expect(notes).toEqual(["breaker"]);
  });

  it("essential events pass the breaker, count toward it, and stop only at their own ceiling (noted once)", () => {
    const d = day();
    for (let i = 0; i < DEFAULT_BREAKER_PER_DAY; i++) decideBudget(at(0), "run_completed", "standard", 0, d);
    expect(decideBudget(at(0), "career_transfer", "critical", 0, d)).toMatchObject({ send: false, note: "breaker" });
    let sent = 0;
    const notes: string[] = [];
    for (let i = 0; i < DEFAULT_ESSENTIAL_PER_DAY + 20; i++) {
      const decision = decideBudget(at(0), "career_event_completed", "essential", 99, d);
      if (decision.send) sent += 1;
      if (decision.note) notes.push(decision.note);
    }
    expect(sent).toBe(DEFAULT_ESSENTIAL_PER_DAY);
    expect(notes).toEqual(["ceiling"]);
    expect(d.sent).toBe(DEFAULT_BREAKER_PER_DAY + DEFAULT_ESSENTIAL_PER_DAY);
  });

  it("essential events are never sampled or capped, at any level", () => {
    const d = day();
    for (let i = 0; i < 200; i++) {
      expect(decideBudget(at(9000), "career_season_completed", "essential", 99, d, Math.random, 99)).toEqual({ send: true, weight: 1 });
    }
  });

  it("career sampling keeps whole careers in or out on the growth levels, weighted, at any priority", () => {
    // Level 1: no career sampling.
    expect(decideBudget(at(360), "career_event_completed", "essential", 0, day(), Math.random, 99)).toEqual({ send: true, weight: 1 });
    // Level 2 (careerRate 0.75): buckets 0–74 in with weight 4/3, 75–99 out — for the tournament line and the decisions alike.
    expect(decideBudget(at(400), "career_event_completed", "essential", 0, day(), Math.random, 74)).toEqual({ send: true, weight: 4 / 3 });
    expect(decideBudget(at(400), "career_event_completed", "essential", 0, day(), Math.random, 75)).toEqual({ send: false, weight: 0 });
    expect(decideBudget(at(400), "career_transfer", "critical", 0, day(), Math.random, 75)).toEqual({ send: false, weight: 0 });
    // The season line and the events without a career are never career-sampled.
    expect(decideBudget(at(1400), "career_season_completed", "essential", 0, day(), Math.random, 99)).toEqual({ send: true, weight: 1 });
    expect(decideBudget(at(1400), "career_event_completed", "essential", 0, day(), Math.random, null)).toEqual({ send: true, weight: 1 });
    // Across every career bucket the weighted count is the real count.
    for (const players of [400, 490, 670, 950, 1400]) {
      let weight = 0;
      for (let b = 0; b < 100; b++) {
        const decision = decideBudget(at(players), "career_event_completed", "essential", 0, day(), Math.random, b);
        if (decision.send) weight += decision.weight;
      }
      expect(weight, String(players)).toBeCloseTo(100, 6);
    }
  });

  it("the career bucket is a stable 0–99 hash of the careerId", () => {
    expect(careerBucketOf("c0a1b2c3d")).toBe(careerBucketOf("c0a1b2c3d"));
    const buckets = new Set(Array.from({ length: 500 }, (_, i) => careerBucketOf(`c${i.toString(16).padStart(8, "0")}`)));
    for (const b of buckets) expect(b >= 0 && b < 100 && Number.isInteger(b)).toBe(true);
    expect(buckets.size).toBeGreaterThan(80);
  });
});

describe("parseBudgetConfig (the static /analytics-budget.json)", () => {
  it("reads the player count and keeps the built-in ladder", () => {
    const config = parseBudgetConfig({ playersPerDay: 1200 });
    expect(config.playersPerDay).toBe(1200);
    expect(config.levels).toBe(DEFAULT_BUDGET_LEVELS);
    expect(budgetLevelOf(config).index).toBe(5);
  });

  it("the shipped file is valid and sits on level 1 (the launch week: ~360 devices a day)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shipped = require("../../public/analytics-budget.json") as unknown;
    expect(budgetLevelOf(parseBudgetConfig(shipped)).index).toBe(1);
  });

  it("accepts its own ladder and per-event rates, sorted by threshold and clamped", () => {
    const config = parseBudgetConfig({
      playersPerDay: 50,
      breakerPerDay: 100,
      levels: [
        { minPlayers: 40, dailyCap: 5, thinTo: 2, deviceRate: 3, eventRates: { run_completed: 0.5, junk: "x" } },
        { minPlayers: 0 },
        "junk",
      ],
    });
    expect(config.breakerPerDay).toBe(100);
    expect(config.levels.map((l) => l.minPlayers)).toEqual([0, 40]);
    expect(budgetLevelOf(config).level).toMatchObject({ dailyCap: 5, thinTo: 2, deviceRate: 1, eventRates: { run_completed: 0.5 } });
  });

  it("anything malformed is ignored: a bad file can never switch analytics off", () => {
    const base = defaultBudget();
    for (const raw of [null, undefined, "x", 3, [], { playersPerDay: "many" }, { playersPerDay: -5 }, { levels: [] }, { breakerPerDay: 0 }, { essentialPerDay: -1 }]) {
      expect(parseBudgetConfig(raw), JSON.stringify(raw)).toEqual(base);
    }
  });
});
