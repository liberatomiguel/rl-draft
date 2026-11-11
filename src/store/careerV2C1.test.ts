/**
 * v2.0 (C1) — integration regressions of the launch session's engine work:
 * Season X's cancelled Worlds, the headline flag, the contracted market
 * preview, the sponsor's free bootcamp, coaches (renewal, growth, DEV-03),
 * the career's profile XP and the save's size.
 */
import { describe, expect, it } from "vitest";
import { CAREER_CANCELLED_WORLDS } from "@/config/balance";
import { DAYS_PER_SEASON, firstDayOfWeek, officialEventDefsForWeek, worldsCancelledIn } from "@/engine/career/calendar";
import { sponsorFreeBootcampsOf } from "@/engine/career/sponsorDeals";
import { HEADLINE_BEATS, isHeadline } from "@/engine/career/communications";
import { SEASON_GOAL_CANDIDATES } from "@/engine/career/seasonGoals";
import type { CareerSave, CoachState, CompactEventResult, TrainingPackage } from "@/engine/career/types";
import { CAREER_BEATS } from "@/data/career/beats";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import { CAREER_COACH_MARKET, CAREER_PLAN, CAREER_UNLOCKS, CAREER_XP } from "@/config/balance";
import { coachProfileOf, coachStrengthOf, packageEffectFor } from "@/engine/career/training";
import { signableOverallCap } from "@/engine/career/economy";
import { listingFor } from "@/engine/career/market";
import { careerXpBetween } from "@/engine/career/careerXp";
import { playArcCareer } from "./careerArcBot";
import { useCareerStore } from "./careerStore";
import { useProfileStore } from "./profileStore";
import {
  advanceDayFlow,
  chooseSponsorFlow,
  coachCandidatesFor,
  coachContractOf,
  createCareerSave,
  hireCoachFlow,
  rolloverToNextSeason,
  runBootcampFlow,
  setCoachRenewalFlow,
  signingPlanFor,
  sponsorBootcampOf,
  type CreateCareerInput,
} from "./careerFlow";
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

describe("v2.0 (C1) — coaches", () => {
  const coach = (over: Partial<CoachState>): CoachState => ({
    id: "c1-test", name: "Test Coach", overall: 60, bonusType: "mechanics", bonusLevel: "~", salaryPerSplit: 600,
    source: "generated", experience: 0, specialty: "recovery", ceiling: 70, ...over,
  });
  const pkg: TrainingPackage = { objective: "development", workload: "normal" } as TrainingPackage;

  it("DEV-03: any hired coach — rated 65 or below, alone or supervised — trains clearly better than no coach", () => {
    const none = packageEffectFor(pkg, null, "p");
    for (const overall of [50, 55, 60, 65])
      for (const unsupervised of [false, true]) {
        const prof = coachProfileOf(coach({ overall }))!;
        expect(coachStrengthOf(prof, unsupervised)).toBeGreaterThanOrEqual(CAREER_PLAN.coach.hiredFloor);
        const fx = packageEffectFor(pkg, prof, "p", { unsupervised });
        // At least a fifth more of the package's boost lands than with nobody.
        expect((fx.sessionMult - 1) / (none.sessionMult - 1)).toBeGreaterThanOrEqual(1.2);
      }
    expect(CAREER_PLAN.coach.hiredFloor).toBeGreaterThan(CAREER_PLAN.coach.coachless);
  });

  it("an ex-pro and a career professional out-train a generic coach of the same rating", () => {
    const at = (source: CoachState["source"]) => coachProfileOf(coach({ overall: 78, source, experience: 3 }))!;
    expect(at("real").efficiency).toBeGreaterThan(at("generated").efficiency);
    expect(at("dataset").efficiency).toBeGreaterThan(at("real").efficiency);
    expect(at("generated").sourceEdge).toBe(0);
    expect(packageEffectFor(pkg, at("dataset"), "p").sessionMult).toBeGreaterThan(packageEffectFor(pkg, at("generated"), "p").sessionMult);
  });

  const atReview = (save: CareerSave): CareerSave =>
    ({ ...save, phase: "seasonReview", clock: { seasonIndex: save.clock.seasonIndex, day: DAYS_PER_SEASON }, pendingOffers: [], sponsorOffers: null });

  it("a hire signs for two seasons; the deal renews by itself with a slow wage step; 'release' lets him go for free", () => {
    let save = createCareerSave(INPUT, 20_701);
    save.reputation = 30;
    const pick = coachCandidatesFor(save).find((c) => c.source === "generated")!;
    const hired = hireCoachFlow(save, pick);
    expect(hired.error).toBeUndefined();
    save = hired.save;
    const L = CAREER_COACH_MARKET.contract;
    expect(save.coach!.contractEndSeason).toBe(L.lengthSeasons - 1);
    expect(coachContractOf(save)).toMatchObject({ endsSeason: 1, lastSeason: false, atEnd: "renew" });
    const wage0 = save.coach!.salaryPerSplit;
    // Season 0 → 1: inside the deal, nothing moves.
    save = rolloverToNextSeason(atReview(save));
    expect(save.coach!.salaryPerSplit).toBe(wage0);
    expect(coachContractOf(save)!.lastSeason).toBe(true);
    // The notice in the last season (W21's Monday) quotes the ask.
    const noticed = mondayAfter({ ...save, sponsorOffers: null }, L.noticeWeek - 1);
    const notice = noticed.mail.find((m) => m.titleKey === "coachContractExpiring")!;
    expect(notice).toBeDefined();
    expect(CAREER_EN.mail.body.coachContractExpiring(notice.params!)).toContain(save.coach!.name);
    expect(CAREER_PT.mail.body.coachContractExpiring(notice.params!)).toContain(save.coach!.name);
    // Season 1 → 2: renewed, the wage never down and at most raiseCap up, two more seasons.
    const kept = rolloverToNextSeason(atReview(save));
    expect(kept.coach!.id).toBe(pick.id);
    expect(kept.coach!.contractEndSeason).toBe(2 + L.lengthSeasons - 1);
    expect(kept.coach!.salaryPerSplit).toBeGreaterThanOrEqual(wage0);
    expect(kept.coach!.salaryPerSplit).toBeLessThanOrEqual(Math.ceil(wage0 * (1 + L.raiseCap)) + 50);
    expect(kept.mail.some((m) => m.titleKey === "coachRenewed")).toBe(true);
    // Released instead: he leaves, nothing is paid.
    const releasing = setCoachRenewalFlow(save, "release").save;
    expect(coachContractOf(releasing)!.atEnd).toBe("release");
    const gone = rolloverToNextSeason(atReview(releasing));
    expect(gone.coach).toBeNull();
    expect(gone.mail.some((m) => m.titleKey === "coachLeft")).toBe(true);
    expect(gone.finances.ledger.some((l) => l.kind === "severance")).toBe(false);
  });

  it("a coach hired before v2.0 (no end date) keeps his wage and gets his date at the next rollover", () => {
    let save = createCareerSave(INPUT, 20_702);
    save.coach = coach({ overall: 74, salaryPerSplit: 900 });
    delete save.coach.contractEndSeason;
    expect(coachContractOf(save)).toMatchObject({ endsSeason: null, lastSeason: false });
    save = rolloverToNextSeason(atReview(save));
    expect(save.coach!.salaryPerSplit).toBe(900);
    expect(save.coach!.contractEndSeason).toBe(1);
  });
});

describe("v2.0 (C1) — the career pays profile XP, never rating", () => {
  const base = () => createCareerSave(INPUT, 20_801);
  const res = (id: string, tier: CompactEventResult["tier"], userPlacement?: CompactEventResult["userPlacement"]): CompactEventResult =>
    ({ eventId: id, tier, seasonIndex: 0, week: 4, name: "T", rows: [], championRef: "x", userPlacement, fieldQuality: 1 });

  it("series, events, titles and a finished season each pay their CAREER_XP figure, once", () => {
    const prev = base();
    expect(careerXpBetween(prev, prev).total).toBe(0);
    expect(careerXpBetween(prev, structuredClone(prev)).total).toBe(0);
    const next = structuredClone(prev);
    next.stats.seriesWins += 2;
    next.stats.seriesLosses += 1;
    next.stats.titlesRegional += 1;
    next.eventResults = [...next.eventResults, res("e1", "regional", "champion"), res("e2", "regional")];
    const gain = careerXpBetween(prev, next);
    expect(gain.series).toBe(2 * (CAREER_XP.seriesPlayed + CAREER_XP.seriesWinBonus) + CAREER_XP.seriesPlayed);
    // Only the event the user played pays (e2 is a watched one).
    expect(gain.events).toBe(CAREER_XP.eventFinished.regional);
    expect(gain.titles).toBe(CAREER_XP.title.regional);
    expect(gain.seasons).toBe(0);
    expect(gain.total).toBe(gain.series + gain.events + gain.titles);
    // The same write read again from its own result pays nothing more.
    expect(careerXpBetween(next, structuredClone(next)).total).toBe(0);
    // Another career's save is never compared.
    expect(careerXpBetween(createCareerSave(INPUT, 99), next).total).toBe(0);
  });

  it("the store reads every career write: one with no activity grants nothing, and MMR never moves", () => {
    useCareerStore.setState({ slots: [null, null, null], activeSlot: null, achievements: { unlocked: {}, worldsWonOn: {} }, toasts: [] });
    useProfileStore.getState().resetAll();
    useCareerStore.getState().createCareer(0, INPUT, 20_802);
    const xp0 = useProfileStore.getState().xp;
    const mmr0 = useProfileStore.getState().mmr;
    useCareerStore.getState().markFlag("c1-xp-probe");
    expect(useProfileStore.getState().xp).toBe(xp0);
    // A write that carries a played, won series pays it (the store's own hook, through a flow).
    const slot = useCareerStore.getState().slots[0]!;
    const played = structuredClone(slot);
    played.stats.seriesWins += 1;
    expect(careerXpBetween(slot, played).total).toBe(CAREER_XP.seriesPlayed + CAREER_XP.seriesWinBonus);
    expect(useProfileStore.getState().mmr).toBe(mmr0);
  });
});
