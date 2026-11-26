/**
 * v2.2 Pro (PRO-SPEC §4.1 targets, R150): a bot plays twelve seasons of weeks
 * and rollovers on the pure modules (week, ranked, match XP, aging) for three
 * profiles and reports the peak overall. It checks the ORDER of the profiles
 * (talent and care both matter) and prints the numbers against the spec's
 * targets. It does not retune slice 1's growth: the gap is reported.
 *
 * What the bot is NOT: no org offers, no benching, no real calendar. From the
 * week he reaches Grand Champion it gives him a team and a 85 coach, and one
 * official series (three games) a week at regional level, rated by his own
 * overall against an opponent of his level. That is the generous end of the
 * Normal difficulty and says so in the printout.
 */

import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR } from "@/config/balance";
import { createProSave } from "./create";
import { applyMatchXp, proAgeOf, proOverall } from "./growth";
import { cupsUnlocked } from "./ranked";
import { rolloverProPlayer, applyWeekToSave, nextWeekClock } from "./weekFlow";
import { coachPlanFor } from "./week";
import type { CreateProInput, ProSave, ProWeekPlan } from "./types";

const INPUT: CreateProInput = { name: "Bot", country: "br", region: "SAM", startAge: 13, archetype: "allround", difficulty: "normal" };
const SEASONS = 12;

type Behaviour = "managed" | "careless";

function playCareer(seed: number, talent: number, behaviour: Behaviour): { peak: number; peakAgeSeen: number; end: number; weeksToGc: number } {
  let save: ProSave = createProSave(INPUT, seed, "bot");
  save = { ...save, player: { ...save.player, talent } };
  let weeksToGc = -1;
  const total = SEASONS * CAREER_CALENDAR.weeksPerSeason;
  for (let w = 0; w < total && save.stage !== "retired"; w++) {
    if (weeksToGc < 0 && cupsUnlocked(save.player)) {
      weeksToGc = w;
      save = { ...save, stage: "org", team: { kind: "org", ref: "bot-org" } };
    }
    const ctx = { seasonIndex: save.clock.seasonIndex, hasTeam: save.team !== null, careerSeed: save.careerSeed, coachOverall: save.team ? 85 : undefined };
    const plan: ProWeekPlan =
      behaviour === "managed"
        ? coachPlanFor(save.player, ctx)
        : save.team
          ? [{ kind: "content" }, { kind: "scrim" }, { kind: "content" }]
          : [{ kind: "content" }, { kind: "ranked" }, { kind: "content" }];
    const applied = applyWeekToSave(save, plan, ctx.coachOverall);
    save = applied.save;
    if (save.team) {
      // One series a week: three games at regional level, rated by form and level.
      let p = save.player;
      const level = proOverall(p.attrs);
      for (let g = 0; g < 3; g++) {
        p = applyMatchXp(p, {
          rating: Math.min(9.5, Math.max(3, 6 + (level - 80) * 0.08 + p.confidence * 0.3)),
          opponentStrength: level,
          tier: "regional",
          seasonIndex: save.clock.seasonIndex,
          day: save.clock.day,
        }).player;
      }
      save = { ...save, player: p };
    }
    const next = nextWeekClock(save.clock);
    save = { ...save, clock: next.clock };
    if (next.rolledOver) save = rolloverProPlayer(save).save;
  }
  return {
    peak: save.player.peakOverall ?? proOverall(save.player.attrs),
    peakAgeSeen: proAgeOf(save.player, save.clock.seasonIndex),
    end: proOverall(save.player.attrs),
    weeksToGc,
  };
}

const SEEDS = [101, 202, 303, 404, 505];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("Pro lifecycle bot (spec §4.1 targets)", () => {
  const run = (talent: number, behaviour: Behaviour) => SEEDS.map((s) => playCareer(s, talent, behaviour));

  it("peak overall by profile: high talent managed > average managed > average careless", () => {
    const high = run(1.15, "managed");
    const avg = run(1.0, "managed");
    const careless = run(1.0, "careless");
    const peaks = (rs: ReturnType<typeof run>) => rs.map((r) => r.peak.toFixed(1)).join(", ");
    console.log(
      [
        "PRO BOT, 12 seasons, 5 seeds (managed = the coach's plan, team + 85 coach + one regional series a week from Grand Champion):",
        `  high talent, managed : peaks ${peaks(high)}  mean ${mean(high.map((r) => r.peak)).toFixed(1)}   (target 96-99)`,
        `  average, managed     : peaks ${peaks(avg)}  mean ${mean(avg.map((r) => r.peak)).toFixed(1)}   (target 90-93)`,
        `  average, careless    : peaks ${peaks(careless)}  mean ${mean(careless.map((r) => r.peak)).toFixed(1)}   (target 82-86)`,
        `  weeks to Grand Champion (managed avg): ${avg.map((r) => r.weeksToGc).join(", ")}; careless: ${careless.map((r) => r.weeksToGc).join(", ")}`,
      ].join("\n"),
    );
    expect(mean(high.map((r) => r.peak))).toBeGreaterThan(mean(avg.map((r) => r.peak)));
    expect(mean(avg.map((r) => r.peak))).toBeGreaterThan(mean(careless.map((r) => r.peak)) + 3);
    for (const r of [...high, ...avg, ...careless]) {
      expect(r.peak).toBeLessThanOrEqual(99);
      expect(r.peak).toBeGreaterThan(50);
    }
  }, 120_000);
});
