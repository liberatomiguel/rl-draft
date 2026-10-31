import { describe, expect, it } from "vitest";
import { CAREER_PRIZES, CAREER_SPONSOR, CAREER_UNOFFICIAL } from "@/config/balance";
import { prizeFor, prizePoolPaidFor, prizeScheduleFor } from "@/engine/career/economy";
import { quoteDeal } from "@/engine/career/sponsorDeals";
import { localSceneSeasonRating } from "@/engine/career/worldSim";
import { prioritizeScrimVariety, simplePackageOf } from "@/engine/career/training";
import type { CareerSave } from "@/engine/career/types";
import { advanceDayFlow, coachCandidatesFor, createCareerSave, finishEvent, isEventPaused, resolveInsertFlow, rolloverToNextSeason, simEventToEnd, startEvent } from "./careerFlow";
import { continueTrainingReportFlow, setTrainingPackageFlow, trainingReportOf } from "./careerTraining";
import { walkPastForTests } from "./careerClockForTests";

const input = { identity: { orgName: "Feedback", abbrev: "FDB", managerName: "Tester", country: "BR", region: "SAM" as const,
  crestId: "shield", colors: { primary: "#f97316", secondary: "#102050" }, buffType: "consistency" as const },
  difficulty: "normal" as const, rosterKey: "prospects" as const, prefs: { autoEnterUnofficials: false } };

describe("rc.36.5 — readable growing prizes", () => {
  it.each([ ["t3", "single"], ["t2", "single"], ["qualifier", "swissOnly"], ["regional", "swiss"], ["major", "swiss"], ["worlds", "swiss"] ] as const)("%s preserves the paid budget and increases every placement in round steps", (tier, format) => {
    const counts = format === "single" ? { champion:1, runner_up:1, top4:2, top8:4 }
      : format === "swissOnly" ? { top8:8, swiss_exit:8 }
      : { champion:1, runner_up:1, third:1, fourth:1, top6:2, top8:2, swiss_exit:8 };
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      let previous: Record<string, number> | null = null;
      let previousPool = 0;
      for (let season = 0; season < 12; season++) {
        const schedule = prizeScheduleFor(tier, format, difficulty, season);
        const total = Object.entries(counts).reduce((sum, [place, count]) => sum + schedule[place] * count, 0);
        expect(total).toBe(prizePoolPaidFor(tier, format, difficulty, season));
        expect(total % CAREER_PRIZES.poolQuantum[tier]).toBe(0);
        expect(total).toBeGreaterThan(previousPool);
        for (const [place, amount] of Object.entries(schedule)) {
          expect(amount % CAREER_PRIZES.payoutQuantum[tier]).toBe(0);
          expect(amount).toBeGreaterThan(previous?.[place] ?? 0);
        }
        previous = schedule; previousPool = total;
      }
    }
    expect(prizeFor(tier, "champion", format, "easy")).toBeGreaterThan(prizeFor(tier, "champion", format, "hard"));
  });
});

it("new sponsor profiles have the same one-season horizon and ascending potential totals", () => {
  expect(Object.values(CAREER_SPONSOR.profiles).map(p => p.lengthSplits)).toEqual([3, 3, 3]);
  for (const tier of [1,2,3,4] as const) for (const difficulty of ["easy", "normal", "hard"] as const)
    for (const seasonIndex of [0,1,3,5]) for (const valueShare of [0.4,0.7,1]) {
      const quotes = (["steady", "balanced", "bold"] as const).map(profile => quoteDeal({ profile, tier, seasonIndex, difficulty, valueShare, mondays:32, goals:3 }));
      expect(quotes[1].ceiling).toBeGreaterThan(quotes[0].ceiling);
      expect(quotes[2].ceiling).toBeGreaterThan(quotes[1].ceiling);
      expect(quotes[1].weekly).toBeGreaterThanOrEqual(quotes[0].weekly);
      expect(quotes[2].weekly).toBeGreaterThanOrEqual(quotes[1].weekly);
    }
});

it("weekly scrim variety prefers fresh partners while permitting occasional rematches", () => {
  const pool = [{ ref:"a" }, { ref:"b" }, { ref:"c" }];
  expect(prioritizeScrimVariety(pool, new Set(["a"]), 0.99)).toEqual(pool.slice(1));
  expect(prioritizeScrimVariety(pool, new Set(["a"]), 0)).toEqual(pool);
  expect(prioritizeScrimVariety(pool, new Set(["a","b","c"]), 0.99)).toEqual(pool);
});

it("local opponents keep their own development curve when the manager upgrades the team", () => {
  const origin = { rating:70, seasonIndex:0 };
  expect(localSceneSeasonRating(70, origin, 0)).toBe(70);
  expect(localSceneSeasonRating(82, origin, 1)).toBe(70 + CAREER_UNOFFICIAL.localSceneGrowthPerSeason!);
  expect(localSceneSeasonRating(90, origin, 1)).toBe(localSceneSeasonRating(82, origin, 1));
  const save = createCareerSave(input, 365);
  save.competition.localAnchor = { region:"SAM", rating:72 };
  const next = rolloverToNextSeason({ ...save, phase:"seasonReview" });
  expect(next.competition.localOrigin).toEqual({ region:"SAM", rating:72, seasonIndex:0 });
  expect(next.competition.localAnchor ?? null).toBeNull();
});

function step(inputSave: CareerSave): CareerSave {
  let save = walkPastForTests(inputSave);
  if (save.pendingInsert?.day === save.clock.day) save = resolveInsertFlow(save, "b").save;
  if (save.activeEvent) {
    save = simEventToEnd(save);
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
  } else if (save.pendingEventDef?.day === save.clock.day) {
    save = simEventToEnd(startEvent(save, false));
    if (!isEventPaused(save) && save.activeEvent?.tournament.stage === "finished") save = finishEvent(save);
  }
  return advanceDayFlow(walkPastForTests(save));
}

it.each([false, true])("Continue repeats the completed cycle without paying it twice, coach=%s", (hasCoach) => {
  let save = createCareerSave(input, 3651);
  if (hasCoach) save.coach = coachCandidatesFor(save)[0];
  const pkg = simplePackageOf({ objective:"development", workload:"normal", scrims:"even", focus:"mechanics-lab" });
  save = setTrainingPackageFlow(save, pkg).save;
  for (let k = 0; k < 100 && !trainingReportOf(save); k++) save = step(save);
  const report = trainingReportOf(save);
  expect(report?.package).toEqual(pkg);
  const before = structuredClone(save);
  const continued = continueTrainingReportFlow(save).save;
  expect(continued.training?.plan?.package).toEqual(pkg);
  expect(continued.training?.plan?.author).toBe("user");
  expect(continued.squad).toEqual(before.squad);
  expect(continued.training?.history).toEqual(before.training?.history);
  expect(trainingReportOf(continued)).toBeNull();
  expect(continueTrainingReportFlow(continued).save).toBe(continued);
}, 120_000);
