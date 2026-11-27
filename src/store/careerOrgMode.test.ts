/**
 * v2.2 rc.6 (ORGMODE spec E1-E6): the established-org mode through the flows,
 * with FEATURES.board and FEATURES.realOrgStart on. Dataset-agnostic: orgs are
 * picked by stature from the region's own list.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { CAREER_BOARD, CAREER_GEAR } from "@/config/balance";
import { boardPackagesFor, establishedPool, isPreferred, preferredKindsOf, ratedGoals } from "@/engine/career/board";
import type { BoardState, Stature } from "@/engine/career/boardTypes";
import { grantBaseNow, seasonBudgetOf } from "@/engine/career/budget";
import { bootcampTierFor, quantize, weeklyWageBill } from "@/engine/career/economy";
import { gateRepOf, operationsOf, signCapOf, standingOf } from "@/engine/career/established";
import { coachHireRefusalFor } from "@/engine/career/ladder";
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import type { CareerSave } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import {
  bootcampRefusalOf,
  buyGearFlow,
  createCareerSave,
  fieldDrawOf,
  gearRefusalOf,
  migrateSaveToV5,
  psychologistRefusalOf,
  setStaffFlow,
  sponsorLevelOf,
  type CreateCareerInput,
} from "./careerFlow";
import { boardOnDayArrival, boardOnSeasonReview, chooseBoardPackageFlow, pendingPackageOf } from "./boardFlow";
import { playArcCareer } from "./careerArcBot";

const SEED = 4242;
type R = "NA" | "EU" | "SAM";

function input(region: R, realOrgRef?: string): CreateCareerInput {
  return {
    identity: { orgName: "Test Club", abbrev: "TST", managerName: "Manager", country: "US", region, crestId: "shield", colors: { primary: "#f97316", secondary: "#ffffff" }, buffType: "offense" },
    difficulty: "normal",
    rosterKey: "balanced",
    ...(realOrgRef ? { realOrgRef } : {}),
  };
}

function choices(region: R) {
  const world = computeStars(buildWorldAtCreation(SEED), { seasonIndex: 0, careerSeed: SEED, difficulty: "normal" });
  return realOrgChoicesFor(region, { careerSeed: SEED, seasonIndex: 0, difficulty: "normal", world });
}

function takeover(region: R, stature: Stature): CareerSave & { board: BoardState } {
  const pick = choices(region).find((c) => c.stature === stature);
  if (!pick) throw new Error(`no ${stature} in ${region}`);
  return createCareerSave(input(region, pick.ref), SEED) as CareerSave & { board: BoardState };
}

describe("E1: nothing locked by reputation, the tier's signing pull", () => {
  it("an underdog opens the whole shelf on day one; a founded club at the same reputation does not", () => {
    const save = takeover("EU", "underdog");
    expect(save.reputation).toBe(CAREER_BOARD.profiles.underdog.rep);
    expect(gateRepOf(save)).toBeGreaterThanOrEqual(CAREER_GEAR.psychologistRep);
    expect(psychologistRefusalOf(save, true)).toBeNull();
    expect(setStaffFlow(save, "brand", true).error).toBeUndefined();
    expect(bootcampTierFor(gateRepOf(save))).toBe(2);
    expect(bootcampRefusalOf(save)).not.toBe("locked");
    expect(coachHireRefusalFor(gateRepOf(save), { source: "exPro" } as never)).toBeNull();
    const founded = createCareerSave(input("EU"), SEED);
    founded.reputation = save.reputation;
    expect(psychologistRefusalOf(founded, true)).toBe("locked");
    expect(setStaffFlow(founded, "brand", true).error).toBe("locked");
  });

  it("signs up to the tier's cap, above the reputation line its own starters exceed", () => {
    const save = takeover("SAM", "underdog");
    expect(signCapOf(save)).toBe(CAREER_BOARD.profiles.underdog.signCap);
    const best = Math.max(...save.squad.map((p) => p.overall));
    expect(signCapOf(save)).toBeGreaterThanOrEqual(Math.min(best, CAREER_BOARD.profiles.underdog.signCap));
    expect(standingOf(save)?.tier).toBe("underdog");
  });
});

describe("E2: the structure, any order, the board's sign-off", () => {
  it("the org arrives with its installations and staff; starting cash is the profile's", () => {
    const elite = takeover("EU", "elite");
    expect(elite.finances.gear.pcs && elite.finances.gear.psychologist && elite.finances.gear.staff?.analyst).toBe(true);
    const mid = takeover("EU", "mid");
    expect(mid.finances.gear.peripherals).toBe(true);
    expect(mid.finances.gear.monitors).toBe(false);
    expect(mid.finances.gear.staff?.assistant).toBe(true);
    const ops = operationsOf(mid)!;
    expect(ops.facilities.find((f) => f.id === "peripherals")?.state).toBe("owned");
    expect(ops.staff.find((f) => f.id === "assistant")?.state).toBe("retained");
    expect(ops.facilities.find((f) => f.id === "perfCenter")?.confidence).toBe(CAREER_BOARD.approval.flagship);
    expect(ops.camps).toHaveLength(2);
    expect(operationsOf(createCareerSave(input("EU"), SEED))).toBeNull();
  });

  it("an installation out of ladder order, refused under the board's line, frozen in a freeze", () => {
    const save = takeover("NA", "underdog");
    save.finances.balance = 10_000_000;
    expect(gearRefusalOf(save, "pcs")).toBeNull();
    const bought = buyGearFlow(save, "pcs");
    expect(bought.error).toBeUndefined();
    expect(bought.save.finances.gear.pcs).toBe(true);
    expect(bought.save.finances.gear.peripherals).toBe(false);
    save.board.confidence = CAREER_BOARD.approval.flagship - 1;
    expect(gearRefusalOf(save, "perfCenter")).toBe("boardFlagship");
    expect(operationsOf(save)!.facilities.find((f) => f.id === "perfCenter")?.state).toBe("needsApproval");
    save.board.confidence = CAREER_BOARD.approval.capital - 1;
    expect(gearRefusalOf(save, "monitors")).toBe("boardApproval");
    save.board.confidence = 99;
    save.board.freeze = { seasonIndex: save.clock.seasonIndex, windowIdx: 0 };
    expect(gearRefusalOf(save, "monitors")).toBe("boardFrozen");
  });
});

describe("E3: the budget is the org's", () => {
  it("the season's grant follows grantBase, not the current wage bill", () => {
    const save = takeover("EU", "mid");
    const pkg = pendingPackageOf(save)!.find((p) => p.id === "expected")!;
    const week = weeklyWageBill(save.squad.map((p) => p.salaryPerSplit), save.coach?.salaryPerSplit ?? null);
    expect(pkg.grant).toBe(quantize(grantBaseNow(save.board, 0) + week * CAREER_BOARD.packages.expected.upfrontWeeks));
    // Halve the wages and ask again: the budget part does not move.
    const cut = structuredClone(save);
    for (const p of cut.squad) p.salaryPerSplit = Math.round(p.salaryPerSplit / 2);
    cut.board.season = null;
    boardOnDayArrival(cut);
    const again = pendingPackageOf(cut)!.find((p) => p.id === "expected")!;
    const cutWeek = weeklyWageBill(cut.squad.map((p) => p.salaryPerSplit), cut.coach?.salaryPerSplit ?? null);
    expect(again.grant).toBe(quantize(grantBaseNow(cut.board, 0) + cutWeek * CAREER_BOARD.packages.expected.upfrontWeeks));
  });

  it("seasonBudgetOf reads the books: allocation, committed by line, free", () => {
    const chosen = chooseBoardPackageFlow(takeover("SAM", "contender"), "expected").save;
    const b = seasonBudgetOf(chosen)!;
    const pkg = chosen.board!.season!.offers.find((o) => o.id === "expected")!;
    expect(b.allocation).toBe(pkg.grant);
    expect(b.bonusAtStake).toBe(pkg.bonus);
    expect(b.mondaysLeft).toBeGreaterThan(0);
    expect(b.committed.wages).toBeGreaterThan(0);
    expect(b.committed.staff).toBeGreaterThan(0);
    expect(b.free).toBe(chosen.finances.balance + b.incomeToCome.sponsor + b.incomeToCome.fanbase - b.committedTotal);
    expect(b.wageCeiling).toBe(chosen.board!.wageRoom);
    expect(b.weeksCovered).toBe(Math.floor(b.allocation / b.wageBill));
  });
});

describe("E4: objectives that read as that org's season", () => {
  it("every org of NA, EU and SAM, seasons 0 to 2: three different goals in order, no cup, no more than the max regionals, preferences honoured", () => {
    let preferredExpected = 0;
    let n = 0;
    for (const region of ["NA", "EU", "SAM"] as const) {
      for (const c of choices(region)) {
        const save = createCareerSave(input(region, c.ref), SEED) as CareerSave & { board: BoardState };
        const st = save.board.stature as Stature;
        for (const s of [0, 1, 2]) {
          const oi = { level: sponsorLevelOf(save), cup: fieldDrawOf(save), seasonIndex: s, cal: { stature: st, difficulty: save.difficulty, first: s === 0 } };
          const offers = boardPackagesFor({ ...oi, stature: st, difficulty: save.difficulty, grantBase: 1, budgetMult: 1, weekWages: 1, established: true });
          const [ca, ex, am] = offers.map((o) => o.objective);
          const tag = `${region}/${c.name}/${st}/S${s}`;
          const keys = new Set(offers.map((o) => `${o.objective.kind}:${o.objective.count}:${o.objective.place ?? ""}`));
          expect(keys.size, tag).toBe(3);
          expect(ca.chance, tag).toBeGreaterThan(ex.chance);
          expect(ex.chance, tag).toBeGreaterThan(am.chance);
          for (const g of [ca, ex, am]) {
            expect(g.kind === "cupFinal" || g.kind === "cupWin", tag).toBe(false);
            if (g.kind === "regionalReach" || g.kind === "regionalFinish") expect(g.count, tag).toBeLessThanOrEqual(CAREER_BOARD.objectiveMaxCount);
          }
          // The rule itself: a preferred goal within the window wins the Expected plan.
          const pool = establishedPool(ratedGoals(oi));
          const aim = Math.min(CAREER_BOARD.aimClamp.max, Math.max(CAREER_BOARD.aimClamp.min, CAREER_BOARD.baseAim + CAREER_BOARD.profiles[st].aimShift));
          const kinds = preferredKindsOf(st, "expected");
          const inWindow = pool.some((g) => isPreferred(g, kinds) && Math.abs(g.chance - aim) <= CAREER_BOARD.objectivePrefWindow + 1e-9);
          if (inWindow) expect(isPreferred(ex, kinds), tag).toBe(true);
          n += 1;
          if (isPreferred(ex, kinds)) preferredExpected += 1;
        }
      }
    }
    expect(n).toBeGreaterThan(30);
    expect(preferredExpected / n).toBeGreaterThan(0.5);
  }, 120_000);

  it("a takeover's first season carries the board's brief; a founded club has none", () => {
    const save = takeover("NA", "contender");
    expect(save.board.season?.brief).toEqual(expect.objectContaining({ reason: "takeover", tier: "contender" }));
    expect(createCareerSave(input("NA"), SEED).board?.season?.brief).toBeUndefined();
  });
});

describe("E1: the tier change at the season review", () => {
  function reviewAt(stature: Stature, rep: number, startSeason = -1, met = true) {
    const save = chooseBoardPackageFlow(takeover("EU", stature), "expected").save as CareerSave & { board: BoardState };
    save.board.startSeason = startSeason;
    save.reputation = rep;
    if (save.seasonGoals) save.seasonGoals.targetMet = met;
    save.phase = "seasonReview";
    const before = { grant: save.board.grantBase, room: save.board.wageRoom, conf: save.board.confidence };
    boardOnSeasonReview(save);
    return { save, before };
  }

  it("a mid-table org at the contender line moves up: stature, budget base, wage ceiling, confidence, mail, news", () => {
    const { save, before } = reviewAt("mid", CAREER_BOARD.standing.promote.contender + 1);
    expect(save.board.stature).toBe("contender");
    expect(save.board.tierChange).toEqual({ seasonIndex: 0, from: "mid", to: "contender" });
    expect(save.board.grantBase).toBe(Math.round(before.grant * CAREER_BOARD.standing.budgetStep.up));
    expect(save.board.wageRoom).toBe(Math.round(before.room * CAREER_BOARD.standing.budgetStep.up));
    expect(save.board.log.some((e) => e.reason === "promoted")).toBe(true);
    expect(save.mail.some((m) => m.titleKey === "boardTierUp")).toBe(true);
    expect(save.news.some((m) => m.titleKey === "orgTierUp")).toBe(true);
  });

  it("a contender under its keep floor drops; at the floor it holds; never in the board's first season", () => {
    expect(reviewAt("contender", CAREER_BOARD.standing.keep.contender - 1).save.board.stature).toBe("mid");
    expect(reviewAt("contender", CAREER_BOARD.standing.keep.contender).save.board.stature).toBe("contender");
    expect(reviewAt("mid", 90, 0).save.board.stature).toBe("mid");
    // A promotion is earned: standing over the line with the season's objective missed keeps the tier.
    expect(reviewAt("mid", 90, -1, false).save.board.stature).toBe("mid");
  });
});

describe("E5: the pick screen's fields", () => {
  it("every choice carries its structure, cap, sponsor level, standing and day-one confidence", () => {
    for (const c of choices("EU")) {
      const p = CAREER_BOARD.profiles[c.stature];
      expect(c.signCap).toBe(p.signCap);
      expect(c.gear).toHaveLength(p.gear);
      expect(c.staff).toEqual([...p.staff]);
      expect(c.standing.tier).toBe(c.stature);
      expect(c.confidenceStart).toBe(CAREER_BOARD.confidence.start);
      expect(c.sponsorLevel).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("E6: an rc.5 takeover save (no staff, no brief, no tier change) loads and plays a season", () => {
  it("migrates and plays through the season review without a soft lock", () => {
    const save = takeover("SAM", "mid");
    delete save.finances.gear.staff;
    save.finances.gear.psychologist = false;
    delete save.board.season!.brief;
    delete save.board.tierChange;
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(save)));
    expect(loaded).not.toBeNull();
    const out = playArcCareer({ region: "SAM", difficulty: "normal", policy: "tuned", seed: SEED, seasons: 1, startFrom: loaded!, budgetMs: 240_000 });
    expect(out.softlock).toBeNull();
    expect(out.ended).toBeNull();
    expect(out.seasons.length).toBe(1);
  }, 300_000);
});
