/**
 * rc.36 (ROADMAP UX-02 and UX-03, R87) through the real flow: the season goal
 * is set once at the season's start and never moves, settles at the review
 * (target and stretch), an rc.35 save keeps its current goal, and a beat the
 * save contradicts files "From the archive" without its effect.
 */

import { describe, expect, it } from "vitest";
import { CAREER_SEASON_GOAL } from "@/config/balance";
import { seasonGoalMetAtReview, seasonGoalsViewOf } from "@/engine/career/seasonGoals";
import { seasonGoalMetOf, seasonGoalModelFor } from "@/engine/career/sponsorDeals";
import type { CareerSave, SeasonGoalPlan } from "@/engine/career/types";
import { playArcCareer } from "./careerArcBot";
import { advanceDayFlow, createCareerSave, enterSeasonReview, migrateSaveToV5, sponsorLevelOf } from "./careerFlow";

const INPUT = {
  identity: {
    orgName: "Goal Org",
    abbrev: "GOL",
    managerName: "Bot",
    country: "BR",
    region: "SAM" as const,
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency" as const,
  },
  difficulty: "normal" as const,
  rosterKey: "balanced" as const,
};

describe("UX-02 — the season goal through the flow", () => {
  it("a new career's goal is the founding season's plan, with a harder stretch", () => {
    const save = createCareerSave(INPUT, 4242);
    const plan = save.seasonGoals?.plan;
    expect(CAREER_SEASON_GOAL.rule).toBe("season");
    expect(plan).toBeTruthy();
    expect(plan!.seasonIndex).toBe(0);
    expect(plan!.basis.stage).toBe("founding");
    expect(plan!.stretch.chance).toBeLessThan(plan!.target.chance);
    expect(save.seasonGoals?.model).toBeUndefined();
    const view = seasonGoalsViewOf(save)!;
    expect(view.target.label.scope).toBe("season");
    expect(view.target.deadline).not.toBeNull();
    expect(view.target.progress).toMatchObject({ done: 0, hit: false, out: false });
  });

  it("the goal never moves inside a season, settles at the review, and the next season reads it", { timeout: 120_000 }, () => {
    const starts: SeasonGoalPlan[] = [];
    const ends: { plan: SeasonGoalPlan; targetMet: boolean | null; stretchMet: boolean | null; expect: [boolean, boolean] }[] = [];
    playArcCareer({
      region: "SAM",
      difficulty: "normal",
      policy: "tuned",
      seed: 31337,
      seasons: 2,
      onSeason: (moment, save: CareerSave) => {
        const plan = save.seasonGoals!.plan!;
        if (moment === "start") starts.push(structuredClone(plan));
        else
          ends.push({
            plan: structuredClone(plan),
            targetMet: save.seasonGoals!.targetMet,
            stretchMet: save.seasonGoals!.stretchMet ?? null,
            expect: [seasonGoalMetAtReview(plan.target, save), seasonGoalMetAtReview(plan.stretch, save)],
          });
      },
    });
    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);
    for (let s = 0; s < 2; s++) {
      // Fixed at the start: every result of the season left it as it was.
      expect(ends[s].plan).toEqual(starts[s]);
      expect(ends[s].targetMet).toBe(ends[s].expect[0]);
      expect(ends[s].stretchMet).toBe(ends[s].expect[1]);
    }
    expect(starts[1].seasonIndex).toBe(1);
    expect(starts[1].basis.stage).not.toBe("founding");
    expect(starts[1].basis.last).toBe(ends[0].targetMet ? "met" : "missed");
  });

  it("an rc.35 save keeps its current goal: no plan on load, settled on rc.35's rule", () => {
    const save = createCareerSave(INPUT, 777);
    const { target, stretch } = seasonGoalModelFor(sponsorLevelOf(save), 0);
    const strip = (g: typeof target) => ({ kind: g.kind, count: g.count, word: g.word, ...(g.place !== undefined ? { place: g.place } : {}) });
    const rc35 = structuredClone(save);
    delete rc35.seasonGoals!.plan;
    delete rc35.seasonGoals!.stretchMet;
    rc35.seasonGoals!.model = { target: strip(target), stretch: strip(stretch) };
    const loaded = migrateSaveToV5(structuredClone(rc35))!;
    expect(loaded.seasonGoals!.plan).toBeUndefined();
    expect(loaded.seasonGoals!.model).toEqual(rc35.seasonGoals!.model);
    expect(seasonGoalsViewOf(loaded)!.target.label.scope).toBe("split");
    enterSeasonReview(loaded, null);
    expect(loaded.seasonGoals!.targetMet).toBe(seasonGoalMetOf(loaded.seasonGoals!.model!.target, 0, loaded.eventResults));
    expect(loaded.seasonGoals!.stretchMet).toBe(false);
  });
});

describe("UX-03 — a beat the save contradicts files as archive", () => {
  it("BDS out of Europe's top three: 'That BDS roster is turning heads' runs as archive", () => {
    const save = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region: "EU" as const } }, 99);
    // Week 4's Sunday → Monday of week 5 (the beat's trigger).
    save.clock = { seasonIndex: 0, day: 28 };
    save.pendingEventDef = null;
    save.activeEvent = null;
    expect(save.world.orgs["team-bds"]).toBeTruthy();
    save.world.orgs["team-bds"].rating = 50;
    const next = advanceDayFlow(save);
    expect(next.clock.day).toBe(29);
    const item = next.news.find((n) => n.beatId === "sx-bds-rise");
    expect(item?.titleKey).toBe("beatArchive");
    expect(next.firedBeatIds).toContain("sx-bds-rise");
  });

  it("the same Monday with BDS on top runs it live", () => {
    const save = createCareerSave({ ...INPUT, identity: { ...INPUT.identity, region: "EU" as const } }, 99);
    save.clock = { seasonIndex: 0, day: 28 };
    save.pendingEventDef = null;
    save.activeEvent = null;
    save.world.orgs["team-bds"].rating = 99;
    const next = advanceDayFlow(save);
    expect(next.news.find((n) => n.beatId === "sx-bds-rise")?.titleKey).toBe("beat");
  });
});
