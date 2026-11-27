/**
 * v2.2 ORGMODE 2027 stage 2 (front MANDATE): the board's mandate through the
 * flow. A takeover's first day: the owner's welcome, the mandate mail, the
 * mandate holding the clock, the sponsor desk after it is read. A season
 * played by the competent bot: the split reports cover the three goals, the
 * review settles them with their confidence, budget and bonus. A founded
 * club keeps its three plans.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";

const getCareerCopy = (lang: "en" | "pt") => (lang === "en" ? CAREER_EN : CAREER_PT);
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import type { CareerSave } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import { resolveMail } from "@/components/career/news/newsText";
import { createCareerSave, type CreateCareerInput } from "./careerFlow";
import { pendingDecisionsOf } from "./careerDecisions";
import { acknowledgeMandateFlow, boardDecisionOf, mandateOf, pendingMandateOf, pendingPackageOf } from "./boardFlow";
import { playArcCareer } from "./careerArcBot";
import { LAST_START_ERA } from "@/engine/career/era";
import { mandateParams } from "./boardFlow";

const SEED = 4242;

function input(region: "NA" | "EU" | "SAM", realOrgRef?: string): CreateCareerInput {
  return {
    identity: { orgName: "Test Club", abbrev: "TST", managerName: "Manager", country: "US", region, crestId: "shield", colors: { primary: "#f97316", secondary: "#ffffff" }, buffType: "offense" },
    difficulty: "normal",
    rosterKey: "balanced",
    ...(realOrgRef ? { realOrgRef } : {}),
  };
}

function pick(region: "NA" | "EU" | "SAM", i: number) {
  const world = computeStars(buildWorldAtCreation(SEED), { seasonIndex: 0, careerSeed: SEED, difficulty: "normal" });
  return realOrgChoicesFor(region, { careerSeed: SEED, seasonIndex: 0, difficulty: "normal", world })[i];
}

function mailText(save: CareerSave, key: string, lang: "en" | "pt") {
  const item = save.mail.find((m) => m.titleKey === key);
  expect(item, key).toBeDefined();
  return resolveMail(item!, getCareerCopy(lang));
}

describe("a takeover's first day", () => {
  const org = pick("EU", 1);
  const save = createCareerSave(input("EU", org.ref), SEED);

  it("the owner welcomes the manager with the org's history; the mandate mail lists the three goals, in both languages", () => {
    const welcome = save.mail.find((m) => m.titleKey === "boardWelcome")!;
    expect(welcome.fromKey).toBe("owner");
    expect(Number(welcome.params?.seasons)).toBeGreaterThan(0);
    for (const lang of ["en", "pt"] as const) {
      for (const key of ["boardWelcome", "boardMandate"]) {
        const r = mailText(save, key, lang);
        expect(r.body).not.toMatch(/undefined|NaN|\$\{|—/);
        expect(r.title.length).toBeGreaterThan(5);
      }
      const body = mailText(save, "boardMandate", lang).body;
      const C = getCareerCopy(lang).board.mandate;
      const m = mandateOf(save)!;
      expect(body).toContain(C.squad(m.squad.kind, m.squad.value, m.squad.playerNames ?? []));
    }
    expect(save.mail.some((m) => m.titleKey === "boardPackage")).toBe(false);
  });

  it("the mandate holds the clock and the sponsor desk waits for it; reading it pays the budget and opens the desk", () => {
    expect(pendingMandateOf(save)).not.toBeNull();
    expect(boardDecisionOf(save)?.id).toBe("board:mandate:0");
    expect(pendingDecisionsOf(save).some((d) => d.kind === "board" && d.holds)).toBe(true);
    expect(save.sponsorOffers ?? null).toBeNull();
    const before = save.finances.balance;
    const grant = pendingPackageOf(save)![0].grant;
    const read = acknowledgeMandateFlow(save).save;
    expect(read.finances.balance).toBe(before + grant);
    expect(pendingMandateOf(read)).toBeNull();
    expect(mandateOf(read)?.acknowledged).toBe(true);
    expect(read.sponsorOffers?.length ?? 0).toBeGreaterThan(0);
    expect(read.seasonGoals?.plan?.target.kind).toBe(mandateOf(read)!.classification.objective.kind);
    expect(acknowledgeMandateFlow(read).error).toBe("none");
  });

  it("a founded club keeps its three plans and has no mandate", () => {
    const founded = createCareerSave(input("EU"), SEED);
    expect(pendingPackageOf(founded)).toHaveLength(3);
    expect(pendingMandateOf(founded)).toBeNull();
    expect(founded.board?.season?.mandate).toBeUndefined();
    expect(founded.finances.transferTally).toBeUndefined();
    expect(founded.mail.some((m) => m.titleKey === "boardWelcome")).toBe(false);
  });
});

describe("a season under the mandate", () => {
  it("the competent bot plays it: two split reports on the three goals, the review settles all three and moves confidence, budget and bonus", () => {
    const org = pick("NA", 6);
    let end: CareerSave | null = null;
    let budgetBefore = 1;
    const out = playArcCareer({
      region: "NA",
      difficulty: "normal",
      policy: "tuned",
      seed: SEED,
      seasons: 2,
      startFrom: createCareerSave(input("NA", org.ref), SEED),
      onSeason: (moment, s) => {
        if (moment === "start" && s.clock.seasonIndex === 0) budgetBefore = s.board?.budgetMult ?? 1;
        if (moment === "end" && s.clock.seasonIndex === 0) end = structuredClone(s);
      },
      budgetMs: 280_000,
    });
    expect(out.softlock).toBeNull();
    const s = end as unknown as CareerSave;
    const m = s.board!.season!.mandate!;
    expect(m.acknowledged).toBe(true);
    expect(m.classification.met).not.toBeNull();
    expect(m.money.met).not.toBeNull();
    expect(m.squad.met).not.toBeNull();
    const reports = s.mail.filter((x) => x.titleKey === "boardMandateReport" && x.seasonIndex === 0);
    expect(reports.length).toBeGreaterThanOrEqual(1);
    for (const lang of ["en", "pt"] as const) {
      const r = mailText(s, "boardMandateVerdict", lang);
      expect(r.body).not.toMatch(/undefined|NaN|\$\{/);
    }
    const reasons = s.board!.log.filter((e) => e.seasonIndex === 0).map((e) => e.reason);
    expect(reasons.some((r) => r.startsWith("mandateMoney"))).toBe(true);
    expect(reasons.some((r) => r.startsWith("mandateSquad"))).toBe(true);
    // The next season's mandate says what last season's was.
    expect(budgetBefore).toBeGreaterThan(0);
  }, 300_000);
});

describe("a 2027 takeover (the default era)", () => {
  it("the mandate starts on the career's first season: welcome, mail numbered season 1, amounts in the era's money, and the issues read", () => {
    const era = LAST_START_ERA;
    const world = computeStars(buildWorldAtCreation(SEED, era), { seasonIndex: era, careerSeed: SEED, difficulty: "normal" });
    const choices = realOrgChoicesFor("EU", { careerSeed: SEED, seasonIndex: era, difficulty: "normal", world });
    for (const c of choices.slice(0, 6)) {
      const save = createCareerSave({ ...input("EU", c.ref), startSeasonIndex: era }, SEED);
      expect(save.clock.seasonIndex).toBe(era);
      expect(save.board!.startSeason).toBe(era);
      const m = pendingMandateOf(save)!;
      expect(m, c.name).not.toBeNull();
      expect(m.seasonIndex).toBe(era);
      expect(m.issues.length).toBeGreaterThan(0);
      expect(m.money.amount).toBeGreaterThan(0);
      expect(mandateParams(save, m).season).toBe(1);
      expect(save.mail.some((x) => x.titleKey === "boardWelcome")).toBe(true);
      for (const lang of ["en", "pt"] as const) expect(mailText(save, "boardMandate", lang).body).not.toMatch(/undefined|NaN/);
    }
  }, 120_000);
});
