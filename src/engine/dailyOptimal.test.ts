import { describe, expect, it } from "vitest";
import solutionsJson from "@/engine/__fixtures__/daily-solutions-v2.json";
import { generateDailyConfig } from "@/lib/daily";
import { DAILY_ROTATION, DAILY_ROTATION_START, dailySeedForDate } from "@/lib/dailyPlan";
import { createRng } from "@/lib/rng";
import {
  DailyDraftStepper,
  compareScores,
  createDailyDraft,
  createDailySolver,
  percentileOf,
  referenceDistribution,
  referenceDraft,
  replayDailyDraft,
  scoreRoster,
  solveDailyOptimal,
  summarizeDailyInsight,
  type DailyStart,
  type DraftScore,
} from "./dailyOptimal";
import type { DailyDraftAction } from "./dailyOptimal";

const solutions = solutionsJson as Record<string, { seed: number; actions: DailyDraftAction[] }>;
const dayAt = (i: number) =>
  new Date(Date.parse(`${DAILY_ROTATION_START}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
const startOf = (date: string): DailyStart => ({ rules: generateDailyConfig(date), date, seed: dailySeedForDate(date) });

// Two full turns of the template wheel, then a spread over the rest of the
// reviewed year: every template, several times. (The whole year: DAILY_OPT_PROBE.)
const SAMPLE = [
  ...Array.from({ length: DAILY_ROTATION.length * 2 }, (_, i) => dayAt(i)),
  ...Array.from({ length: 12 }, (_, i) => dayAt(30 + i * 29)),
];

describe("daily optimal draft", () => {
  for (const date of SAMPLE) {
    it(`${date}: exact, legal through the real draft, never beaten`, () => {
      const start = startOf(date);
      const stepper = new DailyDraftStepper(start);
      const optimal = solveDailyOptimal(start, undefined, stepper);
      expect(optimal.exhaustive).toBe(true);

      // The memoised line replays through applyPick / applyReroll / applyFreeReroll.
      const replayed = replayDailyDraft(start, optimal.actions);
      expect(replayed.complete).toBe(true);
      expect(replayed.roster).toEqual(optimal.roster);
      expect(scoreRoster(replayed.roster, start.rules)).toEqual(optimal.score);

      // Never worse than the reviewed player line (the calendar's title path) …
      const authored = replayDailyDraft(start, solutions[date].actions);
      expect(authored.complete).toBe(true);
      expect(compareScores(optimal.score, scoreRoster(authored.roster, start.rules))).toBeGreaterThanOrEqual(0);

      // … nor than any reference draft, each of which also replays for real.
      for (let policy = 1; policy <= 40; policy++) {
        const ref = referenceDraft(start, policy, stepper);
        expect(compareScores(optimal.score, ref.score)).toBeGreaterThanOrEqual(0);
        if (policy <= 8) expect(replayDailyDraft(start, ref.actions).roster).toEqual(ref.roster);
      }
    });
  }

  it("is deterministic and does not depend on how the search is sliced", () => {
    const start = startOf(dayAt(1));
    const once = solveDailyOptimal(start);
    expect(solveDailyOptimal(start)).toEqual(once);
    const sliced = createDailySolver(start);
    let slices = 0;
    while (!sliced.step(37)) slices++;
    expect(slices).toBeGreaterThan(10);
    expect(sliced.result()).toEqual(once);
    expect(referenceDistribution(start)).toEqual(referenceDistribution(start));
  });

  it("leaves the day's own draft untouched (read-only)", () => {
    const date = dayAt(3);
    const start = startOf(date);
    const open = () => {
      const rng = createRng(start.seed);
      const draft = createDailyDraft(start.rules, date, rng);
      return { draft, rng: rng.state };
    };
    const before = JSON.stringify(open());
    solveDailyOptimal(start);
    referenceDistribution(start);
    expect(JSON.stringify(open())).toBe(before);
  });

  it("on a capped day (Underdog) the best line respects the cap", () => {
    const date = SAMPLE.find((d) => generateDailyConfig(d).info.templateId === "underdog")!;
    const start = startOf(date);
    const optimal = solveDailyOptimal(start);
    expect(optimal.score.eligible).toBe(true);
    expect(optimal.score.overall).toBeLessThanOrEqual(88);
  });
});

describe("percentile against the reference drafts", () => {
  const s = (rating: number, eligible = true): DraftScore => ({ rating, overall: Math.round(rating), chemistry: 0, eligible });
  const dist = { source: "simulated" as const, ratings: [-Infinity, 88, 90, 90, 92] };

  it("counts what a score beats, ties at half", () => {
    expect(percentileOf(s(95), dist)).toBe(100);
    expect(percentileOf(s(90), dist)).toBe(60);
    expect(percentileOf(s(80), dist)).toBe(20);
    expect(percentileOf(s(95, false), dist)).toBe(10);
    expect(percentileOf(s(90), { source: "players", ratings: [] })).toBe(0);
  });

  it("summarises a finished Daily: gap, match and percentile", () => {
    const date = dayAt(0);
    const start = startOf(date);
    const optimal = solveDailyOptimal(start);
    const distribution = referenceDistribution(start);
    expect(distribution.ratings).toHaveLength(200);
    expect(distribution.source).toBe("simulated");

    const mine = summarizeDailyInsight(optimal, optimal.roster, start.rules, distribution);
    expect(mine.matched).toBe(true);
    expect(mine.gap).toBe(0);
    expect(mine.percentile).toBeGreaterThanOrEqual(99);

    const weaker = referenceDraft(start, 7);
    const theirs = summarizeDailyInsight(optimal, weaker.roster, start.rules, distribution);
    expect(theirs.gap).toBeCloseTo(optimal.score.rating - weaker.score.rating, 5);
    expect(theirs.percentile).toBeLessThan(100);
  });
});
