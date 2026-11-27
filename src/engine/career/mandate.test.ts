/**
 * v2.2 ORGMODE 2027 stage 2 (front MANDATE): the house's problems, the demand
 * level and the three goals, read and settled from a save's state. Pure.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { CAREER_BOARD } from "@/config/balance";
import { createCareerSave, type CreateCareerInput } from "@/store/careerFlow";
import { wageCeilingOf } from "./budget";
import { pushLedger, tallyTransfers } from "./economy";
import { buildMandate, demandOf, moneyProgressOf, orgHistoryOf, orgIssuesOf, settleMandate, squadProgressOf } from "./mandate";
import { realOrgChoicesFor } from "./orgProfile";
import type { CareerSave } from "./types";
import { buildWorldAtCreation, computeStars } from "./worldSim";

const SEED = 4242;
const M = CAREER_BOARD.mandate;

function input(region: "NA" | "EU" | "SAM", realOrgRef?: string): CreateCareerInput {
  return {
    identity: { orgName: "Test", abbrev: "TST", managerName: "Manager", country: "US", region, crestId: "shield", colors: { primary: "#f97316", secondary: "#ffffff" }, buffType: "offense" },
    difficulty: "normal",
    rosterKey: "balanced",
    ...(realOrgRef ? { realOrgRef } : {}),
  };
}

function choices(region: "NA" | "EU" | "SAM") {
  const world = computeStars(buildWorldAtCreation(SEED), { seasonIndex: 0, careerSeed: SEED, difficulty: "normal" });
  return realOrgChoicesFor(region, { careerSeed: SEED, seasonIndex: 0, difficulty: "normal", world });
}

const takeover = (region: "NA" | "EU" | "SAM", i = 0): CareerSave => createCareerSave(input(region, choices(region)[i].ref), SEED);
const mandateOn = (save: CareerSave) => save.board!.season!.mandate!;
const expectedPkg = (save: CareerSave) => save.board!.season!.offers[0];

describe("the demand level", () => {
  it("reads the tier and the org's history, at the cuts", () => {
    expect(demandOf("elite", 3)).toBe("high");
    expect(demandOf("elite", 0)).toBe("high");
    expect(demandOf("contender", 1)).toBe("medium");
    expect(demandOf("contender", 2)).toBe("high");
    expect(demandOf("mid", 1)).toBe("medium");
    expect(demandOf("mid", 0)).toBe("low");
    expect(demandOf("underdog", 1)).toBe("low");
    expect(demandOf("underdog", 3)).toBe("medium");
  });

  it("sharpens the classification goal: a high-demand board never asks for an easier goal than a low-demand one", () => {
    for (const region of ["NA", "EU", "SAM"] as const)
      for (const c of choices(region)) {
        const save = createCareerSave(input(region, c.ref), SEED);
        const m = mandateOn(save);
        expect(["low", "medium", "high"]).toContain(m.demand);
        expect(m.classification.objective.chance).toBeGreaterThan(0);
        // Classification weighs most: its stakes over the money and squad goals'.
        expect(m.classification.gain.confidence).toBeGreaterThan(m.money.gain.confidence);
        expect(Math.abs(m.classification.loss.confidence)).toBeGreaterThan(Math.abs(m.squad.loss.confidence));
      }
  }, 120_000);
});

describe("the house's problems", () => {
  it("names a starter whose deal ends, a weak link, a missing coach and short cash, most pressing first", () => {
    const save = structuredClone(takeover("EU", 3));
    const s = save.clock.seasonIndex;
    const [a, b, c] = save.starterIds.map((id) => save.squad.find((p) => p.id === id)!);
    a.contractEndSeason = s;
    c.overall = Math.min(b.overall, a.overall) - 9;
    save.coach = null;
    save.finances.balance = 100;
    const issues = orgIssuesOf(save, { all: true });
    const kinds = issues.map((i) => i.kind);
    // Cash with nothing in the bank is the most pressing of all; a deal running out comes next.
    expect(kinds.slice(0, 2)).toEqual(["shortCash", "dealsEnding"]);
    expect(issues[1].playerName).toBe(a.name);
    expect(kinds).toEqual(expect.arrayContaining(["shortCash", "weakLink", "noCoach"]));
    expect(issues.find((i) => i.kind === "weakLink")!.playerId).toBe(c.id);
    for (let i = 1; i < issues.length; i++) expect(issues[i - 1].severity).toBeGreaterThanOrEqual(issues[i].severity);
    expect(orgIssuesOf(save)).toHaveLength(M.issues.max);
  });

  it("reads the wage bill against the board's ceiling", () => {
    const save = structuredClone(takeover("NA", 4));
    const ceiling = wageCeilingOf(save.board!, 0);
    for (const p of save.squad) p.salaryPerSplit *= 2;
    const wages = orgIssuesOf(save, { all: true }).find((i) => i.kind === "wageBill");
    expect(wages).toBeDefined();
    expect(wages!.value).toBeGreaterThan(100);
    expect(ceiling).toBeGreaterThan(0);
  });

  it("finds problems in every NA, EU and SAM org at the takeover", () => {
    for (const region of ["NA", "EU", "SAM"] as const)
      for (const c of choices(region)) {
        const m = mandateOn(createCareerSave(input(region, c.ref), SEED));
        expect(m.issues.length, c.name).toBeGreaterThanOrEqual(1);
        expect(m.issues.length).toBeLessThanOrEqual(M.issues.max);
      }
  }, 120_000);
});

describe("the three goals", () => {
  it("the money goal comes from a money problem, else the tier's default", () => {
    const base = takeover("EU", 3);
    const tier = base.board!.stature as "contender";
    expect(mandateOn(base).money.kind).toBe(tier === "contender" ? "netSpend" : "cashFloor");
    const short = structuredClone(base);
    short.finances.balance = 100;
    const m = buildMandate(short, { classification: expectedPkg(short), tier, demand: "medium", patience: 1 });
    expect(m.money.kind).toBe("cashFloor");
    expect(m.money.issue).toBe("shortCash");
    const wages = structuredClone(base);
    for (const p of wages.squad) p.salaryPerSplit *= 2;
    const w = buildMandate(wages, { classification: expectedPkg(wages), tier, demand: "medium", patience: 1 });
    expect(w.money.kind).toBe("wagesUnder");
    expect(w.money.amount).toBe(wageCeilingOf(wages.board!, 0));
    expect(w.money.week).toBe(M.money.wagesWeek);
  });

  it("the squad goal comes from a squad problem, else the demand's default", () => {
    const base = takeover("EU", 3);
    const tier = base.board!.stature as "contender";
    const ending = structuredClone(base);
    const star = ending.squad.find((p) => p.id === ending.starterIds[0])!;
    star.contractEndSeason = 0;
    const r = buildMandate(ending, { classification: expectedPkg(ending), tier, demand: "medium", patience: 1 });
    expect(r.squad.kind).toBe("renew");
    expect(r.squad.playerIds).toEqual([star.id]);
    const calm = buildMandate(base, { classification: expectedPkg(base), tier, demand: "medium", patience: 1 });
    expect(["keepCore", "signStarter", "ageUnder", "youthEvents"]).toContain(calm.squad.kind);
    const high = buildMandate(base, { classification: expectedPkg(base), tier, demand: "high", patience: 1 });
    if (!high.squad.issue) expect(high.squad.kind).toBe("signStarter");
  });

  it("each goal states its terms: a gain with no cost, a cost with no gain; losses scale with patience", () => {
    const save = takeover("NA", 0);
    const m = buildMandate(save, { classification: expectedPkg(save), tier: "elite", demand: "high", patience: 1.3 });
    const calm = buildMandate(save, { classification: expectedPkg(save), tier: "elite", demand: "low", patience: 1 });
    for (const g of [m.classification, m.money, m.squad]) {
      expect(g.gain.confidence).toBeGreaterThan(0);
      expect(g.loss.confidence).toBeLessThan(0);
      expect(g.loss.bonus).toBe(0);
      expect(g.met).toBeNull();
    }
    expect(Math.abs(m.money.loss.confidence)).toBeGreaterThan(Math.abs(calm.money.loss.confidence));
    expect(m.classification.gain.bonus).toBe(expectedPkg(save).bonus);
  });
});

describe("settling", () => {
  it("the transfer tally counts fees and bonuses paid and fees received, and restarts each season", () => {
    let t = { seasonIndex: 0, out: 0, in: 0 };
    t = tallyTransfers(t, { seasonIndex: 0, kind: "transferOut", amount: -500 });
    t = tallyTransfers(t, { seasonIndex: 0, kind: "signingBonus", amount: -100 });
    t = tallyTransfers(t, { seasonIndex: 0, kind: "transferIn", amount: 300 });
    t = tallyTransfers(t, { seasonIndex: 0, kind: "payroll", amount: -900 });
    expect(t).toEqual({ seasonIndex: 0, out: 600, in: 300 });
    expect(tallyTransfers(t, { seasonIndex: 1, kind: "transferIn", amount: 50 })).toEqual({ seasonIndex: 1, out: 0, in: 50 });
    // A founded club's books keep no tally.
    const fin = pushLedger({ ...takeover("NA").finances, transferTally: undefined }, { seasonIndex: 0, week: 1, kind: "transferIn", amount: 10 });
    expect(fin.transferTally).toBeUndefined();
  });

  it("money: net spend inside the budget is met, over it missed; the cash floor reads the balance at the review", () => {
    const save = structuredClone(takeover("EU", 0));
    const m = structuredClone(mandateOn(save));
    m.money = { ...m.money, kind: "netSpend", amount: 1000 };
    save.finances = pushLedger(save.finances, { seasonIndex: 0, week: 2, kind: "transferOut", amount: -900 });
    expect(moneyProgressOf(save, m.money).onTrack).toBe(true);
    save.finances = pushLedger(save.finances, { seasonIndex: 0, week: 3, kind: "signingBonus", amount: -200 });
    expect(settleMandate(save, m, save.finances.balance).money).toBe(false);
    save.finances = pushLedger(save.finances, { seasonIndex: 0, week: 4, kind: "transferIn", amount: 400 });
    expect(settleMandate(save, m, save.finances.balance).money).toBe(true);
    m.money = { ...m.money, kind: "cashFloor", amount: 5000 };
    expect(settleMandate(save, m, 4999).money).toBe(false);
    expect(settleMandate(save, m, 5000).money).toBe(true);
    m.money = { ...m.money, kind: "wagesUnder", amount: 10 ** 9, week: 21, deadlineMet: false };
    expect(settleMandate(save, m, 0).money).toBe(false);
  });

  it("squad: keep the core is lost when a named player leaves; a new starter at the bar meets the signing goal", () => {
    const save = structuredClone(takeover("NA", 3));
    const m = structuredClone(mandateOn(save));
    m.squad = { ...m.squad, kind: "keepCore", value: 2, playerIds: save.starterIds.slice(0, 2), playerNames: ["a", "b"] };
    expect(squadProgressOf(save, m.squad).onTrack).toBe(true);
    const sold = structuredClone(save);
    sold.squad = sold.squad.filter((p) => p.id !== save.starterIds[0]);
    expect(squadProgressOf(sold, m.squad)).toMatchObject({ onTrack: false, settled: true });
    m.squad = { ...m.squad, kind: "signStarter", value: 85, baselineIds: save.squad.map((p) => p.id) };
    expect(settleMandate(save, m, 0).squad).toBe(false);
    const signed = structuredClone(save);
    const newcomer = { ...signed.squad[0], id: "new-player", overall: 86 };
    signed.squad.push(newcomer);
    signed.starterIds = [newcomer.id, signed.starterIds[1], signed.starterIds[2]];
    expect(settleMandate(signed, m, 0).squad).toBe(true);
  });
});

describe("the org's history", () => {
  it("counts the RLCS seasons an org fielded a lineup in, up to the career season", () => {
    const h = orgHistoryOf("team-vitality", 0);
    expect(h).not.toBeNull();
    expect(h!.seasons).toBeGreaterThan(3);
    expect(h!.since).toMatch(/RLCS/);
    expect(h!.topSeasons).toBeLessThanOrEqual(h!.seasons);
    const later = orgHistoryOf("team-vitality", 5)!;
    expect(later.seasons).toBeGreaterThanOrEqual(h!.seasons);
    expect(orgHistoryOf("no-such-org", 0)).toBeNull();
  });
});
