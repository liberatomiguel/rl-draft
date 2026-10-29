/**
 * Road to Worlds — DEV-02 (Etapa 2b, R48): longevity.
 *
 * Players are signable and playable from 13; they retire between 24 and 29
 * (nobody before 24 or before his peak, everyone by the end of 29), announced
 * a season ahead in the user's squad; real players keep their real history;
 * a retiring player leaves the game or becomes a coach (real ex-pros, a
 * deterministic per-career decision), and only those feed the coach market.
 */

import { describe, expect, it } from "vitest";
import { CAREER_AGE, CAREER_SEASONS, CAREER_WORLD } from "@/config/balance";
import { lineupById, playerCards, seasonById } from "@/data";
import { officialEventDefsForWeek } from "@/engine/career/calendar";
import {
  ageOf,
  becomesCoachOnRetirement,
  isCompetitiveAge,
  peakAgeOf,
  playerViewById,
  retirementChanceFor,
  seasonYear,
  signsForFinalSeason,
  squadRollover,
} from "@/engine/career/development";
import { askPackageFor, coachCandidatesFor, contractedSplitsRemaining, listingFor } from "@/engine/career/market";
import { deriveSeed, streams } from "@/engine/career/seeds";
import type { CareerPlayerView, CareerSave, SquadPlayer, WorldState } from "@/engine/career/types";
import { agePassAndIntake, buildWorldAtCreation } from "@/engine/career/worldSim";
import { createRng } from "@/lib/rng";
import {
  createCareerSave,
  rolloverToNextSeason,
  setStartersFlow,
  signingPlanFor,
  signPlayerFlow,
  userTeamForEvent,
  type CreateCareerInput,
} from "./careerFlow";

const INPUT: CreateCareerInput = {
  identity: {
    orgName: "Age Org",
    abbrev: "AGE",
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

/** Club-card season orders per real player (FIFAe national cards are not club history). */
const lastClubOrder = (() => {
  const m = new Map<string, number>();
  for (const card of playerCards) {
    if (lineupById.get(card.lineupId)?.national) continue;
    const order = seasonById.get(card.seasonId)?.order ?? 0;
    m.set(card.playerId, Math.max(m.get(card.playerId) ?? -Infinity, order));
  }
  return m;
})();
const orderOf = (seasonIndex: number) => {
  const last = CAREER_SEASONS.length - 1;
  return seasonIndex <= last ? CAREER_SEASONS[seasonIndex].order : CAREER_SEASONS[last].order + (seasonIndex - last);
};

function worldViews(world: WorldState, seasonIndex: number, seed: number): CareerPlayerView[] {
  const ctx = { careerSeed: seed, seasonIndex, world };
  const ids = [...Object.values(world.orgs).flatMap((o) => o.playerIds), ...world.freeAgentIds];
  return ids.map((id) => playerViewById(id, ctx)).filter((v): v is CareerPlayerView => v !== null);
}

describe("DEV-02 — the retirement window (engine rule)", () => {
  const rule = (age: number, nextAge = age + 1, peakAge = 20, overall = 75) =>
    retirementChanceFor({ age, nextAge, peakAge, overall, starOverall: 85 });

  it("zero before 24, the table inside 24–28, certain at 29 (a season at 30 is never played)", () => {
    for (let age = CAREER_AGE.minCompetitiveAge; age < CAREER_AGE.retireMinAge; age++) expect(rule(age)).toBe(0);
    for (let age = CAREER_AGE.retireMinAge; age < CAREER_AGE.retireMaxAge; age++) {
      expect(rule(age)).toBe(CAREER_AGE.retirementByAge[age]);
      expect(rule(age)).toBeGreaterThan(0);
      expect(rule(age)).toBeLessThan(1);
    }
    expect(rule(29)).toBe(1);
    expect(rule(31)).toBe(1);
    // The rule reads the next season's age: a calendar jump past 29 would end it
    // early — rc.32's age clock has none (2022-23 → 2024 is one year), so 29 is the last.
    expect(rule(28, 30)).toBe(1);
    for (let s = 0; s < 8; s++) expect(seasonYear(s + 1) - seasonYear(s)).toBe(1);
  });

  it("never before the peak (read through peakAgeOf); the 29 cap still wins over a late peak", () => {
    expect(peakAgeOf({ peakAge: 21 })).toBe(21);
    expect(rule(25, 26, 27)).toBe(0);
    expect(rule(26, 27, 27)).toBe(0);
    expect(rule(27, 28, 27)).toBeGreaterThan(0);
    expect(rule(29, 30, 31)).toBe(1);
  });

  it("stars linger inside the window only", () => {
    expect(rule(26, 27, 20, 90)).toBeCloseTo(CAREER_AGE.retirementByAge[26] * CAREER_AGE.retirementStarMult, 9);
    expect(rule(29, 30, 20, 90)).toBe(1);
    expect(rule(23, 24, 20, 90)).toBe(0);
  });
});

describe("DEV-02 — the user's squad: announced a season ahead, inside 24–29", () => {
  function player(birthYear: number, overall = 76, peakAge = 20): SquadPlayer {
    return {
      id: "fix:age",
      kind: "fictional",
      name: "Fixture",
      country: "BR",
      region: "SAM",
      birthYear,
      archetype: "allround",
      overall,
      attrOffsets: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 },
      potential: overall,
      peakAge,
      declineRate: "normal",
      role: "starter",
      salaryPerSplit: 1_000,
      contractEndSeason: 99,
      trainingFocus: "auto",
      trainingIntensity: "normal",
      scoutLevel: 0,
      splitsTogether: 0,
      joinedSeason: 0,
      gainedThisSplit: 0,
      gainedThisSeason: 0,
    } as SquadPlayer;
  }

  /** Rolls a career for one player from `season0` on; returns his final season's age. */
  function lastSeasonAge(seed: number, birthYear: number, overall = 76): number {
    let p = player(birthYear, overall);
    for (let s = 1; s < 40; s++) {
      const res = squadRollover(p, s, createRng(deriveSeed(seed, streams.rollover(s))));
      if (res.retiresNow) return ageOf(birthYear, s - 1);
      p = res.player;
    }
    throw new Error("never retired");
  }

  it("over many seeded careers the final season is always played at 24–29, and the range is used", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const birthYear of [2002, 2004, 2006]) {
        const age = lastSeasonAge(seed, birthYear, seed % 3 === 0 ? 90 : 76);
        expect(age).toBeGreaterThanOrEqual(CAREER_AGE.retireMinAge);
        expect(age).toBeLessThanOrEqual(CAREER_AGE.retireMaxAge);
        seen.add(age);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it("the announcement comes a season ahead — never an abrupt exit, a legacy 30-year-old included", () => {
    const old = player(seasonYear(1) - 30);
    const first = squadRollover(old, 1, createRng(1));
    expect(first.retiresNow).toBe(false);
    expect(first.announcedRetirement).toBe(true);
    const second = squadRollover(first.player, 2, createRng(2));
    expect(second.retiresNow).toBe(true);
  });
});

describe("DEV-02 — the world over many seeded rollovers", { timeout: 120_000 }, () => {
  it("retires players only after a season at 24–29, never fields a 30-year-old, and keeps real history", () => {
    for (const seed of [11, 22, 33]) {
      let world = buildWorldAtCreation(seed);
      for (let s = 0; s < 8; s++) {
        const views = worldViews(world, s, seed);
        for (const v of views) {
          expect(v.age).toBeGreaterThanOrEqual(CAREER_AGE.minCompetitiveAge);
          // Past the window only while his real club history still runs.
          if (v.age > CAREER_AGE.retireMaxAge) expect(lastClubOrder.get(v.id) ?? -1).toBeGreaterThanOrEqual(orderOf(s));
        }
        const byId = new Map(views.map((v) => [v.id, v]));
        const pass = agePassAndIntake(world, s + 1, seed, [], s + 1 >= CAREER_SEASONS.length, []);
        for (const r of pass.retired) {
          const v = byId.get(r.id);
          if (!v) continue;
          expect(v.age).toBeGreaterThanOrEqual(CAREER_AGE.retireMinAge);
          if (v.kind === "real") {
            // A real player plays every season he has a club card for.
            expect(lastClubOrder.get(v.id) ?? -1).toBeLessThan(orderOf(s + 1));
          } else {
            expect(v.age).toBeLessThanOrEqual(CAREER_AGE.retireMaxAge);
          }
        }
        // A real player whose history ended and who is past the window retires at that rollover.
        for (const v of views) {
          const nextAge = v.age + (seasonYear(s + 1) - seasonYear(s));
          const historyEnded = (lastClubOrder.get(v.id) ?? -1) < orderOf(s + 1);
          if (v.kind === "real" && historyEnded && nextAge > CAREER_AGE.retireMaxAge) {
            expect(pass.world.retiredIds).toContain(v.id);
          }
        }
        // The youth intake starts at the minimum competitive age.
        for (const rookie of pass.rookies) {
          const rv = playerViewById(rookie.id, { careerSeed: seed, seasonIndex: s + 1, world: pass.world })!;
          expect(rv.age).toBeGreaterThanOrEqual(CAREER_AGE.minCompetitiveAge);
        }
        world = pass.world;
      }
    }
    expect(CAREER_WORLD.rookieAgeRange[0]).toBeGreaterThanOrEqual(CAREER_AGE.minCompetitiveAge);
  });
});

describe("DEV-02 — retirees: coach or out (deterministic, feeds the coach market)", () => {
  const realIds = [...lastClubOrder.keys()].sort();

  it("is decided per (career, player) from the seed, at the configured share, real ex-pros only", () => {
    const a = realIds.map((id) => becomesCoachOnRetirement(id, 1234));
    const b = realIds.map((id) => becomesCoachOnRetirement(id, 1234));
    expect(a).toEqual(b);
    const share = a.filter(Boolean).length / a.length;
    expect(share).toBeGreaterThan(CAREER_AGE.retireCoachConvertRate - 0.08);
    expect(share).toBeLessThan(CAREER_AGE.retireCoachConvertRate + 0.08);
    // Another career decides differently for some of them.
    const other = realIds.map((id) => becomesCoachOnRetirement(id, 98_765));
    expect(other).not.toEqual(a);
    expect(becomesCoachOnRetirement("fic:SAM:3", 1234)).toBe(false);
    expect(becomesCoachOnRetirement("rook:2:SAM:1", 1234)).toBe(false);
  });

  it("the coach market lists only retired real players who became coaches", () => {
    const seed = 4_321;
    const world = buildWorldAtCreation(seed);
    const coaches = realIds.filter((id) => becomesCoachOnRetirement(id, seed)).slice(0, 4);
    const leavers = realIds.filter((id) => !becomesCoachOnRetirement(id, seed)).slice(0, 4);
    const retiredWorld = { ...world, retiredIds: [...leavers, ...coaches] };
    const seen = new Set<string>();
    for (let windowIdx = 0; windowIdx < 4; windowIdx++) {
      for (const c of coachCandidatesFor({
        world: retiredWorld,
        region: "SAM",
        seasonIndex: 2,
        windowIdx,
        careerSeed: seed,
        difficulty: "normal",
        nameBank: ["A", "B", "C"],
      })) {
        if (c.source === "real") seen.add(c.id.replace("coach:real:", ""));
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const id of seen) expect(coaches).toContain(id);
    for (const id of leavers) expect(seen.has(id)).toBe(false);
  });

  it("the user's retiring player: the news and mail say which way he went, and he never comes back as a player", () => {
    let save = createCareerSave(INPUT, 48_048);
    save.finances.balance = 5_000_000;
    save.reputation = 100; // any real player is signable for this check
    const ctx = { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world };
    // A real player whose REAL career goes on next season: history wants him back
    // in his real lineup, so the anchor pass is the one to resist.
    const pool = [...Object.values(save.world.orgs).flatMap((o) => o.playerIds), ...save.world.freeAgentIds];
    const real = pool
      .map((id) => playerViewById(id, ctx))
      .find((v) => v !== null && v.kind === "real" && (lastClubOrder.get(v.id) ?? -1) >= orderOf(1))!;
    expect(real).toBeTruthy();
    const signed = signPlayerFlow(save, real.id, { lengthSeasons: 3 });
    expect(signed.error).toBeUndefined();
    save = signed.save;
    save.squad.find((p) => p.id === real.id)!.finalSeasonAnnounced = true;
    const next = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(next.squad.some((p) => p.id === real.id)).toBe(false);
    expect(next.world.retiredIds).toContain(real.id);
    const coach = becomesCoachOnRetirement(real.id, save.careerSeed);
    const key = coach ? "retiredToCoach" : "retiredLeaves";
    expect(next.news.some((n) => n.titleKey === key && n.params?.player === real.name)).toBe(true);
    expect(next.mail.some((m) => m.titleKey === key)).toBe(true);
    // Retired ids never resolve again — the anchor pass cannot re-sign him.
    expect(playerViewById(real.id, { careerSeed: next.careerSeed, seasonIndex: 1, world: next.world })).toBeNull();
    for (const org of Object.values(next.world.orgs)) expect(org.playerIds).not.toContain(real.id);
    expect(next.world.freeAgentIds).not.toContain(real.id);
  });
});

describe("DEV-02 — minimum competitive age 13: signable and playable", () => {
  it("a 13-year-old rookie is listed, signs, takes a seat and is fielded", () => {
    let save = createCareerSave(INPUT, 48_101);
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    save.finances.balance = 500_000;
    const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
    const kid = save.world.freeAgentIds
      .map((id) => playerViewById(id, ctx))
      .find((v) => v !== null && v.age === CAREER_AGE.minCompetitiveAge && v.region === "SAM");
    expect(kid).toBeTruthy();
    // A short pool, so the listing's cap (strongest first) cannot hide him: the
    // age filter alone decides whether a 13-year-old is listed.
    const pool = [kid!.id, ...save.world.freeAgentIds.filter((id) => id !== kid!.id).slice(0, 10)];
    const listing = listingFor({
      world: { ...save.world, freeAgentIds: pool },
      squadIds: [],
      seasonIndex: save.clock.seasonIndex,
      careerSeed: save.careerSeed,
    });
    expect(listing.freeAgents.some((v) => v.id === kid!.id)).toBe(true);
    const plan = signingPlanFor(save, kid!.id, { lengthSeasons: 2 });
    expect("plan" in plan).toBe(true);
    save = signPlayerFlow(save, kid!.id, { lengthSeasons: 2 }).save;
    save = setStartersFlow(save, [kid!.id, save.starterIds[0], save.starterIds[1]]).save;
    const regional = officialEventDefsForWeek(save.clock.seasonIndex, 4).find((d) => d.region === "SAM") ??
      officialEventDefsForWeek(save.clock.seasonIndex, 5).find((d) => d.region === "SAM")!;
    expect(userTeamForEvent(save, regional).fieldedIds).toContain(kid!.id);
  });

  it("under 13 is not listed and cannot sign", () => {
    expect(isCompetitiveAge(13)).toBe(true);
    expect(isCompetitiveAge(12)).toBe(false);
    const range = CAREER_WORLD.rookieAgeRange as unknown as [number, number];
    const saved = [range[0], range[1]] as const;
    try {
      // Simulate a too-young intake (the real one starts at 13).
      range[0] = 12;
      range[1] = 12;
      let save = createCareerSave(INPUT, 48_202);
      save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
      const ctx = { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world };
      const kid = save.world.freeAgentIds.map((id) => playerViewById(id, ctx)).find((v) => v !== null && v.age === 12);
      expect(kid).toBeTruthy();
      const listing = listingFor({ world: save.world, squadIds: [], seasonIndex: save.clock.seasonIndex, careerSeed: save.careerSeed });
      expect(listing.freeAgents.some((v) => v.age < 13)).toBe(false);
      expect(listing.contracted.some((c) => c.view.age < 13)).toBe(false);
      const res = signPlayerFlow(save, kid!.id, { lengthSeasons: 2 });
      expect(res.error).toBe("tooYoung");
    } finally {
      range[0] = saved[0];
      range[1] = saved[1];
    }
  });
});

describe("DEV-02 — a signing at the cap joins for his final season only", { timeout: 120_000 }, () => {
  // rc.32 (the age bug, Miguel 30/10): 2022-23 → 2024 is one year on the age
  // clock, so only a 29-year-old signs for his final season — in every season.
  it("signsForFinalSeason: true when the coming rollover would take him past 29 — a 29-year-old, 2022-23 included", () => {
    const p = (age: number) => ({ age, peakAge: 20, overall: 80 });
    expect(seasonYear(3) - seasonYear(2)).toBe(1); // 2022-23 → 2024
    expect(signsForFinalSeason(p(28), 2)).toBe(false);
    expect(signsForFinalSeason(p(29), 2)).toBe(true);
    expect(signsForFinalSeason(p(27), 2)).toBe(false);
    expect(signsForFinalSeason(p(28), 3)).toBe(false);
    expect(signsForFinalSeason(p(29), 3)).toBe(true);
    expect(signsForFinalSeason(p(25), 0)).toBe(false);
  });

  /** Signs `id` (asking for 3 seasons), checks the plan and the contract, rolls over: he must retire, never playing at 30+. */
  function signAtTheCap(save: CareerSave, id: string): void {
    const s = save.clock.seasonIndex;
    const view = playerViewById(id, { careerSeed: save.careerSeed, seasonIndex: s, world: save.world })!;
    expect(signsForFinalSeason(view, s)).toBe(true);
    const planned = signingPlanFor(save, id, { lengthSeasons: 3 });
    expect("plan" in planned).toBe(true);
    if (!("plan" in planned)) return;
    expect(planned.plan.finalSeason).toBe(true);
    expect(planned.plan.lengthSeasons).toBe(1);
    // Priced as the 1-season deal he gets (never the 3 seasons asked for).
    const onOrg = Object.values(save.world.orgs).some((o) => o.playerIds.includes(id));
    const oneSeason = askPackageFor(view, {
      rep: save.reputation,
      seasonIndex: s,
      difficulty: save.difficulty,
      careerSeed: save.careerSeed,
      lengthSeasons: 1,
      contracted: onOrg ? { splitsRemaining: contractedSplitsRemaining(id, s, save.careerSeed) } : undefined,
    });
    expect(planned.plan.pack).toEqual(oneSeason);

    const signed = signPlayerFlow(save, id, { lengthSeasons: 3 });
    expect(signed.error).toBeUndefined();
    const player = signed.save.squad.find((p) => p.id === id)!;
    expect(player.finalSeasonAnnounced).toBe(true);
    expect(player.contractEndSeason).toBe(s + 1);
    expect(player.salaryPerSplit).toBe(oneSeason.salaryPerSplit);
    // Without the rule he would have played the next season at 30 or more.
    expect(ageOf(player.birthYear, s + 1)).toBeGreaterThanOrEqual(CAREER_AGE.retireMaxAge + 1);

    const next = rolloverToNextSeason({ ...signed.save, phase: "seasonReview" });
    expect(next.squad.some((p) => p.id === id)).toBe(false);
    expect(next.world.retiredIds).toContain(id);
    for (const p of next.squad) expect(ageOf(p.birthYear, next.clock.seasonIndex)).toBeLessThanOrEqual(CAREER_AGE.retireMaxAge);
  }

  it("a real pro at 29 signs for one season, retires at the next rollover and never plays at 30+", () => {
    let save = createCareerSave(INPUT, 61_061);
    let pro: CareerPlayerView | undefined;
    for (let s = 0; s < 6 && !pro; s++) {
      pro = worldViews(save.world, save.clock.seasonIndex, save.careerSeed).find(
        (v) => v.kind === "real" && v.age === CAREER_AGE.retireMaxAge,
      );
      if (!pro) save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    }
    expect(pro, "a real 29-year-old in some season's world").toBeTruthy();
    save.reputation = 100; // any real player is signable for this check
    save.finances.balance = 5_000_000;
    signAtTheCap(save, pro!.id);
  });

  /** In 2022-23 (season index 2), sign one of this season's rookies read as `age` for the check. */
  function signRookieIn202223(age: number): { save: CareerSave; signed: CareerSave; id: string; finalSeason: boolean } {
    let save = createCareerSave(INPUT, 48_303);
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    save = rolloverToNextSeason({ ...save, phase: "seasonReview" });
    expect(CAREER_SEASONS[save.clock.seasonIndex].year).toBe("2022-23");
    expect(seasonYear(save.clock.seasonIndex)).toBe(2023);
    save.reputation = 100;
    save.finances.balance = 5_000_000;
    // The real intake starts at 13: this season's rookies are read at `age` for the check.
    const range = CAREER_WORLD.rookieAgeRange as unknown as [number, number];
    const saved = [range[0], range[1]] as const;
    try {
      range[0] = age;
      range[1] = age;
      const id = save.world.freeAgentIds.find((x) => x.startsWith(`rook:${save.clock.seasonIndex}:`))!;
      const view = playerViewById(id, { careerSeed: save.careerSeed, seasonIndex: save.clock.seasonIndex, world: save.world })!;
      expect(view.age).toBe(age);
      const planned = signingPlanFor(save, id, { lengthSeasons: 2 });
      const res = signPlayerFlow(save, id, { lengthSeasons: 2 });
      expect(res.error).toBeUndefined();
      return { save, signed: res.save, id, finalSeason: "plan" in planned && planned.plan.finalSeason };
    } finally {
      range[0] = saved[0];
      range[1] = saved[1];
    }
  }

  it("the age bug is gone: a 28-year-old signed in 2022-23 is 29 in 2024 and signs a normal deal", () => {
    const { save, signed, id, finalSeason } = signRookieIn202223(28);
    expect(finalSeason).toBe(false);
    const player = signed.squad.find((p) => p.id === id)!;
    expect(player.finalSeasonAnnounced).toBeUndefined();
    expect(player.contractEndSeason).toBe(save.clock.seasonIndex + 2);
    expect(ageOf(player.birthYear, save.clock.seasonIndex + 1)).toBe(29);
    // The rollover into 2024 ages him one year — never two — and he plays it.
    const next = rolloverToNextSeason({ ...signed, phase: "seasonReview" });
    const kept = next.squad.find((p) => p.id === id)!;
    expect(kept).toBeTruthy();
    expect(ageOf(kept.birthYear, next.clock.seasonIndex)).toBe(29);
    // At 29 the season is his last: announced at that rollover (never abrupt).
    expect(kept.finalSeasonAnnounced).toBe(true);
  });

  it("a 29-year-old signed in 2022-23 gets the final-season deal (2024 would make him 30)", () => {
    const { save, signed, id, finalSeason } = signRookieIn202223(29);
    expect(finalSeason).toBe(true);
    const player = signed.squad.find((p) => p.id === id)!;
    expect(player.finalSeasonAnnounced).toBe(true);
    expect(player.contractEndSeason).toBe(save.clock.seasonIndex + 1);
    expect(ageOf(player.birthYear, save.clock.seasonIndex + 1)).toBe(30);
    const next = rolloverToNextSeason({ ...signed, phase: "seasonReview" });
    expect(next.squad.some((p) => p.id === id)).toBe(false);
    expect(next.world.retiredIds).toContain(id);
  });

  it("below the cap nothing changes: the length asked for, no announcement", () => {
    const save = createCareerSave(INPUT, 48_404);
    save.finances.balance = 500_000;
    const ctx = { careerSeed: save.careerSeed, seasonIndex: 0, world: save.world };
    const fa = save.world.freeAgentIds
      .map((id) => playerViewById(id, ctx))
      .find((v): v is CareerPlayerView => v !== null && v.age < CAREER_AGE.retireMinAge && Math.round(v.overall) <= 70)!;
    expect(fa).toBeTruthy();
    const planned = signingPlanFor(save, fa.id, { lengthSeasons: 3 });
    expect("plan" in planned && planned.plan.finalSeason).toBe(false);
    expect("plan" in planned && planned.plan.lengthSeasons).toBe(3);
    const signed = signPlayerFlow(save, fa.id, { lengthSeasons: 3 }).save.squad.find((p) => p.id === fa.id)!;
    expect(signed.finalSeasonAnnounced).toBeUndefined();
    expect(signed.contractEndSeason).toBe(3);
  });
});
