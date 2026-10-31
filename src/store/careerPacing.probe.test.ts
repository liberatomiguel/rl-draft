/** Opt-in matched-seed career timing probe. Ordinals in reports are 1-based.
 * PACING=1 PACING_OUT=... PACING_REGIONS=... PACING_DIFFS=... PACING_SEEDS=2
 * PACING_POLICIES=autopilot,tuned,youth,spender PACING_SLICE=0/4
 * Candidate prospects use the visible scouting band; observers never change saves.
 */
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { BALANCE_VERSION, CAREER_SEASONS, CAREER_UNLOCKS } from "@/config/balance";
import { splitOfWeek, weekOfDay } from "@/engine/career/calendar";
import type { CareerDifficulty } from "@/engine/career/types";
import type { Region } from "@/engine/types";
import { playArcCareer, type ArcCareer, type ArcPolicyId } from "./careerArcBot";
import { backerLineOf, weeklyStatementOf } from "./careerFlow";

const env = process.env;
const list = <T extends string>(value: string | undefined, defaults: T[]): T[] => value ? value.split(",") as T[] : defaults;

it.skipIf(!env.PACING)("measures first milestones, split-level outcomes and founding liquidity", () => {
  const regions = list<Region>(env.PACING_REGIONS, ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"]);
  const diffs = list<CareerDifficulty>(env.PACING_DIFFS, ["easy", "normal", "hard"]);
  const policies = list<ArcPolicyId>(env.PACING_POLICIES, ["autopilot", "tuned", "youth", "spender"]);
  const [slice, slices] = (env.PACING_SLICE ?? "0/1").split("/").map(Number);
  const cells = regions.flatMap(region => diffs.flatMap(difficulty => policies.flatMap(policy =>
    Array.from({ length: Number(env.PACING_SEEDS ?? 2) }, (_, k) => ({ region, difficulty, policy, seed: 9100 + 7919 * k })))));
  const careers: (ArcCareer & { events: EventRow[]; checkpoints: Checkpoint[] })[] = [];
  for (const [i, cell] of cells.entries()) {
    if (i % slices !== slice) continue;
    const events: EventRow[] = [];
    const checkpoints: Checkpoint[] = [];
    const seen = new Set<string>();
    const career = playArcCareer({ ...cell, seasons: Number(env.PACING_SEASONS ?? 8), budgetMs: 300_000,
      onDay(save) {
        const season = save.clock.seasonIndex;
        const week = weekOfDay(save.clock.day);
        const key = `${season}:${week}`;
        if (seen.has(key)) return;
        seen.add(key);
        const statement = weeklyStatementOf(save);
        checkpoints.push({ season, week, split: splitOfWeek(week), balance: save.finances.balance,
          net: statement.net, rep: save.reputation, floor: backerLineOf(save).floor,
          debt: save.finances.loan?.remaining ?? 0, emergencyLoans: save.finances.emergencyLoans ?? 0,
          overalls: save.squad.filter(p => p.role !== "sub").map(p => p.overall) });
      },
      onSeason(moment, save) {
        if (moment !== "end") return;
        for (const r of save.eventResults) {
          if (r.seasonIndex !== save.clock.seasonIndex || !r.userPlacement) continue;
          events.push({ season: r.seasonIndex, split: r.split ?? null, week: r.week, tier: r.tier, placement: r.userPlacement });
        }
      },
    });
    careers.push({ ...career, events, checkpoints });
    if (env.PACING_OUT) writeFileSync(env.PACING_OUT, JSON.stringify({ balanceVersion: BALANCE_VERSION, timelineSeasons: CAREER_SEASONS.length, marketGate: { base: CAREER_UNLOCKS.signableCapBase, slope: CAREER_UNLOCKS.signableCapPerRep }, careers }));
  }
  console.log(`Pacing: ${careers.length} careers, softlocks ${careers.filter(c => c.softlock).length}`);
}, 7_200_000);

interface EventRow { season: number; split: number | null; week: number; tier: string; placement: string }
interface Checkpoint { season: number; week: number; split: number | null; balance: number; net: number; rep: number; floor: number; debt: number; emergencyLoans: number; overalls: number[] }
