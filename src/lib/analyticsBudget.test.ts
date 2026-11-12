/**
 * The analytics budget guard (pure): the level ladder, the per-device daily
 * cap with thinning, device and per-event sampling by the fixed bucket, the
 * always-on circuit breaker and the tolerant parser of the static budget file.
 */
import { describe, expect, it } from "vitest";
import {
  budgetLevelOf,
  decideBudget,
  DEFAULT_BREAKER_PER_DAY,
  DEFAULT_BUDGET_LEVELS,
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
  it("level 0 holds below 700 players a day; the ladder steps at 700 / 1,000 / 1,400 / 2,500", () => {
    expect([0, 100, 500, 699].map((n) => budgetLevelOf(at(n)).index)).toEqual([0, 0, 0, 0]);
    expect([700, 999, 1000, 1399, 1400, 2499, 2500, 9000].map((n) => budgetLevelOf(at(n)).index)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(DEFAULT_BUDGET_LEVELS[0]).toMatchObject({ dailyCap: null, deviceRate: 1 });
  });

  it("the build's default is level 0 (everything is sent) until someone raises the number", () => {
    expect(defaultBudget().playersPerDay).toBe(0);
    expect(budgetLevelOf(defaultBudget()).index).toBe(0);
  });
});

describe("decideBudget", () => {
  it("level 0: everything is sent with weight 1, whatever the bucket", () => {
    for (const bucket of [0, 50, 99]) {
      const { sent, notes } = play(at(500), 300, bucket);
      expect(sent).toHaveLength(300);
      expect(new Set(sent)).toEqual(new Set([1]));
      expect(notes).toEqual([]);
    }
  });

  it("level 1: the first 30 standard events of the day in full, then 1 in 4 (at random) with weight 4 — the total is preserved", () => {
    const { sent, notes, weight } = play(at(800), 230);
    expect(sent.slice(0, 30)).toEqual(Array(30).fill(1));
    expect(sent.slice(30)).toEqual(Array(50).fill(4));
    expect(weight).toBe(230);
    expect(notes).toEqual(["cap"]);
  });

  it("level 2: a cap of 15 thinned 1 in 8, and $pageview from half of the devices", () => {
    const { sent, weight } = play(at(1000), 175);
    expect(sent).toHaveLength(15 + 20);
    expect(weight).toBe(175);
    expect(play(at(1000), 5, 49, "$pageview").sent).toEqual(Array(5).fill(2));
    expect(play(at(1000), 5, 50, "$pageview").sent).toEqual([]);
    expect(play(at(1000), 5, 50, "run_completed").sent).toHaveLength(5);
  });

  it("levels 3 and 4: half, then a quarter of the devices send standard events, weighted", () => {
    expect(play(at(1400), 10, 49).sent).toEqual(Array(10).fill(2));
    expect(play(at(1400), 10, 50).sent).toEqual([]);
    expect(play(at(2500), 10, 24).sent).toEqual(Array(10).fill(4));
    expect(play(at(2500), 10, 25).sent).toEqual([]);
  });

  it("across all buckets, the weighted total estimates the real total at every level", () => {
    for (const players of [800, 1000, 1400, 2500]) {
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
        const decision = decideBudget(at(800), "run_completed", "standard", 0, d);
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
});

describe("parseBudgetConfig (the static /analytics-budget.json)", () => {
  it("reads the player count and keeps the built-in ladder", () => {
    const config = parseBudgetConfig({ playersPerDay: 1200 });
    expect(config.playersPerDay).toBe(1200);
    expect(config.levels).toBe(DEFAULT_BUDGET_LEVELS);
    expect(budgetLevelOf(config).index).toBe(2);
  });

  it("the shipped file is valid and leaves everything on", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shipped = require("../../public/analytics-budget.json") as unknown;
    expect(budgetLevelOf(parseBudgetConfig(shipped)).index).toBe(0);
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
    for (const raw of [null, undefined, "x", 3, [], { playersPerDay: "many" }, { playersPerDay: -5 }, { levels: [] }, { breakerPerDay: 0 }]) {
      expect(parseBudgetConfig(raw), JSON.stringify(raw)).toEqual(base);
    }
  });
});
