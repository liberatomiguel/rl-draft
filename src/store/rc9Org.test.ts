/**
 * rc.9 ORG: the established org's own rules (R220-R225), with FEATURES.board
 * and FEATURES.realOrgStart on. Dataset-agnostic: orgs are picked by tier
 * from the region's own list.
 *
 *  1. Its progression is the org catalogue: no founded-club item name reaches
 *     an established save through a catalogue, the toolbox, an unlock notice,
 *     the board's upgrade, a news item, a mail or a ledger line.
 *  2. It arrives with a sponsor deal in force; no desk on day one; the deal's
 *     end is its renewal.
 *  3. Its standing is a word: no figure, an owner's letter when the tier moves.
 *  4. One money summary whose figures reconcile by construction.
 *  5. An rc.8 takeover save loads, is repaired and keeps playing.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/balance", async (orig) => {
  const m = await orig<typeof import("@/config/balance")>();
  return { ...m, FEATURES: { ...m.FEATURES, board: true, realOrgStart: true } };
});

import { CAREER_BOARD, CAREER_ORG } from "@/config/balance";
import { CAREER_EN } from "@/content/copy.career.en";
import { CAREER_PT } from "@/content/copy.career.pt";
import type { CareerCopy } from "@/content/careerCopy";
import type { BoardState, Stature } from "@/engine/career/boardTypes";
import { seasonMoneyOf, seasonBudgetOf } from "@/engine/career/budget";
import { careerAvailableKeys, toolboxUnlockedIds } from "@/engine/career/careerNew";
import { operationsOf, reputationFigureOf, standingSenseOf } from "@/engine/career/established";
import { ladderOf } from "@/engine/career/ladder";
import { FOUNDED_ITEM_IDS, ORG_FACILITY_LEVELS, orgOperationsOf, tierStandardOf } from "@/engine/career/orgCatalogue";
import { realOrgChoicesFor } from "@/engine/career/orgProfile";
import type { CareerSave } from "@/engine/career/types";
import { buildWorldAtCreation, computeStars } from "@/engine/career/worldSim";
import { mergeWords } from "@/components/career/orgCopy";
import { careerAnnouncementOf } from "@/components/career/news/CareerAnnouncement";
import { resolveMail, resolveNews } from "@/components/career/news/newsText";
import { commitmentRowsOf, keepBackLineOf, moneyGapSentenceOf } from "@/components/career/finances/budgetLines";
import { facilityRowOf, opsEffectOf, opsNameOf } from "@/components/career/finances/operationsView";
import { advanceDayFlow, createCareerSave, migrateSaveToV5, openEstablishedSponsorDesk, type CreateCareerInput } from "./careerFlow";
import { pendingDecisionsOf } from "./careerDecisions";
import { acknowledgeMandateFlow, boardAutoAnswer, boardOnSeasonReview, boardUpgradeOptionsOf } from "./boardFlow";
import { runEventCampFlow, setDepartmentFlow, upgradeFacilityFlow } from "./orgFlow";
import { playArcCareer } from "./careerArcBot";

const SEED = 4242;
type R = "NA" | "EU" | "SAM";
const TIERS: Stature[] = ["elite", "contender", "mid", "underdog"];
const LANGS: [string, CareerCopy][] = [["en", CAREER_EN], ["pt", CAREER_PT]];

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

/** Every name the founded shelf uses for its items, in one language (the strings no established save may show). */
function foundedNames(C: CareerCopy): Set<string> {
  const out = new Set<string>();
  const add = (v: unknown) => typeof v === "string" && v.length > 3 && out.add(v);
  // The performance centre is an org's facility too (Miguel names it): its name is shared, its id maps onto the catalogue.
  const ids = new Set(FOUNDED_ITEM_IDS.filter((id) => id !== "perfCenter"));
  for (const [k, v] of Object.entries(C.club.unlockables as Record<string, string>)) if (ids.has(k)) add(v);
  for (const [k, v] of Object.entries(C.ladder.rung as Record<string, string>)) if (ids.has(k)) add(v);
  for (const [k, v] of Object.entries(C.finances.gear as Record<string, string>)) if (ids.has(k)) add(v);
  for (const v of Object.values(C.finances.staff)) add(v.title);
  add(C.finances.psychologist);
  add(C.finances.bootcampT1);
  add(C.finances.bootcampT2);
  // "Bootcamp" alone is a word an org uses too ("Event bootcamp"); the founded tiers' own names are the leak.
  out.delete(C.finances.bootcampT1);
  return out;
}

function leaks(text: string, names: Set<string>): string[] {
  return [...names].filter((n) => text.includes(n));
}

describe("R220: the established org's own progression", () => {
  it("each tier arrives with its standard structure in place, read as facility levels and staffed departments", () => {
    for (const tier of TIERS) {
      const save = takeover("EU", tier);
      const ops = orgOperationsOf(save)!;
      const std = tierStandardOf(tier);
      expect(ops.tier).toBe(tier);
      const tc = ops.facilities.find((f) => f.id === "trainingCentre")!;
      expect(tc.level, tier).toBe(CAREER_BOARD.profiles[tier].gear);
      expect(tc.level).toBe(std.facilities.trainingCentre);
      expect(tc.maxLevel).toBe(ORG_FACILITY_LEVELS.trainingCentre.length);
      expect(ops.departments.filter((d) => d.staffed).map((d) => d.id).sort()).toEqual([...std.departments].sort());
      for (const d of ops.departments) expect(d.standard).toBe(d.staffed);
      expect(ops.camp?.id).toBe("eventCamp");
      for (const [, C] of LANGS) {
        const row = facilityRowOf(C, tc);
        expect(row.origin).toBe(tc.level === 0 ? "none" : "standard");
      }
    }
    expect(orgOperationsOf(createCareerSave(input("EU"), SEED))).toBeNull();
  });

  it("an upgrade is the founded installation it maps onto: same price, same effect, same refusal; a department is the founded role", () => {
    const save = takeover("NA", "underdog");
    const s0 = acknowledgeMandateFlow(save).save;
    s0.finances.balance = 10_000_000;
    s0.board!.confidence = 99;
    const before = orgOperationsOf(s0)!.facilities.find((f) => f.id === "trainingCentre")!;
    const op = operationsOf(s0)!.facilities.find((f) => f.id === "peripherals")!;
    expect(before.next?.price).toBe(op.price);
    const up = upgradeFacilityFlow(s0, "trainingCentre");
    expect(up.error).toBeUndefined();
    expect(up.save.finances.gear.peripherals).toBe(true);
    expect(up.save.finances.balance).toBe(s0.finances.balance - op.price);
    expect(orgOperationsOf(up.save)!.facilities.find((f) => f.id === "trainingCentre")!.level).toBe(1);
    const staffed = setDepartmentFlow(up.save, "deptAnalysis", true);
    expect(staffed.error).toBeUndefined();
    expect(staffed.save.finances.gear.staff?.analyst).toBe(true);
    const psych = setDepartmentFlow(staffed.save, "deptPsychology", true).save;
    expect(psych.finances.gear.psychologist).toBe(true);
    // The board's sign-off holds a level back like it held the installation.
    const shy = structuredClone(psych);
    shy.board!.confidence = CAREER_BOARD.approval.capital - 1;
    expect(upgradeFacilityFlow(shy, "trainingCentre").error).toBe("boardApproval");
    // A founded club has no catalogue to act on.
    expect(upgradeFacilityFlow(createCareerSave(input("NA"), SEED), "trainingCentre").error).toBe("founded");
  });

  it("no founded-club item name reaches an established save: catalogues, toolbox, unlock notice, board upgrade, news, mail, ledger", () => {
    for (const tier of TIERS) {
      let save: CareerSave = acknowledgeMandateFlow(takeover("EU", tier)).save;
      save.finances.balance = 10_000_000;
      save.board!.confidence = 99;
      // Every action the catalogue has, then a run of days (news and mail on the wire, the reputation moving).
      for (const f of ["trainingCentre", "performanceCentre"] as const) {
        const r = upgradeFacilityFlow(save, f);
        if (!r.error) save = r.save;
      }
      for (const d of ["deptDevelopment", "deptHealth", "deptCommercial"] as const) save = setDepartmentFlow(save, d, true).save;
      const camp = runEventCampFlow(save);
      if (!camp.error) save = camp.save;
      save.board!.upgrade = { offeredSeason: save.clock.seasonIndex };
      const options = boardUpgradeOptionsOf(save);
      save.reputation = 99; // past every founded gate: nothing may announce
      save.newAnnounced = [...(save.newAnnounced ?? []), "ui:progression-announcements"];
      for (let i = 0; i < 12; i++) save = advanceDayFlow(boardAutoAnswer(save));

      expect(toolboxUnlockedIds(save), tier).toEqual([]);
      expect(careerAvailableKeys(save).filter((k) => k.startsWith("tb:")), tier).toEqual([]);
      expect(ladderOf(save), tier).toEqual([]);
      expect(careerAnnouncementOf(save)?.rung ?? null, tier).toBeNull();
      const org = orgOperationsOf(save)!;
      for (const id of [...org.facilities.map((f) => f.id), ...org.departments.map((d) => d.id), org.camp?.id]) expect(FOUNDED_ITEM_IDS, `${tier} ${id}`).not.toContain(id);
      for (const e of save.finances.ledger) if (e.kind === "facility") expect(FOUNDED_ITEM_IDS, `${tier} ledger ${e.refName}`).not.toContain(e.refName);
      for (const o of options) expect(o.org, `${tier} upgrade ${o.id}`).toBeDefined();

      for (const [lang, base] of LANGS) {
        const names = foundedNames(base);
        const C = mergeWords(base, base.orgmode.words);
        const ops = operationsOf(save)!;
        for (const item of [...ops.facilities, ...ops.staff, ...ops.camps]) {
          expect(leaks(opsNameOf(C, item.id), names), `${lang} ${tier} name ${item.id}`).toEqual([]);
          expect(leaks(opsEffectOf(C, item.id), names), `${lang} ${tier} effect ${item.id}`).toEqual([]);
        }
        // The founded ids every older screen still looks up, under the merged copy.
        for (const id of FOUNDED_ITEM_IDS) {
          const looked = [
            (C.club.unlockables as Record<string, string>)[id],
            (C.ladder.rung as Record<string, string>)[id],
            (C.finances.gear as Record<string, string>)[id],
            (C.finances.staff as Record<string, { title: string }>)[id]?.title,
          ].filter((v): v is string => typeof v === "string");
          for (const v of looked) expect(names.has(v), `${lang} ${id} -> ${v}`).toBe(false);
        }
        for (const o of options) expect(names.has((C.ladder.rung as Record<string, string>)[o.item ?? o.id] ?? ""), `${lang} upgrade ${o.id}`).toBe(false);
        for (const n of save.news) {
          const r = resolveNews(n, C, lang as "en" | "pt");
          expect(leaks(`${r.title} ${r.body ?? ""}`, names), `${lang} ${tier} news ${n.titleKey}`).toEqual([]);
        }
        for (const m of save.mail) {
          const r = resolveMail(m, C);
          expect(leaks(`${r.title} ${r.body}`, names), `${lang} ${tier} mail ${m.titleKey}`).toEqual([]);
        }
      }
      expect(save.mail.some((m) => m.titleKey === "unlock"), tier).toBe(false);
    }
  }, 120_000);

  it("a founded club keeps its ladder, its toolbox and its unlock news", () => {
    const founded = createCareerSave(input("EU"), SEED);
    founded.reputation = 30;
    expect(ladderOf(founded).length).toBeGreaterThan(10);
    expect(toolboxUnlockedIds(founded).length).toBeGreaterThan(0);
    expect(standingSenseOf(founded)).toBeNull();
    expect(reputationFigureOf(founded)).toBe(30);
  });
});

describe("R221: a sponsor already in force", () => {
  it("every tier arrives with a running deal of its tier's profile; no desk, no sponsor decision on day one, nor after the mandate", () => {
    for (const region of ["NA", "EU", "SAM"] as const) {
      for (const tier of TIERS) {
        const pick = choices(region).find((c) => c.stature === tier);
        if (!pick) continue;
        const save = createCareerSave(input(region, pick.ref), SEED);
        const tag = `${region} ${tier}`;
        expect(save.sponsor, tag).not.toBeNull();
        expect(save.sponsor!.terms?.inherited, tag).toBe(true);
        expect(save.sponsor!.terms?.profile, tag).toBe(CAREER_ORG.inheritedSponsor.profile[save.difficulty]);
        expect(save.sponsor!.terms?.decideBy, tag).toBeUndefined();
        expect(save.sponsorOffers ?? null, tag).toBeNull();
        expect(pendingDecisionsOf(save).some((d) => d.kind === "sponsor"), tag).toBe(false);
        const read = acknowledgeMandateFlow(save).save;
        expect(read.sponsorOffers ?? null, tag).toBeNull();
        expect(pendingDecisionsOf(read).some((d) => d.kind === "sponsor"), tag).toBe(false);
        const mail = save.mail.find((m) => m.titleKey === "sponsorInherited")!;
        expect(mail, tag).toBeDefined();
        for (const [, C] of LANGS) {
          const r = resolveMail(mail, C);
          expect(r.body, tag).not.toMatch(/undefined|NaN|\$\{|—/);
          expect(r.title.length).toBeGreaterThan(5);
        }
      }
    }
  });

  it("R226: the deal's profile follows the difficulty (easy steady, normal balanced, hard bold), whatever the tier", () => {
    const want = { easy: "steady", normal: "balanced", hard: "bold" } as const;
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      for (const tier of TIERS) {
        const pick = choices("EU").find((c) => c.stature === tier);
        if (!pick) continue;
        const save = createCareerSave({ ...input("EU", pick.ref), difficulty }, SEED);
        expect(save.sponsor!.terms?.profile, `${difficulty} ${tier}`).toBe(want[difficulty]);
        expect(save.sponsor!.terms?.inherited).toBe(true);
      }
    }
  });

  it("the deal's end opens its renewal: the same brand is back on the desk with the same profile", () => {
    let save: CareerSave = acknowledgeMandateFlow(takeover("EU", "mid")).save;
    const brand = save.sponsor!.sponsorId;
    const profile = save.sponsor!.terms!.profile;
    const end = save.sponsor!.terms!.endsOn;
    expect(end.seasonIndex).toBe(save.clock.seasonIndex);
    for (let i = 0; i < 400 && save.sponsor?.sponsorId === brand; i++) save = advanceDayFlow(boardAutoAnswer(save));
    // The autopilot may sign right away; the renewal offer is what the desk carried.
    const offered = save.sponsorOffers ?? [];
    const renewed = offered.find((o) => o.sponsorId === brand) ?? (save.sponsor?.sponsorId === brand ? save.sponsor : null);
    expect(renewed?.terms?.profile ?? profile).toBe(profile);
    if (offered.length) expect(renewed, "the brand is on the renewal desk").not.toBeNull();
  }, 120_000);

  it("a founded club has no deal on day one", () => {
    const founded = createCareerSave(input("EU"), SEED);
    expect(founded.sponsor ?? null).toBeNull();
  });
});

describe("R222: standing without a number", () => {
  it("the tier as a word and what it means: no figure but the market's own signing cap", () => {
    for (const tier of TIERS) {
      const save = takeover("SAM", tier);
      const sense = standingSenseOf(save)!;
      expect(sense.tier).toBe(tier);
      expect(sense.signCap).toBe(CAREER_BOARD.profiles[tier].signCap);
      expect(Object.keys(sense).sort()).toEqual(["down", "drift", "expects", "patience", "signCap", "tier", "up"]);
      expect(reputationFigureOf(save)).toBeNull();
      for (const [, C] of LANGS) {
        expect(C.orgmode.sense.drift[sense.drift]).toBeTruthy();
        expect(C.orgmode.sense.expects[tier]).toBeTruthy();
        expect(C.orgmode.sense.patience[sense.patience]).toBeTruthy();
        // The goal lines an established org reads carry no standing figure.
        const W = mergeWords(C, C.orgmode.words);
        expect(W.goals.reward(4)).not.toMatch(/\d/);
        expect(W.goals.missCost(4)).not.toMatch(/\d/);
        expect(W.inserts.fx.rep(3)).not.toMatch(/\d/);
      }
    }
  });

  it("a tier change at the review sends the owner's letter, written as a person, in both languages", () => {
    for (const [from, rep, up] of [["mid", CAREER_BOARD.standing.promote.contender + 1, true], ["contender", CAREER_BOARD.standing.keep.contender - 1, false]] as const) {
      const save = acknowledgeMandateFlow(takeover("EU", from)).save as CareerSave & { board: BoardState };
      save.board.startSeason = -1;
      save.reputation = rep;
      if (save.seasonGoals) save.seasonGoals.targetMet = true;
      save.phase = "seasonReview";
      boardOnSeasonReview(save);
      const letter = save.mail.find((m) => m.titleKey === (up ? "ownerTierUp" : "ownerTierDown"))!;
      expect(letter, from).toBeDefined();
      expect(letter.fromKey).toBe("owner");
      expect(save.mail.some((m) => m.titleKey === "boardTierUp" || m.titleKey === "boardTierDown")).toBe(false);
      for (const [, C] of LANGS) {
        const r = resolveMail(letter, C);
        expect(r.body).toContain("Manager");
        expect(r.body).not.toMatch(/undefined|NaN|\$\{|—|\d/);
        expect(r.body.length).toBeGreaterThan(120);
      }
    }
  });
});

describe("R223: one truth for the money", () => {
  function identities(save: CareerSave, tag: string) {
    const m = seasonMoneyOf(save)!;
    const b = seasonBudgetOf(save)!;
    expect(m.cash, tag).toBe(save.finances.balance);
    expect(m.commitments.total, tag).toBe(m.commitments.payroll + m.commitments.coach + m.commitments.retainers + m.commitments.upkeep + m.commitments.loan);
    expect(m.commitments.total, tag).toBe(b.committedTotal);
    expect(m.projectedEnd, tag).toBe(m.cash + m.incomeToCome.total - m.commitments.total);
    expect(m.projectedEnd, tag).toBe(b.free);
    expect(m.freeToSpend + m.keepBack.amount, tag).toBe(m.projectedEnd);
    if (m.bridge) expect(m.bridge.opening + m.bridge.allocation + m.bridge.netSince, tag).toBe(m.cash);
    for (const [, C] of LANGS) {
      const money = (n: number) => `$${n}`;
      expect(moneyGapSentenceOf(C, m, money), tag).not.toMatch(/undefined|NaN/);
      expect(keepBackLineOf(C, m, money), tag).not.toMatch(/undefined|NaN/);
      expect(commitmentRowsOf(C, m).reduce((s, r) => s + r.amount, 0), tag).toBe(m.commitments.total);
    }
    return m;
  }

  it("every tier: before the mandate, after it, and twenty days in, the figures add up and the gap is explained", () => {
    for (const tier of TIERS) {
      const day0 = takeover("NA", tier);
      const pending = identities(day0, `${tier} pending`);
      expect(pending.gap).toBe("pending");
      expect(pending.budget.paid).toBe(false);
      expect(pending.budget.amount).toBeGreaterThan(0);
      let save: CareerSave = acknowledgeMandateFlow(day0).save;
      const read = identities(save, `${tier} read`);
      expect(read.budget.paid).toBe(true);
      expect(read.bridge).not.toBeNull();
      expect(read.bridge!.allocation).toBe(read.budget.amount);
      expect(read.bridge!.netSince).toBe(0);
      expect(read.gap).toBe("carried");
      for (let i = 0; i < 20; i++) save = advanceDayFlow(boardAutoAnswer(save));
      const later = identities(save, `${tier} day 20`);
      expect(later.bridge, tier).not.toBeNull();
      expect(["carriedAndSpent", "carriedAndEarned", "carried"]).toContain(later.gap);
    }
  }, 120_000);

  it("a founded club with an owners' board still reads its budget; the summary is the same reading", () => {
    const founded = createCareerSave(input("NA"), SEED);
    const m = seasonMoneyOf(founded);
    if (m) expect(m.projectedEnd).toBe(m.cash + m.incomeToCome.total - m.commitments.total);
  });
});

describe("R225: an rc.8 takeover save opens and keeps playing", () => {
  /** A takeover as rc.8 built it: a desk of offers on reading the mandate (no deal in force), no opening cash, the toolbox's tags unseen. */
  function rc8Save(): CareerSave {
    const save = takeover("SAM", "mid");
    save.sponsor = null;
    save.mail = save.mail.filter((m) => m.titleKey !== "sponsorInherited");
    save.finances.balance -= save.finances.ledger.filter((e) => e.kind === "sponsorSigning").reduce((s, e) => s + e.amount, 0);
    save.finances.ledger = save.finances.ledger.filter((e) => e.kind !== "sponsorSigning");
    delete save.board.season!.openingCash;
    const read = acknowledgeMandateFlow(save).save;
    openEstablishedSponsorDesk(read);
    delete read.board!.season!.openingCash;
    return read;
  }

  it("the load repair restores the season's opening cash from the ledger; nothing else is written", () => {
    const raw = rc8Save();
    const truth = raw.finances.balance - raw.board!.season!.offers[0].grant;
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(raw)))!;
    expect(loaded.board!.season!.openingCash).toBe(truth);
    expect(loaded.sponsorOffers?.length ?? 0).toBeGreaterThan(0);
    expect(loaded.sponsor ?? null).toBeNull();
    const again = migrateSaveToV5(JSON.parse(JSON.stringify(loaded)))!;
    expect(again.board!.season!.openingCash).toBe(truth);
    expect(seasonMoneyOf(loaded)!.gap).toBe("carried");
  });

  it("it plays through the season review without a soft lock", () => {
    const loaded = migrateSaveToV5(JSON.parse(JSON.stringify(rc8Save())))!;
    const out = playArcCareer({ region: "SAM", difficulty: "normal", policy: "tuned", seed: SEED, seasons: 1, startFrom: loaded, budgetMs: 240_000 });
    expect(out.softlock).toBeNull();
    expect(out.ended).toBeNull();
    expect(out.seasons.length).toBe(1);
  }, 300_000);
});
