/**
 * rc.35 (front T, Miguel's playtest): "a player sometimes stops growing, then
 * resumes". Root cause: model 2's season cap (CAREER_DEV.seasonGainCap) was a
 * hard stop — a prospect on a package (+ gear, Training Weeks, match XP) banks
 * the 7 points weeks before the rollover and reads flat until the new season.
 * The cap now spreads the room left over the days left, so growth slows but
 * never stops while a gap remains — and the season total still holds.
 */
import { describe, expect, it } from "vitest";
import { CAREER_CALENDAR, CAREER_DEV, CAREER_TRAINING } from "@/config/balance";
import { applyMatchXp, seasonYear, trainDay } from "./development";
import type { SquadPlayer } from "./types";

const kid = (): SquadPlayer => ({
  id: "rook:1:EU:7",
  kind: "fictional",
  name: "Kid",
  region: "EU",
  birthYear: seasonYear(1) - 15,
  archetype: "allround",
  overall: 64,
  attrOffsets: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 },
  potential: 94,
  peakAge: 20,
  declineRate: "normal",
  role: "starter",
  salaryPerSplit: 1_000,
  contractEndSeason: 9,
  trainingFocus: "auto",
  trainingIntensity: "normal",
  scoutLevel: 0,
  splitsTogether: 0,
  joinedSeason: 1,
  gainedThisSplit: 0,
  gainedThisSeason: 0,
});

describe("rc.35 — no flat stretch inside a season (the season cap spreads, never stops)", () => {
  it("a prospect on a strong package keeps growing every week of the season", () => {
    let p = kid();
    let flatWeeks = 0;
    for (let week = 1; week <= CAREER_CALENDAR.weeksPerSeason; week++) {
      const before = p.overall;
      for (let dow = 1; dow <= CAREER_TRAINING.trainingDaysPerWeek; dow++) {
        p = trainDay(p, {
          seasonIndex: 1,
          coachOverall: null,
          gearBonus: 0.2,
          trainingWeekBonus: week % 2 === 1,
          splitGained: p.gainedThisSplit,
          seasonGained: p.gainedThisSeason,
          model: 2,
          careerSeed: 4242,
          day: (week - 1) * 7 + dow,
          aging: true,
          packageMult: 1.35,
        }).player;
      }
      if (week % 2 === 0) {
        p = applyMatchXp(p, { seasonIndex: 1, fieldQuality: 0.85, isSub: false, coachOverall: null, gearBonus: 0.2, seriesPlayed: 4, model: 2, day: week * 7, careerSeed: 4242 });
      }
      if (p.overall - before < 0.005) flatWeeks++;
    }
    expect(flatWeeks).toBe(0);
    expect(p.gainedThisSeason).toBeLessThanOrEqual(CAREER_DEV.seasonGainHardCap + 1e-9);
  });
});
