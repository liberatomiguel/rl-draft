/**
 * Road to Worlds — DEV-01, the growth contract (rc.32, R55–R57): engine tests
 * of development model 2, and the switch back to rc.31's model 1.
 *
 * Dataset-agnostic: real-player fixtures are found at runtime (no hardcoded
 * ids). The measured curves live in docs/CAREER-GROWTH-rc32.md (the opt-in
 * probe, src/store/careerGrowth.probe.test.ts).
 */

import { describe, expect, it } from "vitest";
import { CAREER_AGE, CAREER_CALENDAR, CAREER_DEV, CAREER_SCOUT, CAREER_SEASONS, CAREER_TRAINING, CAREER_WORLD } from "@/config/balance";
import { playerCardById, seasonById, specialCards } from "@/data";
import { createRng } from "@/lib/rng";
import {
  ageOf,
  applyMatchXp,
  bestEligibleSpecialOverall,
  declinePerYearOf,
  derivePotential,
  derivePotentialV2,
  developmentPhaseOf,
  developmentProfileOf,
  exactAgeOf,
  fillerPlayerView,
  growthModelOf,
  growthPacePerYear,
  isGrowthContract,
  peakAgeOf,
  peakTargetOf,
  playerViewById,
  realPlayerView,
  rookieView,
  scoutedBand,
  seasonYear,
  squadRollover,
  trainDay,
  trainWeek,
  trainingEta,
  trainingProjection,
} from "./development";
import type { ScoutLevel, SquadPlayer, WorldState } from "./types";
import { buildWorldAtCreation } from "./worldSim";

const SEED = 4242;
const seasonOrderOf = (id: string) => seasonById.get(id)?.order ?? 0;
const REGIONS = ["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"] as const;

const world = (model?: number): WorldState => ({
  orgs: {},
  overallDelta: {},
  freeAgentIds: [],
  retiredIds: [],
  version: 0,
  ...(model ? { growthModel: model } : {}),
});

const kid = (over: Partial<SquadPlayer> = {}): SquadPlayer => ({
  id: "rook:1:EU:0",
  kind: "fictional",
  name: "Kid",
  region: "EU",
  birthYear: seasonYear(1) - 14,
  archetype: "allround",
  overall: 66,
  attrOffsets: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 },
  potential: 88,
  peakAge: 21,
  declineRate: "normal",
  role: "starter",
  salaryPerSplit: 1_000,
  contractEndSeason: 9,
  trainingFocus: "auto",
  trainingIntensity: "normal",
  scoutLevel: 0,
  splitsTogether: 0,
  joinedSeason: 1,
  gainedThisSplit: 0,
  gainedThisSeason: 0,
  ...over,
});

const M2 = { model: 2, careerSeed: SEED } as const;

/** One season of the default setup on model `model`: Mon–Fri ticks, an event every other week (4 series). */
function season(p: SquadPlayer, seasonIndex: number, model: number, careerSeed = SEED): SquadPlayer {
  let x = { ...p, gainedThisSeason: 0, gainedThisSplit: 0 };
  for (let week = 1; week <= CAREER_CALENDAR.weeksPerSeason; week++) {
    const event = week % 2 === 0;
    for (let dow = 1; dow <= CAREER_TRAINING.trainingDaysPerWeek; dow++) {
      x = trainDay(
        x,
        {
          seasonIndex,
          coachOverall: null,
          gearBonus: 0,
          trainingWeekBonus: !event,
          splitGained: x.gainedThisSplit,
          seasonGained: x.gainedThisSeason,
          model,
          day: (week - 1) * 7 + dow,
          careerSeed,
          aging: true,
        },
        event ? CAREER_TRAINING.matchPrepShare : 1,
      ).player;
    }
    if (event) {
      x = applyMatchXp(x, { seasonIndex, fieldQuality: 0.85, isSub: false, coachOverall: null, gearBonus: 0, seriesPlayed: 4, model, day: week * 7, careerSeed });
    }
    if (model < 2 && (week === 11 || week === 21 || week === 31)) x = { ...x, gainedThisSplit: 0 };
  }
  return squadRollover(x, seasonIndex + 1, createRng(1), { model, careerSeed }).player;
}

describe("DEV-01 — the development model is per career", () => {
  it("a new world runs CAREER_DEV.growthModel (2); a world without the field is rc.31's model 1", () => {
    expect(CAREER_DEV.growthModel).toBe(2);
    expect(buildWorldAtCreation(SEED).growthModel).toBe(2);
    expect(growthModelOf(world())).toBe(1);
    expect(isGrowthContract(growthModelOf(world()))).toBe(false);
    expect(isGrowthContract(2)).toBe(true);
  });

  it("switch back: CAREER_DEV.growthModel 1 builds an rc.31 world (no field) and its views take rc.31's derivations", () => {
    const dev = CAREER_DEV as { growthModel: number };
    const was = dev.growthModel;
    try {
      dev.growthModel = 1;
      const w = buildWorldAtCreation(SEED);
      expect("growthModel" in w).toBe(false);
      // rc.31's rookies cap at the dataset ceiling, and their view's potential follows the overall up.
      for (let n = 0; n < 200; n++) {
        const v = rookieView("EU", 2, n, SEED, false, undefined, growthModelOf(w));
        expect(v.potential).toBeLessThanOrEqual(CAREER_WORLD.datasetEraPotentialCeiling);
      }
      // rc.31's non-wonderkid filler reads his current overall + endedCareerHeadroom.
      const filler = Array.from({ length: 60 }, (_, n) => fillerPlayerView("SAM", n, { careerSeed: SEED, seasonIndex: 0, world: w }))
        .find((v) => v.potential < 88)!;
      expect(filler.potential).toBe(Math.min(99, Math.round(filler.overall) + CAREER_DEV.endedCareerHeadroom));
    } finally {
      dev.growthModel = was;
    }
  });
});

describe("DEV-01a — rare elite prospects in the historical eras", () => {
  const rows = (model: number) =>
    Array.from({ length: 40 }, (_, k) => 1000 + k * 7919).flatMap((seed) =>
      [1, 2, 3, 4, 5].flatMap((s) =>
        REGIONS.flatMap((region) =>
          Array.from({ length: CAREER_WORLD.rookiesPerRegionPerSeason }, (_, n) => rookieView(region, s, n, seed, false, undefined, model)),
        ),
      ),
    );

  it("model 2: 93–98 kids of 13–15 appear in the dataset era at the configured rarity, 97/98 the rarest, never more 88+ kids", () => {
    const m1 = rows(1);
    const m2 = rows(2);
    const elite = m2.filter((v) => v.potential >= 93);
    expect(m1.some((v) => v.potential > CAREER_WORLD.datasetEraPotentialCeiling)).toBe(false);
    expect(elite.length).toBeGreaterThan(0);
    for (const v of elite) {
      expect(v.age).toBeLessThanOrEqual(CAREER_WORLD.eliteProspect.maxAge);
      expect(v.potential).toBeLessThanOrEqual(98);
    }
    // ≈ 0.75 (aged ≤ 15) × 0.15 (top tiers) × chance of all rookies.
    const expected = 0.75 * 0.15 * CAREER_WORLD.eliteProspect.chance;
    expect(elite.length / m2.length).toBeGreaterThan(expected * 0.5);
    expect(elite.length / m2.length).toBeLessThan(expected * 1.6);
    const top = elite.filter((v) => v.potential >= 97).length;
    expect(top).toBeLessThan(elite.filter((v) => v.potential <= 94).length);
    // Not more wonderkids overall: the 88+ share is model 1's.
    expect(m2.filter((v) => v.potential >= 88).length).toBe(m1.filter((v) => v.potential >= 88).length);
  });

  it("model 2: an elite kid's peak leaves room for his gap; the infinite era keeps its pyramid", () => {
    for (const v of rows(2).filter((r) => r.potential >= 93)) {
      expect(v.peakAge).toBeGreaterThanOrEqual(v.age + Math.ceil((v.potential - v.overall) / CAREER_DEV.seasonGainCap) + 1);
    }
    for (let n = 0; n < 120; n++) {
      expect(rookieView("NA", 7, n, SEED, true, undefined, 2).potential).toBe(rookieView("NA", 7, n, SEED, true, undefined, 1).potential);
    }
  });
});

describe("DEV-01b — an individual arc fixed per career", () => {
  it("the profile is pure in (careerSeed, id): same every call, rerolled only by another career", () => {
    const ids = ["rook:3:SAM:5", "fic:EU:12", "fic:NA:starter4"];
    for (const id of ids) {
      expect(developmentProfileOf(id, SEED)).toEqual(developmentProfileOf(id, SEED));
    }
    const differs = Array.from({ length: 30 }, (_, n) => `fic:EU:${n}`).some(
      (id) => JSON.stringify(developmentProfileOf(id, SEED)) !== JSON.stringify(developmentProfileOf(id, SEED + 1)),
    );
    expect(differs).toBe(true);
  });

  it("three separate dimensions: maturity sets the peak age, plateau and decline roll on their own", () => {
    const profiles = Array.from({ length: 600 }, (_, n) => developmentProfileOf(`fic:OCE:${n}`, SEED));
    for (const p of profiles) {
      // rc.36 (POL-04): the drawn peak comes CAREER_DEV.peakAgeShift years later.
      const [lo, hi] = CAREER_DEV.maturity[p.maturity].peakAge;
      expect(p.peakAge).toBeGreaterThanOrEqual(lo + CAREER_DEV.peakAgeShift);
      expect(p.peakAge).toBeLessThanOrEqual(hi + CAREER_DEV.peakAgeShift);
      expect(Object.keys(CAREER_DEV.plateauYearsWeights).map(Number)).toContain(p.plateauYears);
      expect(Math.abs(p.peakOffset)).toBeLessThanOrEqual(CAREER_DEV.peakTolerance);
    }
    for (const m of ["early", "standard", "late"] as const) {
      const of = profiles.filter((p) => p.maturity === m);
      expect(of.length).toBeGreaterThan(40);
      // Inside one maturity profile both other dimensions still vary.
      expect(new Set(of.map((p) => p.plateauYears)).size).toBeGreaterThan(1);
      expect(new Set(of.map((p) => p.declineRate)).size).toBeGreaterThan(1);
    }
  });

  it("a real player peaks at the age of his best moment (card or eligible special), inside the real range", () => {
    const ids = [...new Set(specialCards.map((s) => s.playerId))].filter((id) => bestEligibleSpecialOverall(id) !== null);
    expect(ids.length).toBeGreaterThan(5);
    for (const id of ids) {
      const p = developmentProfileOf(id, SEED);
      expect(p.peakAge).toBeGreaterThanOrEqual(CAREER_DEV.realPeakAgeRange[0]);
      expect(p.peakAge).toBeLessThanOrEqual(CAREER_DEV.realPeakAgeRange[1]);
    }
  });

  it("peakAgeOf is the age he reaches his peak — the view's and the squad record's peakAge", () => {
    const v = rookieView("APAC", 2, 3, SEED, false, undefined, 2);
    expect(peakAgeOf(v)).toBe(v.peakAge);
    expect(peakAgeOf(kid({ peakAge: 23 }))).toBe(23);
  });

  it("phases: growing before the peak age, at the top for the plateau, then declining — the decline gradual", () => {
    const prof = { peakAge: 21, plateauYears: 2 };
    expect(developmentPhaseOf(20.9, prof)).toBe("growing");
    expect(developmentPhaseOf(21, prof)).toBe("peak");
    expect(developmentPhaseOf(22.99, prof)).toBe("peak");
    expect(developmentPhaseOf(23, prof)).toBe("declining");
    const d = (age: number) => declinePerYearOf({ exactAge: age, ...prof, declineRate: "normal" });
    expect(d(22.5)).toBe(0);
    expect(d(23.2)).toBeGreaterThan(0);
    expect(d(26.5)).toBeGreaterThan(d(23.2));
    expect(declinePerYearOf({ exactAge: 26, ...prof, declineRate: "fast" })).toBeGreaterThan(declinePerYearOf({ exactAge: 26, ...prof, declineRate: "slow" }));
  });

  it("the potential is the EXPECTED peak: a prospect ends within ±peakTolerance of it, never over his real peak", () => {
    const tol = CAREER_DEV.peakTolerance;
    let n = 0;
    for (const region of REGIONS)
      for (let i = 0; i < 6; i++) {
        const v = rookieView(region, 1, i, SEED, false, undefined, 2);
        let p = kid({ id: v.id, birthYear: seasonYear(1) - v.age, overall: v.overall, potential: v.potential, peakAge: v.peakAge, declineRate: v.declineRate });
        const target = peakTargetOf(v.potential, developmentProfileOf(v.id, SEED));
        let best = p.overall;
        for (let s = 1; s < 1 + (v.peakAge - v.age) + 3; s++) {
          p = season(p, s, 2);
          best = Math.max(best, p.overall);
          expect(p.overall).toBeLessThanOrEqual(target + 1e-9);
        }
        expect(Math.abs(best - v.potential)).toBeLessThanOrEqual(tol + 1e-9);
        n += 1;
      }
    expect(n).toBe(42);
  });

  it("a prospect signed at 14 reaches his best within seasons the career plays (by his peak age + 1)", () => {
    const p0 = kid();
    const target = peakTargetOf(p0.potential, developmentProfileOf(p0.id, SEED));
    let p = p0;
    for (let s = 1; s <= p0.peakAge - 14 + 1; s++) p = season(p, s, 2);
    expect(p.overall).toBeGreaterThan(target - 1);
  });
});

describe("DEV-01d — the curve: no split cap, a season cap, steep young, never short, no rollover jump", () => {
  const tick = (p: SquadPlayer, weeks: number, extra: Partial<Parameters<typeof trainWeek>[1]> = {}) =>
    trainWeek(p, { seasonIndex: 1, coachOverall: 85, gearBonus: 0.2, trainingWeekBonus: true, splitGained: p.gainedThisSplit, seasonGained: p.gainedThisSeason, weeks, ...M2, ...extra });

  it("no per-split cap: a split can bank more than rc.31's 3; the season ceiling (rc.35: seasonGainHardCap, spread) still holds", () => {
    // A split is ten weeks; a heavy package with gear clears rc.31's 3
    // (rc.34: the workload lives in the package's multiplier).
    let p = kid({ potential: 95 });
    for (let w = 0; w < 10; w++) p = tick(p, 1.3, { packageMult: 1.3 }).player;
    expect(p.gainedThisSplit).toBeGreaterThan(CAREER_TRAINING.maxSplitGain);
    for (let w = 0; w < 40; w++) p = tick(p, 1).player;
    expect(p.gainedThisSeason).toBeLessThanOrEqual(CAREER_DEV.seasonGainHardCap + 1e-9);
    expect(trainingEta(p, { seasonIndex: 1, coachOverall: 85, gearBonus: 0.2, trainingWeekBonus: false, ...M2 }).splitCapped).toBe(false);
  });

  it("steep when young, slowing near the peak, never stopping short (the pace has a floor while a gap remains)", () => {
    const pace = (age: number, overall: number) => growthPacePerYear({ overall, target: 90, exactAge: age, peakAge: 22, plateauYears: 2 });
    expect(pace(14, 70)).toBeGreaterThan(pace(19, 85));
    expect(pace(21.8, 89.9)).toBeGreaterThanOrEqual(CAREER_DEV.paceFloorPerYear);
    expect(pace(22, 90)).toBe(0);
    // Late arrival keeps catching up through his plateau, never after it.
    expect(pace(23, 88)).toBeGreaterThan(0);
    expect(pace(24.1, 88)).toBe(0);
  });

  it("no jump on a birthday: the pace on the season's last day and the next season's first day match", () => {
    // Seasons 3 → 4 (2024 → 2025): one calendar year apart.
    const p = kid({ birthYear: seasonYear(3) - 16, overall: 74, potential: 86, peakAge: 21 });
    expect(seasonYear(4) - seasonYear(3)).toBe(1);
    const end = trainingProjection(p, { seasonIndex: 3, coachOverall: null, gearBonus: 0, trainingWeekBonus: false, ...M2, day: CAREER_CALENDAR.weeksPerSeason * 7 }).weeklyOverall;
    const start = trainingProjection(p, { seasonIndex: 4, coachOverall: null, gearBonus: 0, trainingWeekBonus: false, ...M2, day: 1 }).weeklyOverall;
    expect(Math.abs(end - start)).toBeLessThan(0.01);
    expect(exactAgeOf(16, CAREER_CALENDAR.weeksPerSeason * 7 + 1)).toBeCloseTo(17, 5);
  });

  it("no jump at the rollover: model 2's rollover moves no overall; past his plateau the decline lands day by day", () => {
    const vet = kid({ id: "fic:EU:40", birthYear: seasonYear(3) - 27, overall: 80, potential: 82, peakAge: 21 });
    const roll = squadRollover(vet, 3, createRng(7), M2);
    expect(roll.player.overall).toBe(vet.overall);
    expect(roll.declined).toBe(0);
    const legacy = squadRollover(vet, 3, createRng(7));
    expect(legacy.player.overall).toBeLessThan(vet.overall);
    const day = trainDay(vet, { seasonIndex: 3, coachOverall: null, gearBonus: 0, trainingWeekBonus: false, splitGained: 0, seasonGained: 0, ...M2, day: 40, aging: true }).player;
    expect(day.overall).toBeLessThan(vet.overall);
    expect(vet.overall - day.overall).toBeLessThan(0.05);
    // Bonus training (no calendar day) never ages him.
    const bonus = trainDay(vet, { seasonIndex: 3, coachOverall: null, gearBonus: 0, trainingWeekBonus: true, splitGained: 0, seasonGained: 0, ...M2, day: 40 }).player;
    expect(bonus.overall).toBe(vet.overall);
  });

  it("base growth: days plus the series actually played; a reserve who did not play keeps his days, no starter XP", () => {
    const p = kid();
    const ctx = { seasonIndex: 1, fieldQuality: 1, coachOverall: null, gearBonus: 0, ...M2, day: 60 };
    expect(applyMatchXp(p, { ...ctx, isSub: true, seriesPlayed: 5 })).toEqual(p);
    const four = applyMatchXp(p, { ...ctx, isSub: false, seriesPlayed: 4 }).overall - p.overall;
    const eight = applyMatchXp(p, { ...ctx, isSub: false, seriesPlayed: 8 }).overall - p.overall;
    expect(four).toBeGreaterThan(0);
    expect(eight).toBeGreaterThan(four * 1.8);
    const days = trainDay(p, { seasonIndex: 1, coachOverall: null, gearBonus: 0, trainingWeekBonus: false, splitGained: 0, seasonGained: 0, ...M2, day: 60, aging: true });
    expect(days.gained).toBeGreaterThan(0);
    // rc.31 (model 1) paid the registered sub subXpFactor of the event.
    expect(applyMatchXp(p, { seasonIndex: 1, fieldQuality: 1, coachOverall: null, gearBonus: 0, isSub: true }).overall).toBeGreaterThan(p.overall);
  });
});

describe("DEV-01c — a real player's potential from his eligible special", () => {
  it("never below his best eligible special (model 2); rc.31 read only his club cards", () => {
    const ids = [...new Set(specialCards.map((s) => s.playerId))].filter((id) => bestEligibleSpecialOverall(id) !== null);
    let belowBefore = 0;
    for (const id of ids)
      for (const seed of [11, 22, 33]) {
        expect(derivePotentialV2(id, seed)).toBeGreaterThanOrEqual(bestEligibleSpecialOverall(id)!);
        if (derivePotential(id, seed, 60) < bestEligibleSpecialOverall(id)!) belowBefore += 1;
      }
    expect(belowBefore).toBeGreaterThan(0);
  });

  it("the explicit rule: only his own real-moment player specials of the career's era count — never a coach, national, community, Creator or Wings card", () => {
    const types = new Set(CAREER_DEV.potentialSpecialTypes);
    const rarities = new Set(CAREER_DEV.potentialSpecialRarities);
    const firstOrder = CAREER_SEASONS[0].order;
    const eligible = (sp: (typeof specialCards)[number]): boolean => {
      const base = playerCardById.get(sp.baseCardId);
      return (
        sp.kind !== "coach" &&
        types.has(sp.cardType) &&
        rarities.has(sp.rarity) &&
        base !== undefined &&
        base.playerId === sp.playerId &&
        (!CAREER_DEV.potentialSpecialCareerEraOnly || seasonOrderOf(base.seasonId) >= firstOrder)
      );
    };
    for (const id of new Set(specialCards.map((s) => s.playerId))) {
      const mine = specialCards.filter((s) => s.playerId === id && eligible(s));
      const expected = mine.length ? Math.max(...mine.map((s) => s.overall)) : null;
      expect(bestEligibleSpecialOverall(id), id).toBe(expected);
    }
    // Every excluded family present in the data is really excluded somewhere.
    for (const rarity of ["national", "community", "creator", "wings"]) {
      for (const sp of specialCards.filter((s) => s.rarity === rarity)) expect(eligible(sp)).toBe(false);
    }
  });

  it("his debut overall is unchanged: an anchored real player reads the same card on both models", () => {
    const sample = [...new Set(specialCards.map((s) => s.playerId))].slice(0, 40);
    for (const id of sample)
      for (let s = 0; s < CAREER_SEASONS.length; s++) {
        const a = realPlayerView(id, { careerSeed: SEED, seasonIndex: s, world: world() });
        const b = realPlayerView(id, { careerSeed: SEED, seasonIndex: s, world: world(2) });
        expect(b?.overall ?? null, `${id} S${s}`).toBe(a?.overall ?? null);
      }
  });
});

describe("DEV-01e — honest scouting bands that never move", () => {
  const sample = () => {
    const w = buildWorldAtCreation(SEED);
    const ctx = { careerSeed: SEED, seasonIndex: 0, world: w };
    const ids = [...new Set([...Object.values(w.orgs).flatMap((o) => o.playerIds), ...w.freeAgentIds])];
    return ids.map((id) => playerViewById(id, ctx)).filter((v) => v !== null);
  };

  // rc.35 (front C): overalls under the band — its floor now follows the overall above it (rc35FrontC.test.ts).
  it("the band reads the potential only: a growing overall, a new day or a reload never moves it", () => {
    for (const v of sample().slice(0, 300))
      for (const level of [0, 1, 2] as ScoutLevel[]) {
        const a = scoutedBand(v.potential, 0, level, SEED, v.id, 2);
        expect(scoutedBand(v.potential, 4.3, level, SEED, v.id, 2)).toEqual(a);
        expect(a.min).toBeLessThanOrEqual(Math.round(v.potential));
        expect(a.max).toBeGreaterThanOrEqual(Math.round(v.potential));
        expect(a.min).toBeGreaterThanOrEqual(60);
        expect(a.max).toBeLessThanOrEqual(99);
      }
  });

  it("a bought report narrows inside the band shown before (L0 ⊇ L1 ⊇ L2 ⊇ exact L3)", () => {
    for (const v of sample()) {
      const b = [0, 1, 2, 3].map((l) => scoutedBand(v.potential, v.overall, l as ScoutLevel, SEED, v.id, 2));
      for (let l = 1; l < 4; l++) {
        expect(b[l].min).toBeGreaterThanOrEqual(b[l - 1].min);
        expect(b[l].max).toBeLessThanOrEqual(b[l - 1].max);
      }
      expect(b[3].min).toBe(b[3].max);
    }
  });

  it("DEV-04 (rc.33) revisits where the truth sits: at the top or at most bandMaxAbove under it, each place used", () => {
    // rc.32 (DEV-01e) spread it over the whole 10-wide band, so a 91 could read "89–99".
    const players = sample();
    const aboveAt = (level: ScoutLevel) =>
      players.map((v) => scoutedBand(v.potential, v.overall, level, SEED, v.id, 2).max - Math.round(v.potential));
    for (const level of [0, 1] as ScoutLevel[]) {
      const above = aboveAt(level);
      for (let a = 0; a <= CAREER_SCOUT.bandMaxAbove; a++) expect(above.filter((x) => x === a).length / above.length).toBeGreaterThan(0.03);
      expect(Math.max(...above)).toBe(CAREER_SCOUT.bandMaxAbove);
    }
    // The deepest report keeps its whole uncertainty: the truth at either end about half the time.
    const deepest = aboveAt(2);
    const atTop = deepest.filter((x) => x === 0).length / deepest.length;
    expect(atTop).toBeGreaterThan(0.35);
    expect(atTop).toBeLessThan(0.65);
  });

  // rc.33 review: model 1 reads DEV-04's honest band too (development.dev04.test.ts), still floored at the overall.
  it("model 1 floors its band at the overall (an absent model is model 1)", () => {
    const v = { potential: 80, overall: 79 };
    const b = scoutedBand(v.potential, v.overall, 0, SEED, "fic:EU:3");
    expect(b.min).toBeGreaterThanOrEqual(79);
    expect(scoutedBand(v.potential, v.overall, 0, SEED, "fic:EU:3", 1)).toEqual(b);
  });
});

describe("DEV-01 — rc.31's model is untouched (model 1)", () => {
  it("model 1 keeps the split cap, the event XP for the registered sub and the rollover decline", () => {
    let p = kid({ potential: 95 });
    for (let w = 0; w < 20; w++)
      p = trainWeek(p, { seasonIndex: 1, coachOverall: 85, gearBonus: 0.2, trainingWeekBonus: true, splitGained: p.gainedThisSplit, seasonGained: p.gainedThisSeason }).player;
    expect(p.gainedThisSplit).toBeLessThanOrEqual(CAREER_TRAINING.maxSplitGain + 1e-9);
    const age24 = kid({ birthYear: seasonYear(4) - 24, overall: 80, potential: 80 });
    expect(squadRollover(age24, 4, createRng(3)).declined).toBeGreaterThan(0);
    expect(ageOf(age24.birthYear, 4)).toBe(24);
    expect(CAREER_AGE.trainingDeclineDampen).toBeGreaterThan(0);
  });
});
