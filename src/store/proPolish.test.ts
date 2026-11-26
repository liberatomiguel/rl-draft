/**
 * v2.2 PROQA polish: the card's title order, the retirement outlook, the first
 * call's numbers, the season review the rollover stores, the project records
 * and the exhausted-bank names.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, endlessVariety: true } };
});

import { CAREER_PRO_TEAM } from "@/config/balance";
import { decodeCard, encodeCard, sanitizeCard, titlesForCard } from "@/engine/career/pro/card";
import { projectRecordsAfter } from "@/engine/career/endless";
import { exhaustedBankName } from "@/engine/career/localScene";
import { retirementOutlookOf } from "@/engine/career/pro/retire";
import { firstCallOf } from "@/engine/career/pro/team";
import type { RivalProject } from "@/engine/career/types";
import { newProBotSave } from "./proBot";
import { continueProSeasonFlow, dismissProSeasonReviewFlow, proCardOf, proStopOf, advanceProToNextStopFlow, confirmProWeekFlow } from "./proFlow";

describe("card titles", () => {
  it("orders by importance then recency, collapses repeats and respects the cap", () => {
    const raw = ["SAM Regional 2 2025", "SAM Regional 2 2027", "SAM Regional 2 2028", "Split 1 Major 2026", "Worlds 2027", "Community Cup 2030", "Worlds 2029", "EU Regional 1 2031"];
    const out = titlesForCard(raw);
    expect(out[0]).toBe("Worlds ×2");
    expect(out[1]).toBe("Split 1 Major 2026");
    expect(out).toContain("SAM Regional 2 ×3");
    expect(out.indexOf("EU Regional 1 2031")).toBeLessThan(out.indexOf("SAM Regional 2 ×3"));
    expect(out[out.length - 1]).toBe("Community Cup 2030");
    const many = Array.from({ length: 60 }, (_, i) => `Cup ${i} ${2020 + (i % 9)}`);
    expect(titlesForCard(many).length).toBeLessThanOrEqual(10);
  });

  it("the card round-trips with ranked titles and stays inside the payload cap", () => {
    const s = newProBotSave("NA", "normal", 710, 13);
    const withTitles = { ...s, careerTitles: Array.from({ length: 50 }, (_, i) => (i % 5 === 0 ? `Worlds ${2022 + i}` : `SAM Regional ${(i % 3) + 1} ${2022 + (i % 8)}`)) };
    const card = proCardOf(withTitles);
    expect(card.titles.length).toBeLessThanOrEqual(10);
    expect(card.titles[0]).toMatch(/^Worlds/);
    const back = decodeCard(encodeCard(card));
    expect(back).toEqual(sanitizeCard(card));
    expect(encodeCard(card).length).toBeLessThan(2000);
  });
});

describe("outlook and first call", () => {
  it("warns on the last season before the forced age", () => {
    const born = 2000;
    const p = { birthYear: born };
    const early = retirementOutlookOf(p, 5);
    expect(early.lastSeason).toBe(false);
    let last = -1;
    for (let s = 0; s < 40; s++) if (retirementOutlookOf(p, s).lastSeason) { last = s; break; }
    expect(last).toBeGreaterThan(5);
    expect(retirementOutlookOf(p, last - 1).lastSeason).toBe(false);
  });

  it("the first call reads the engine's thresholds, not a copy of them", () => {
    const s = newProBotSave("NA", "normal", 711, 13);
    const c = firstCallOf(s.player);
    expect(c.needOverall).toBe(CAREER_PRO_TEAM.inviteOverall);
    expect(c.rankOpens).toBe(false);
    expect(firstCallOf({ ...s.player, mmr: 2400 }).rankOpens).toBe(true);
  });
});

describe("season review", () => {
  it("the rollover stores one review, shown once and kept for the history", () => {
    let save = confirmProWeekFlow(newProBotSave("NA", "normal", 712, 13), "coach");
    for (let i = 0; i < 400 && proStopOf(save)?.kind !== "seasonEnd"; i++) save = advanceProToNextStopFlow(save);
    expect(proStopOf(save)?.kind).toBe("seasonEnd");
    const season = save.clock.seasonIndex;
    save = continueProSeasonFlow(save);
    expect(save.pendingReview).toBe(season);
    const review = save.seasonReviews?.find((r) => r.seasonIndex === season);
    expect(review).toBeTruthy();
    expect(review!.growth.length).toBeGreaterThan(0);
    for (const g of review!.gala) expect(g.winners.every((n) => typeof n === "string" && n.length > 0)).toBe(true);
    save = dismissProSeasonReviewFlow(save);
    expect(save.pendingReview).toBeNull();
    expect(save.seasonReviews?.length).toBe(1);
  }, 300_000);
});

describe("endless records and names", () => {
  const rec = (orgRef: string, season: number): RivalProject => ({ season, since: 0, orgRef, orgName: orgRef, region: "NA", signed: [], items: [], ratingBefore: 90, ratingAfter: 95 });
  it("an org that carries on keeps one record", () => {
    const out = projectRecordsAfter([rec("a", 7), rec("b", 7)], [rec("a", 8), rec("c", 8)]);
    expect(out.map((p) => `${p.orgRef}${p.season}`).sort()).toEqual(["a8", "b7", "c8"]);
    expect(new Set(out.map((p) => p.orgRef)).size).toBe(out.length);
  });

  it("an exhausted bank adds a word, never a number, with the front on", () => {
    expect(exhaustedBankName("Team Carnaval", 8)).not.toMatch(/\d/);
  });
});
