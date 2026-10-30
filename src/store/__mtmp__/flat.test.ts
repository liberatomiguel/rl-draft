import { it } from "vitest";
import { CAREER_CALENDAR, CAREER_DEV, CAREER_TRAINING } from "@/config/balance";
import { applyMatchXp, seasonYear, trainDay } from "@/engine/career/development";
import type { SquadPlayer } from "@/engine/career/types";

const kid = (): SquadPlayer => ({
  id: "rook:1:EU:7", kind: "fictional", name: "Kid", region: "EU", birthYear: seasonYear(1) - 15, archetype: "allround",
  overall: 64, attrOffsets: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 },
  potential: 94, peakAge: 20, declineRate: "normal", role: "starter", salaryPerSplit: 1_000, contractEndSeason: 9,
  trainingFocus: "auto", trainingIntensity: "normal", scoutLevel: 0, splitsTogether: 0, joinedSeason: 1, gainedThisSplit: 0, gainedThisSeason: 0,
});

it("flat weeks", () => {
  const D = CAREER_DEV as unknown as Record<string, number>;
  for (const combo of JSON.parse(process.env.FX ?? "[{}]") as Record<string, number>[]) {
    const saved: Record<string, number> = {};
    for (const [k, v] of Object.entries(combo)) { saved[k] = D[k]; D[k] = v; }
    let p = kid();
    const gains: string[] = [];
    let flat = 0;
    for (let week = 1; week <= CAREER_CALENDAR.weeksPerSeason; week++) {
      const before = p.overall;
      for (let dow = 1; dow <= CAREER_TRAINING.trainingDaysPerWeek; dow++) {
        p = trainDay(p, { seasonIndex: 1, coachOverall: null, gearBonus: 0.2, trainingWeekBonus: week % 2 === 1, splitGained: p.gainedThisSplit, seasonGained: p.gainedThisSeason, model: 2, careerSeed: 4242, day: (week - 1) * 7 + dow, aging: true, packageMult: 1.35 }).player;
      }
      if (week % 2 === 0) p = applyMatchXp(p, { seasonIndex: 1, fieldQuality: 0.85, isSub: false, coachOverall: null, gearBonus: 0.2, seriesPlayed: 4, model: 2, day: week * 7, careerSeed: 4242 });
      const g = p.overall - before;
      if (g < 0.005) flat++;
      gains.push(g.toFixed(3));
    }
    console.log(JSON.stringify(combo), "flat", flat, "total", p.gainedThisSeason.toFixed(2), gains.join(" "));
    for (const [k, v] of Object.entries(saved)) D[k] = v;
  }
});
