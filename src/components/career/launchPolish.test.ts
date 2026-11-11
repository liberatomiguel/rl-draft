import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCareerSave, runBootcampFlow, sponsorLevelOf } from "@/store/careerFlow";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import type { CoachState, CompactEventResult, NewsItem } from "@/engine/career/types";
import { careerAnnouncementOf, reachedAnnouncementKeys } from "./news/CareerAnnouncement";
import { sponsorDecisionFor } from "@/engine/career/sponsorDeals";
import { SponsorDealPanel } from "./sponsors/SponsorOfferCard";
import { sponsorBootcampReady } from "./sponsors/SponsorAutoBootcamp";
import { seasonStatisticsOf, SeasonStatistics } from "./SeasonStatistics";
import { CareerHonorsTable } from "./CareerHonorsTable";
import { CoachDevelopment } from "./training/CoachHireCard";

function fresh() {
  return createCareerSave({ identity: { orgName: "G1 Org", abbrev: "G1O", managerName: "QA", country: "BR", region: "SAM", crestId: "shield:wolf", colors: { primary: "#1d4ed8", secondary: "#fde68a" }, buffType: "consistency" }, difficulty: "normal", style: "balanced", rosterKey: "balanced" }, 20261111);
}
const initialized = "ui:progression-announcements";

describe("G1 announcements — optional C1 headlines and persisted acknowledgement", () => {
  it("ignores unflagged legacy news, even if high priority", () => {
    const save = fresh(); save.news = [{ id: "legacy", type: "org", priority: 3, titleKey: "org", seasonIndex: 0, week: 1, read: false }];
    expect(careerAnnouncementOf(save)).toBeNull();
  });
  it("announces every flagged news item irrespective of priority, once across reloads", () => {
    const save = fresh();
    save.news = [0,1,2,3].map(priority => ({ id: `n${priority}`, type: "org", titleKey: "org", priority, seasonIndex: 0, week: 1, read: false, headline: true })) as (NewsItem & {headline?: boolean})[];
    for (const news of save.news) {
      expect(careerAnnouncementOf(save)?.news?.id).toBe(news.id);
      save.newAnnounced = [...(save.newAnnounced ?? []), `headline:${news.id}`];
      expect(careerAnnouncementOf(structuredClone(save))?.news?.id).not.toBe(news.id);
    }
    expect(careerAnnouncementOf(save)).toBeNull();
  });
  it("new coach and sponsor gates are queued in ladder order, including bootcamps", () => {
    const save = fresh(); save.newAnnounced = [initialized, ...reachedAnnouncementKeys(save)];
    save.reputation = 30;
    const seen: string[] = [];
    for (let i=0;i<20;i++) {
      const item = careerAnnouncementOf(save); if (!item) break;
      seen.push(item.key);
      save.newAnnounced.push(item.key, `tb:${item.rung?.id}`);
    }
    expect(seen).toContain("unlock:coach"); expect(seen).toContain("unlock:sponsors1"); expect(seen).toContain("unlock:bootcamp1");
    expect(seen.indexOf("unlock:coach")).toBeLessThan(seen.indexOf("unlock:bootcamp1"));
    expect(seen).not.toContain("unlock:sponsors3");
  });
  it("does not replay earned gates when an existing save is initialized", () => {
    const save = fresh(); save.reputation = 80;
    save.newAnnounced = [initialized, ...reachedAnnouncementKeys(save)];
    // Existing new-item markers are already seen; there is no earned-gate backlog.
    delete save.newItems;
    expect(careerAnnouncementOf(save)).toBeNull();
  });
});

describe("G1 sponsor-funded automatic bootcamp", () => {
  function eligible() {
    const save = fresh(); save.reputation = 60;
    save.sponsor = { tier: 3, sponsorId: "qa", basePerSplit: 0, bonus: 0, objectiveKind: "enterEvents", progress: 0, hitThisSplit: false, missedCount: 0 } as typeof save.sponsor;
    return save;
  }
  it("only runs an eligible free camp and the existing action charges no cash", () => {
    const save = eligible(); expect(sponsorBootcampReady(save)).toBe(true);
    const next = runBootcampFlow(save);
    expect(next.error).toBeUndefined(); expect(next.save.finances.balance).toBe(save.finances.balance);
    expect(next.save.finances.freeBootcampsUsedThisSeason).toBe(save.finances.freeBootcampsUsedThisSeason + 1);
    expect(sponsorBootcampReady(next.save)).toBe(false);
  });
  it("shows the contract goal once for the whole deal, not one entry per split", () => {
    const save = eligible();
    save.sponsor = sponsorDecisionFor({ tier: 3, today: {seasonIndex:0,day:1}, careerSeed:save.careerSeed, difficulty:save.difficulty, level:sponsorLevelOf(save) })[1];
    const html = renderToStaticMarkup(createElement(SponsorDealPanel, {save}));
    expect(html).toContain(CAREER_EN.launch.sponsorSchedule);
    expect(html).not.toContain(CAREER_EN.launch.futureGoal);
    expect(html).toContain(CAREER_EN.launch.automaticCamp);
  });
  it("waits for reputation and never spends money after free allowance is exhausted", () => {
    const save = eligible(); save.reputation = 5; expect(sponsorBootcampReady(save)).toBe(false);
    save.reputation = 60; save.finances.freeBootcampsUsedThisSeason = 100; expect(sponsorBootcampReady(save)).toBe(false);
    save.finances.freeBootcampsUsedThisSeason = 0; save.phase = "seasonReview"; expect(sponsorBootcampReady(save)).toBe(false);
  });
});

describe("G1 season statistics and compact history", () => {
  it("counts only this season's played events and excludes qualifier seeds from titles/podiums", () => {
    const save = fresh();
    const event = (tier: CompactEventResult["tier"], seasonIndex=0) => ({eventId: `${tier}:${seasonIndex}`, tier, seasonIndex, week: 1, name: tier, championRef: "user", rows: [{ref: "user", name: "G1 Org", placement: "champion", points:0, prize:0}], fieldQuality:1}) as CompactEventResult;
    save.eventResults = [event("qualifier"), event("major"), event("worlds",1), {...event("regional"), rows: []}];
    const stats = seasonStatisticsOf(save);
    expect(stats.events).toBe(2); expect(stats.titles.map(e => e.tier)).toEqual(["major"]); expect(stats.podiums).toBe(1);
  });
  it("does not turn archived seasons with missing detail into zero titles", () => {
    const save = fresh();
    save.history = [{ seasonIndex: -1, seasonId: "qa", label: "QA", worldsChampionRef: null, worldsChampionName: null, userWorldsPlacement: null, userSeasonPoints: 0, userRegionRank: 1, regionTable: [], earnings: 0, balanceEnd: 0, repEnd: 0, grade: "A", majorsQualified: 0, titles: 2 }];
    expect(seasonStatisticsOf(save).detailed).toBe(false);
    const html = renderToStaticMarkup(createElement(SeasonStatistics,{save,C:CAREER_EN}));
    expect(html).toContain(CAREER_EN.launch.seasonDetailUnavailable);
    expect(html).toContain("—");
  });
  it.each([CAREER_EN, CAREER_PT])("renders six opponents plus the user and labels career/season totals", C => {
    const save = fresh();
    const table = renderToStaticMarkup(createElement(CareerHonorsTable, {save,C,compact:true}));
    expect(table.match(/<tr/g)).toHaveLength(7); expect(table).toContain(save.identity.orgName);
    const stats = renderToStaticMarkup(createElement(SeasonStatistics,{save,C}));
    expect(stats).toContain(C.launch.seasonTitles); expect(stats).toContain(C.launch.totalTitles); expect(stats).toContain(C.launch.careerStats);
  });
  it.each([CAREER_EN, CAREER_PT])("makes coach growth and rolling renewal explicit for legacy coaches", C => {
    const coach: CoachState = {id:"legacy",name:"Coach",overall:70,bonusType:"offense",bonusLevel:"~",salaryPerSplit:500,source:"generated"};
    const html = renderToStaticMarkup(createElement(CoachDevelopment,{coach,C}));
    expect(html).toContain(C.launch.coachRetainer); expect(html).toContain(C.launch.coachEvolution);
  });
});
