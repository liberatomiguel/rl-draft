/**
 * v2.2 board front: the takeover, the board's season, the ultimatum and
 * dismissal, a job offer's move, and an older save's first board — with
 * FEATURES.board and FEATURES.realOrgStart on.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { CAREER_BOARD } from "@/config/balance";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import type { CareerSave } from "@/engine/career/types";
import { advanceDayFlow, createCareerSave, enterSeasonReview, rolloverToNextSeason, type CreateCareerInput } from "./careerFlow";
import { pendingDecisionsOf, rolloverHoldOf } from "./careerDecisions";
import {
  acceptJobOfferFlow,
  boardAutoAnswer,
  boardOnSplitBoundary,
  chooseBoardPackageFlow,
  pendingJobChoiceOf,
  pendingPackageOf,
} from "./boardFlow";
import { playArcCareer } from "./careerArcBot";

const SEED = 4242;

function input(region: "NA" | "EU" | "SAM", realOrgRef?: string): CreateCareerInput {
  return {
    identity: {
      orgName: "Test Club",
      abbrev: "TST",
      managerName: "Manager",
      country: "US",
      region,
      crestId: "shield",
      colors: { primary: "#f97316", secondary: "#ffffff" },
      buffType: "offense",
    },
    difficulty: "normal",
    rosterKey: "balanced",
    ...(realOrgRef ? { realOrgRef } : {}),
  };
}

function choices(region: "NA" | "EU" | "SAM") {
  let world = buildWorldAtCreation(SEED);
  world = computeStars(world, { seasonIndex: 0, careerSeed: SEED, difficulty: "normal" });
  return realOrgChoicesFor(region, { careerSeed: SEED, seasonIndex: 0, difficulty: "normal", world });
}

const aiCount = (save: CareerSave, region: string) => Object.values(save.world.orgs).filter((o) => o.region === region).length;

describe("org stature and the pick screen", () => {
  it("lists the region's real orgs with a stature, a squad and money, strongest first", () => {
    const list = choices("EU");
    expect(list.length).toBeGreaterThan(6);
    expect(list[0].stature).toBe("elite");
    expect(list.some((c) => c.stature === "underdog" || c.stature === "mid")).toBe(true);
    for (const c of list) {
      expect(c.players).toHaveLength(3);
      expect(c.money.startCash).toBeGreaterThan(0);
      expect(c.ref.includes(":")).toBe(false);
    }
    const elite = list.find((c) => c.stature === "elite")!;
    const low = [...list].reverse()[0];
    expect(elite.money.grant).toBeGreaterThan(low.money.grant);
    expect(elite.missCost).toBeGreaterThan(low.missCost);
  });
});

describe("taking over a real org", () => {
  it("takes the org's seat: its roster, no AI duplicate, the region's AI count kept, a board offer that holds day 1", () => {
    const pick = choices("NA")[0];
    const founded = createCareerSave(input("NA"), SEED);
    const save = createCareerSave(input("NA", pick.ref), SEED);
    expect(save.identity.realOrgRef).toBe(pick.ref);
    expect(save.identity.orgName).toBe(pick.name);
    expect(save.world.orgs[pick.ref]).toBeUndefined();
    expect(save.world.userOrgRef).toBe(pick.ref);
    expect(aiCount(save, "NA")).toBe(aiCount(founded, "NA"));
    expect(save.squad.map((p) => p.id).sort()).toEqual(pick.players.map((p) => p.id).sort());
    const aiPlayers = new Set(Object.values(save.world.orgs).flatMap((o) => o.playerIds));
    for (const p of save.squad) {
      expect(aiPlayers.has(p.id)).toBe(false);
      expect(save.world.freeAgentIds).not.toContain(p.id);
    }
    expect(save.board?.kind).toBe("board");
    expect(save.board?.stature).toBe("elite");
    expect(pendingPackageOf(save)).toHaveLength(3);
    expect(pendingDecisionsOf(save).some((d) => d.kind === "board" && d.holds)).toBe(true);
  });

  it("the package: budget paid, its objective becomes the season goal's target, fixed once shown", () => {
    const pick = choices("SAM")[2];
    const save = createCareerSave(input("SAM", pick.ref), SEED);
    const offers = pendingPackageOf(save)!;
    expect(offers.map((o) => o.id)).toEqual(["cautious", "expected", "ambitious"]);
    expect(offers[0].objective.chance).toBeGreaterThanOrEqual(offers[1].objective.chance);
    expect(offers[1].objective.chance).toBeGreaterThanOrEqual(offers[2].objective.chance);
    const before = save.finances.balance;
    const after = chooseBoardPackageFlow(save, "ambitious").save;
    expect(after.finances.balance).toBe(before + offers[2].grant);
    expect(after.seasonGoals?.plan?.target.kind).toBe(offers[2].objective.kind);
    expect(after.seasonGoals?.plan?.target.count).toBe(offers[2].objective.count);
    expect(pendingPackageOf(after)).toBeNull();
    expect(chooseBoardPackageFlow(after, "cautious").error).toBe("none");
  });

  it("plays two seasons at a real org without a soft lock; the org never returns as an AI side", () => {
    const pick = choices("NA")[1];
    let seen: CareerSave | null = null;
    const out = playArcCareer({
      region: "NA",
      difficulty: "normal",
      policy: "autopilot",
      seed: SEED,
      seasons: 2,
      startFrom: createCareerSave(input("NA", pick.ref), SEED),
      onDay: (s) => {
        seen = s;
        if (s.world.orgs[pick.ref]) throw new Error(`back on ${s.clock.seasonIndex}:${s.clock.day} userOrgRef=${s.world.userOrgRef} realOrgRef=${s.identity.realOrgRef}`);
      },
      budgetMs: 240_000,
    });
    expect(out.softlock).toBeNull();
    expect(out.seasons.length).toBe(2);
    expect(seen!.board?.season?.seasonIndex).toBe(1);
    expect(seen!.board?.log.length).toBeGreaterThan(0);
  }, 300_000);
});

describe("warning, ultimatum, dismissal, offers", () => {
  it("never dismisses in the grace season; a failed ultimatum later dismisses at the review with offers, and the move keeps the old club alive", () => {
    const pick = choices("EU")[3];
    let save = boardAutoAnswer(createCareerSave(input("EU", pick.ref), SEED));
    // Season 0: confidence on the floor, warned — but no ultimatum in the grace season.
    save.board!.confidence = 5;
    save.board!.warnedSeason = 0;
    save.clock.day = 10 * 7 + 1;
    boardOnSplitBoundary(save, 11);
    expect(save.board!.ultimatum).toBeNull();
    // Season 1: the ultimatum comes with a mission and a stated chance.
    save.clock = { seasonIndex: 1, day: 1 };
    save.board!.season = { ...save.board!.season!, seasonIndex: 1, checkpoints: [] };
    save.clock.day = 10 * 7 + 1;
    boardOnSplitBoundary(save, 11);
    const u = save.board!.ultimatum!;
    expect(u.status).toBe("open");
    expect(u.objective.chance).toBeGreaterThan(0.3);
    expect(save.mail.some((m) => m.titleKey === "boardWarning" || m.titleKey === "boardUltimatum")).toBe(true);
    // Nothing played since: the review dismisses, offers wait and hold the rollover.
    save.eventResults = [];
    enterSeasonReview(save, null);
    expect(save.board!.dismissedSeason).toBe(1);
    const offers = pendingJobChoiceOf(save)!;
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(offers.some((o) => o.kind === "found")).toBe(true);
    expect(offers.some((o) => o.kind === "org" && o.region === "EU")).toBe(true);
    expect(offers.every((o) => o.ref !== pick.ref)).toBe(true);
    save.flags[`contractsReviewed:1`] = true;
    expect(rolloverHoldOf(save)?.kind).toBe("board");
    const target = offers.find((o) => o.kind === "org")!;
    const oldSquad = save.squad.filter((p) => p.contractEndSeason >= 2).map((p) => p.id);
    save = acceptJobOfferFlow(save, target.id).save;
    expect(rolloverHoldOf(save)?.kind).not.toBe("board");
    save.flags[`contractsReviewed:1`] = true;
    const next = rolloverToNextSeason(save);
    expect(next.identity.realOrgRef).toBe(target.ref);
    expect(next.world.orgs[target.ref!]).toBeUndefined();
    expect(next.world.orgs[pick.ref]).toBeDefined();
    // The club left behind is an AI side again (its real lineup's anchor pass may pull its history back in).
    expect(next.world.orgs[pick.ref].region).toBe("EU");
    expect(next.squad.some((p) => oldSquad.includes(p.id))).toBe(false);
    expect(next.board!.confidence).toBe(CAREER_BOARD.confidence.start);
    expect(next.board!.startSeason).toBe(2);
    expect(next.manager!.spells.map((s) => s.left ?? "now")).toEqual(["dismissed", "now"]);
    expect(pendingPackageOf(next)).toHaveLength(3);
  }, 120_000);
});

describe("older saves", () => {
  it("a save without board fields plays its season with the flags on: nothing is judged before its rollover", () => {
    let save = createCareerSave(input("SAM"), SEED);
    delete save.board;
    delete save.manager;
    for (let i = 0; i < 40; i++) save = advanceDayFlow(boardAutoAnswer(save));
    expect(save.board).toBeUndefined();
    expect(pendingDecisionsOf(save).some((d) => d.kind === "board")).toBe(false);
  });

  it("a save without board fields starts its board at the rollover, at full confidence, judged on nothing before", () => {
    const save = createCareerSave(input("NA"), SEED);
    delete save.board;
    delete save.manager;
    save.phase = "seasonReview";
    save.flags[`contractsReviewed:0`] = true;
    const next = rolloverToNextSeason(save);
    expect(next.board?.kind).toBe("owners");
    expect(next.board?.confidence).toBe(100);
    expect(next.board?.startSeason).toBe(1);
    expect(next.board?.log).toEqual([]);
    expect(pendingPackageOf(next)).toHaveLength(3);
  });
});
