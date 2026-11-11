/**
 * v2.0 (C1) — integration regressions of the launch session's engine work:
 * Season X's cancelled Worlds, the headline flag, the contracted market
 * preview, the sponsor's free bootcamp, coaches (renewal, growth, DEV-03),
 * the career's profile XP and the save's size.
 */
import { describe, expect, it } from "vitest";
import { CAREER_CANCELLED_WORLDS } from "@/config/balance";
import { firstDayOfWeek, officialEventDefsForWeek, worldsCancelledIn } from "@/engine/career/calendar";
import { sponsorFreeBootcampsOf } from "@/engine/career/sponsorDeals";
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
import { advanceDayFlow, chooseSponsorFlow, createCareerSave, runBootcampFlow, signingPlanFor, sponsorBootcampOf, type CreateCareerInput } from "./careerFlow";
import { toolboxOf } from "./careerHq";

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

/** The Monday after `week`, nothing pending. */
function mondayAfter(save: CareerSave, week: number, seasonIndex = save.clock.seasonIndex): CareerSave {
  const next = structuredClone(save);
  next.clock = { seasonIndex, day: firstDayOfWeek(week) + 6 };
  next.pendingEventDef = null;
  next.unofficialOffer = null;
  next.pendingInsert = null;
  next.activeEvent = null;
  next.pendingOffers = [];
  return advanceDayFlow(next);
}

describe("v2.0 (C1) — the sponsor's free bootcamp runs by itself", () => {
  it("signing a deal with the perk starts the camp at no cost; the next split starts the next one; the state is exposed", () => {
    let save = createCareerSave(INPUT, 20_601);
    save.reputation = 60;
    save.sponsorOffers = null;
    save = mondayAfter(save, 10);
    const offer = save.sponsorOffers!.find((o) => o.terms?.profile === "steady")!;
    expect(sponsorFreeBootcampsOf(offer)).toBeGreaterThan(0);
    expect(sponsorBootcampOf(save).perSeason).toBe(0);
    const signed = chooseSponsorFlow(save, offer.sponsorId);
    expect(signed.error).toBeUndefined();
    save = signed.save;
    const perSeason = sponsorFreeBootcampsOf(save.sponsor);
    // It started on signing: an edge, no purchase in the books, flagged as the sponsor's.
    expect(save.finances.bootcampSharp).toBeGreaterThan(0);
    expect(save.finances.bootcampFromSponsor).toBe(true);
    expect(save.finances.ledger.some((l) => l.kind === "buff" && l.refName === "Bootcamp")).toBe(false);
    const view = sponsorBootcampOf(save);
    expect(view).toMatchObject({ perSeason, used: 1, left: perSeason - 1, active: true });
    expect(view.until).toEqual(save.finances.bootcampUntil);
    const camp = toolboxOf(save).find((i) => i.kind === "bootcamp" && i.status === "active");
    expect(camp?.sponsorProvided).toBe(true);
    // The first one is a bombshell, worded in both languages.
    const mail = save.mail.find((m) => m.titleKey === "sponsorBootcamp")!;
    expect(mail.headline).toBe(true);
    expect(CAREER_EN.mail.body.sponsorBootcamp(mail.params!)).toContain("no cost");
    expect(CAREER_PT.mail.body.sponsorBootcamp(mail.params!)).toContain("sem custo");
    // Buying one on top is refused: the split's camp already ran.
    expect(runBootcampFlow(save).error).toBe("used");
    // The next split: the edge ended, and a deal with a second one starts it by itself (no second bombshell).
    const next = mondayAfter(save, 20);
    if (perSeason >= 2) {
      expect(next.finances.bootcampSharp).toBeGreaterThan(0);
      expect(next.finances.freeBootcampsUsedThisSeason).toBe(2);
      expect(next.mail.filter((m) => m.titleKey === "sponsorBootcamp" && m.headline)).toHaveLength(1);
    } else {
      expect(next.finances.bootcampSharp).toBe(0);
      expect(next.finances.bootcampFromSponsor).toBeUndefined();
      expect(sponsorBootcampOf(next)).toMatchObject({ active: false, left: 0, next: "nextSeason" });
    }
  });

  it("a deal without the perk starts nothing", () => {
    let save = createCareerSave(INPUT, 20_602);
    save.reputation = 30;
    save.sponsorOffers = null;
    save = mondayAfter(save, 10);
    save = chooseSponsorFlow(save, save.sponsorOffers![0].sponsorId).save;
    expect(save.finances.bootcampSharp).toBe(0);
    expect(save.mail.some((m) => m.titleKey === "sponsorBootcamp")).toBe(false);
    expect(sponsorBootcampOf(save)).toMatchObject({ perSeason: 0, active: false, next: null });
  });
});
