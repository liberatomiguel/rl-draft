/**
 * v2.0 (C1) — integration regressions of the launch session's engine work:
 * Season X's cancelled Worlds, the headline flag, the contracted market
 * preview, the sponsor's free bootcamp, coaches (renewal, growth, DEV-03),
 * the career's profile XP and the save's size.
 */
import { describe, expect, it } from "vitest";
import { CAREER_CANCELLED_WORLDS } from "@/config/balance";
import { officialEventDefsForWeek, worldsCancelledIn } from "@/engine/career/calendar";
import { HEADLINE_BEATS, isHeadline } from "@/engine/career/communications";
import { SEASON_GOAL_CANDIDATES } from "@/engine/career/seasonGoals";
import type { CareerSave } from "@/engine/career/types";
import { CAREER_BEATS } from "@/data/career/beats";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { CAREER_UNLOCKS } from "@/config/balance";
import { signableOverallCap } from "@/engine/career/economy";
import { listingFor } from "@/engine/career/market";
import { playArcCareer } from "./careerArcBot";
import { createCareerSave, signingPlanFor, type CreateCareerInput } from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "C1 Test",
    abbrev: "C1T",
    managerName: "Bot",
    country: "BR",
    region: "SAM",
    crestId: "shield",
    colors: { primary: "#f97316", secondary: "#fde68a" },
    buffType: "consistency",
  },
  difficulty: "normal",
  style: "balanced",
  rosterKey: "balanced",
};

describe("v2.0 (C1) — Season X: Worlds cancelled", () => {
  it("the calendar has no Worlds event in Season X and has one from the next season", () => {
    expect(CAREER_CANCELLED_WORLDS.seasonIndexes).toEqual([0]);
    expect(worldsCancelledIn(0)).toBe(true);
    expect(officialEventDefsForWeek(0, 32)).toEqual([]);
    expect(officialEventDefsForWeek(1, 32).map((d) => d.tier)).toEqual(["worlds"]);
  });

  it("two seasons play through with no softlock: Season X ends in its review with no champion, the news is a headline, 2021-22 has its Worlds", () => {
    const ends: CareerSave[] = [];
    const starts: CareerSave[] = [];
    const career = playArcCareer({
      region: "SAM",
      difficulty: "normal",
      policy: "tuned",
      seed: 20_301,
      seasons: 2,
      onSeason: (moment, save) => (moment === "end" ? ends : starts).push(structuredClone(save)),
    });
    expect(career.softlock).toBeNull();
    expect(career.ended).toBeNull();
    expect(career.seasons).toHaveLength(2);
    const x = ends[0];
    expect(x.clock.seasonIndex).toBe(0);
    expect(x.phase).toBe("seasonReview");
    // No Worlds was played or simulated, and nobody is its champion.
    expect(x.eventResults.some((r) => r.seasonIndex === 0 && r.tier === "worlds")).toBe(false);
    expect((x.honors ?? []).some((h) => h.seasonIndex === 0 && h.tier === "worlds")).toBe(false);
    expect(x.stats.worldsQualified).toBe(0);
    expect(x.stats.titlesWorlds).toBe(0);
    // The Majors still ran (the results buffer keeps the latest of them).
    expect(x.eventResults.filter((r) => r.seasonIndex === 0 && r.tier === "major").length).toBeGreaterThanOrEqual(2);
    // The bombshell: on the wire, flagged for the pop-up, worded in both languages.
    const news = x.news.find((n) => n.titleKey === "worldsCancelled");
    expect(news?.headline).toBe(true);
    expect(CAREER_EN.news.tpl.worldsCancelled()).toMatch(/pandemic/);
    expect(CAREER_PT.news.tpl.worldsCancelled()).toMatch(/pandemia/);
    expect(CAREER_EN.news.body.worldsCancelled().length).toBeGreaterThan(40);
    expect(CAREER_PT.news.body.worldsCancelled().length).toBeGreaterThan(40);
    // The board never asked for a Worlds result that season.
    const plan = starts[0].seasonGoals?.plan;
    for (const g of [plan?.target, plan?.stretch]) expect(g?.kind.startsWith("worlds")).not.toBe(true);
    // The next season is whole again.
    const next = ends[1];
    expect(next.clock.seasonIndex).toBe(1);
    expect(next.eventResults.some((r) => r.seasonIndex === 1 && r.tier === "worlds")).toBe(true);
    expect(next.news.some((n) => n.seasonIndex === 1 && n.titleKey === "worldsCancelled")).toBe(false);
  }, 120_000);

  it("the goal table still offers Worlds goals (other seasons)", () => {
    expect(SEASON_GOAL_CANDIDATES.some((c) => c.kind === "worldsQualify")).toBe(true);
  });
});

describe("v2.0 (C1) — headline news", () => {
  it("every headline beat exists, and only live beats, the cancellation and non-purchasable unlocks are headlines", () => {
    const ids = new Set(CAREER_BEATS.map((b) => b.id));
    for (const id of HEADLINE_BEATS) expect(ids.has(id), id).toBe(true);
    expect(isHeadline({ titleKey: "beat", beatId: "s3-vitality-zen" })).toBe(true);
    expect(isHeadline({ titleKey: "beat", beatId: "sx-bds-rise" })).toBe(true);
    expect(isHeadline({ titleKey: "beatArchive", beatId: "s3-vitality-zen" })).toBe(false);
    expect(isHeadline({ titleKey: "worldsCancelled" })).toBe(true);
    expect(isHeadline({ titleKey: "unlock", params: { name: "coach" } })).toBe(true);
    expect(isHeadline({ titleKey: "unlock", params: { name: "sponsors2" } })).toBe(true);
    expect(isHeadline({ titleKey: "unlock", params: { name: "bootcamp1" } })).toBe(false);
    expect(isHeadline({ titleKey: "transfer" })).toBe(false);
  });
});

describe("v2.0 (C1) — the contracted market before reputation 20", () => {
  it("contracted players are listed and flagged locked; the offer is still refused; from the gate the flag is gone", () => {
    const save = createCareerSave(INPUT, 20_501);
    const ctx = { world: save.world, squadIds: save.squad.map((p) => p.id), seasonIndex: 0, careerSeed: save.careerSeed, signableCap: signableOverallCap(5) };
    const early = listingFor({ ...ctx, freeAgentsOnly: 5 < CAREER_UNLOCKS.contractedRep });
    expect(early.contracted.length).toBeGreaterThan(20);
    expect(early.contracted.every((c) => c.locked === "contractedRep")).toBe(true);
    const open = listingFor({ ...ctx, freeAgentsOnly: false });
    expect(open.contracted.map((c) => c.view.id)).toEqual(early.contracted.map((c) => c.view.id));
    expect(open.contracted.some((c) => c.locked !== undefined)).toBe(false);
    expect(listingFor({ ...ctx, skipContracted: true }).contracted).toEqual([]);
    // The purchase stays shut under the gate, whatever the page shows.
    save.reputation = CAREER_UNLOCKS.contractedRep - 1;
    const res = signingPlanFor(save, early.contracted[early.contracted.length - 1].view.id, { lengthSeasons: 1 });
    expect("error" in res ? res.error : null).toBe("contractedRep");
  });
});
