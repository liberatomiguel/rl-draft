/**
 * v2.0 (C1) — performance probe (opt-in: C1_PERF=1). Plays a long career with
 * the arc bot and, at each season's end, prints the save's size (by top-level
 * key), the cost of cloning / serialising it and of a day's advance.
 *   C1_PERF=1 npx vitest run src/store/careerPerf.probe.test.ts
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { careerXpBetween } from "@/engine/career/careerXp";
import type { CareerSave } from "@/engine/career/types";
import { signableOverallCap } from "@/engine/career/economy";
import { honorsTableOf } from "@/engine/career/honors";
import { listingFor } from "@/engine/career/market";
import { seasonGoalsViewOf } from "@/engine/career/seasonGoals";
import { playArcCareer, worldPlayerViews } from "./careerArcBot";
import { pendingDecisionsOf } from "./careerDecisions";
import {
  advanceDayFlow,
  coachCandidatesFor,
  moneyNoticeOf,
  scrimShortlistFor,
  seasonOutlookOf,
  sponsorLevelOf,
  weeklyStatementOf,
} from "./careerFlow";
import { hqFinanceOf, toolboxOf } from "./careerHq";
import { sundayAheadOf } from "./careerSunday";
import { teamChemistryOf, trainingBlockOf } from "./careerTraining";

/** The read functions the screens call on a render, timed on one save (ms each, average of n). */
function viewCosts(save: CareerSave): string {
  const run = save.phase === "running" ? save : ({ ...save, phase: "running" } as CareerSave);
  const views: [string, () => unknown][] = [
    ["listingFor", () => listingFor({ world: run.world, squadIds: run.squad.map((p) => p.id), seasonIndex: run.clock.seasonIndex, careerSeed: run.careerSeed, signableCap: signableOverallCap(run.reputation) })],
    ["worldPlayerViews", () => worldPlayerViews(run)],
    ["sponsorLevelOf", () => sponsorLevelOf(run)],
    ["seasonGoalsViewOf", () => seasonGoalsViewOf(run)],
    ["seasonOutlookOf", () => seasonOutlookOf(run)],
    ["weeklyStatementOf", () => weeklyStatementOf(run)],
    ["moneyNoticeOf", () => moneyNoticeOf(run)],
    ["hqFinanceOf", () => hqFinanceOf(run)],
    ["toolboxOf", () => toolboxOf(run)],
    ["pendingDecisionsOf", () => pendingDecisionsOf(run)],
    ["sundayAheadOf", () => sundayAheadOf(run)],
    ["trainingBlockOf", () => trainingBlockOf(run)],
    ["teamChemistryOf", () => teamChemistryOf(run)],
    ["coachCandidatesFor", () => coachCandidatesFor(run)],
    ["scrimShortlistFor", () => scrimShortlistFor(run)],
    ["honorsTableOf", () => honorsTableOf(run, "players")],
    ["advanceDayFlow(no-op clone)", () => advanceDayFlow(run)],
  ];
  return views
    .map(([name, fn]) => {
      try {
        return `${name} ${ms(fn, 5).toFixed(2)}`;
      } catch (e) {
        return `${name} ERR ${(e as Error).message.slice(0, 40)}`;
      }
    })
    .join(", ");
}

const ON = process.env.C1_PERF === "1";
const SEASONS = Number(process.env.C1_PERF_SEASONS ?? 9);

function sizes(save: CareerSave): { total: number; top: [string, number][] } {
  const top = Object.entries(save as unknown as Record<string, unknown>)
    .map(([k, v]): [string, number] => [k, JSON.stringify(v ?? null).length])
    .sort((a, b) => b[1] - a[1]);
  return { total: JSON.stringify(save).length, top };
}

const ms = (fn: () => void, n = 20): number => {
  const t = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t) / n;
};

describe.skipIf(!ON)("C1 perf probe", () => {
  it("save size and write costs by season", () => {
    const rows: string[] = [];
    let prev: CareerSave | null = null;
    let xp = 0;
    let dayMs: number[] = [];
    let last = performance.now();
    const perSeasonXp: number[] = [];
    const career = playArcCareer({
      region: "SAM",
      difficulty: "normal",
      policy: "tuned",
      seed: 20_901,
      seasons: SEASONS,
      onDay: (save) => {
        const now = performance.now();
        dayMs.push(now - last);
        if (prev) xp += careerXpBetween(prev, save).total;
        prev = structuredClone(save);
        last = performance.now();
      },
      onSeason: (moment, save) => {
        if (moment !== "end") return;
        const s = sizes(save);
        const sorted = [...dayMs].sort((a, b) => a - b);
        const avg = dayMs.reduce((n, v) => n + v, 0) / Math.max(1, dayMs.length);
        rows.push(
          [
            `S${save.clock.seasonIndex}`,
            `save ${(s.total / 1024).toFixed(0)} KB`,
            `clone ${ms(() => structuredClone(save)).toFixed(2)} ms`,
            `stringify ${ms(() => JSON.stringify(save)).toFixed(2)} ms`,
            `day avg ${avg.toFixed(1)} ms p95 ${(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1)} max ${(sorted[sorted.length - 1] ?? 0).toFixed(0)}`,
            `xp ${xp}`,
            `top: ${s.top.slice(0, 7).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)}`).join(", ")}`,
          ].join(" | "),
        );
        if (save.clock.seasonIndex === 0 || save.clock.seasonIndex === SEASONS - 1) {
          rows.push(`   views S${save.clock.seasonIndex} (ms): ${viewCosts(save)}`);
          const w = Object.entries(save.world as unknown as Record<string, unknown>)
            .map(([k, v]): [string, number] => [k, JSON.stringify(v ?? null).length])
            .sort((a, b) => b[1] - a[1]);
          rows.push(`   world S${save.clock.seasonIndex} (KB): ${w.slice(0, 8).map(([k, v]) => `${k} ${(v / 1024).toFixed(1)}`).join(", ")}`);
        }
        perSeasonXp.push(xp);
        xp = 0;
        dayMs = [];
      },
    });
    const out = rows.join("\n") + `\nended=${career.ended} softlock=${career.softlock}\n`;
    if (process.env.C1_PERF_OUT) writeFileSync(process.env.C1_PERF_OUT, out);
    console.log("\n" + out);
    expect(career.softlock).toBeNull();
  }, 900_000);
});
