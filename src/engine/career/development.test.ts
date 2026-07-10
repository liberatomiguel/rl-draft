/**
 * Road to Worlds — development.ts contract tests.
 *
 * Dataset-agnostic: every real-player fixture is DERIVED from the dataset at
 * runtime (no hardcoded ids). Covers derivation stability, potential/wonderkid
 * authenticity, RL-realistic age legality, training math anchors, caps, band
 * invariants, and stats clamping.
 */

import { describe, expect, it } from "vitest";

import {
  CAREER_AGE,
  CAREER_CALENDAR,
  CAREER_DEV,
  CAREER_SCOUT,
  CAREER_SEASONS,
  CAREER_TRAINING,
  CAREER_WORLD,
} from "@/config/balance";
import { playerCards, seasonById } from "@/data";
import { PLAYER_NAME_BANK } from "@/data/career/names";
import type { Rng } from "@/lib/rng";
import { finalOverall } from "../cards";
import type { StatKey } from "../types";
import {
  ageOf,
  anchorOverall,
  applyMatchXp,
  deriveArchetype,
  deriveAttrOffsets,
  deriveBirthYear,
  deriveDeclineRate,
  derivePeakAge,
  derivePotential,
  fieldQualityFor,
  fillerPlayerView,
  playerViewById,
  realPlayerView,
  rookieView,
  scoutedBand,
  seasonYear,
  squadRollover,
  statsFromView,
  trainDay,
  trainWeek,
} from "./development";
import type { SquadPlayer, WorldState } from "./types";

const SEED_A = 12345;
const SEED_B = 987654321;

const STAT_KEYS: StatKey[] = [
  "offense",
  "defense",
  "mechanics",
  "consistency",
  "experience",
  "clutch",
];

const emptyWorld = (): WorldState => ({
  orgs: {},
  overallDelta: {},
  freeAgentIds: [],
  retiredIds: [],
  version: 0,
});

const ctxAt = (seasonIndex: number, world = emptyWorld()) => ({
  careerSeed: SEED_A,
  seasonIndex,
  world,
});

/** All dataset player ids that actually have cards, with order-sorted cards. */
const cardsByPlayer = new Map<string, { order: number; overall: number }[]>();
for (const card of playerCards) {
  const order = seasonById.get(card.seasonId)?.order ?? 0;
  const list = cardsByPlayer.get(card.playerId) ?? [];
  list.push({ order, overall: finalOverall(card) });
  cardsByPlayer.set(card.playerId, list);
}
for (const list of cardsByPlayer.values()) list.sort((a, b) => a.order - b.order);
const allPlayerIds = [...cardsByPlayer.keys()];
const samplePlayerIds = allPlayerIds.slice(0, 40);

/** Deterministic fake Rng: next() always returns `v` (only chance() matters here). */
const fixedRng = (v: number): Rng => ({
  next: () => v,
  int: (min) => min,
  range: (min) => min,
  roll: (min) => min,
  chance: (p) => v < p,
  pick: (arr) => arr[0],
  weightedPick: (arr) => arr[0],
  shuffle: (arr) => [...arr],
  state: 0,
});

const mkSquad = (over: Partial<SquadPlayer> = {}): SquadPlayer => ({
  id: "fic:EU:0",
  kind: "fictional",
  name: "Testo",
  region: "EU",
  birthYear: 2003,
  archetype: "allround",
  overall: 75,
  attrOffsets: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 },
  potential: 87,
  peakAge: 20,
  declineRate: "normal",
  role: "starter",
  salaryPerSplit: 8000,
  contractEndSeason: 2,
  trainingFocus: "balanced",
  trainingIntensity: "normal",
  scoutLevel: 1,
  splitsTogether: 1,
  joinedSeason: 0,
  gainedThisSplit: 0,
  gainedThisSeason: 0,
  ...over,
});

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

describe("seasonYear", () => {
  it("maps the historical timeline and extends into the infinite era", () => {
    expect(seasonYear(0)).toBe(2020);
    expect(seasonYear(1)).toBe(2021);
    expect(seasonYear(2)).toBe(2022);
    expect(seasonYear(3)).toBe(2024);
    expect(seasonYear(4)).toBe(2025);
    expect(seasonYear(5)).toBe(2026);
    expect(seasonYear(6)).toBe(2027); // 2026 + n - 5
    expect(seasonYear(9)).toBe(2030);
  });

  it("ageOf is the year difference", () => {
    expect(ageOf(2004, 0)).toBe(16);
    expect(ageOf(2004, 5)).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// Derivation stability
// ---------------------------------------------------------------------------

describe("derivation stability", () => {
  it("same seed → identical derived values on every call", () => {
    for (const id of samplePlayerIds.slice(0, 15)) {
      expect(deriveBirthYear(id, SEED_A)).toBe(deriveBirthYear(id, SEED_A));
      expect(deriveArchetype(id, SEED_A)).toBe(deriveArchetype(id, SEED_A));
      expect(derivePotential(id, SEED_A, 70)).toBe(derivePotential(id, SEED_A, 70));
      expect(derivePeakAge(id, SEED_A)).toBe(derivePeakAge(id, SEED_A));
      expect(deriveDeclineRate(id, SEED_A)).toBe(deriveDeclineRate(id, SEED_A));
      const arch = deriveArchetype(id, SEED_A);
      expect(deriveAttrOffsets(id, SEED_A, arch)).toEqual(deriveAttrOffsets(id, SEED_A, arch));
    }
  });

  it("different seed → the world reshuffles (some derived value differs)", () => {
    const differs = samplePlayerIds.some(
      (id) =>
        deriveBirthYear(id, SEED_A) !== deriveBirthYear(id, SEED_B) ||
        deriveArchetype(id, SEED_A) !== deriveArchetype(id, SEED_B) ||
        derivePeakAge(id, SEED_A) !== derivePeakAge(id, SEED_B),
    );
    expect(differs).toBe(true);
  });

  it("archetypes and decline rates cover their distributions", () => {
    const archetypes = new Set(allPlayerIds.map((id) => deriveArchetype(id, SEED_A)));
    expect(archetypes.size).toBeGreaterThanOrEqual(3);
    if (allPlayerIds.length >= 50) {
      const rates = new Set(allPlayerIds.map((id) => deriveDeclineRate(id, SEED_A)));
      expect(rates).toEqual(new Set(["slow", "normal", "fast"]));
    }
  });
});

// ---------------------------------------------------------------------------
// Birth years & age legality
// ---------------------------------------------------------------------------

describe("deriveBirthYear / age legality", () => {
  it("debut age is RL-realistic (13-19) at the player's first dataset season", () => {
    for (const id of samplePlayerIds) {
      const debutOrder = cardsByPlayer.get(id)![0].order;
      const debutSeason = [...seasonById.values()].find((s) => s.order === debutOrder)!;
      const debutYear = Number(/\d{4}/.exec(debutSeason.year)![0]);
      const debutAge = debutYear - deriveBirthYear(id, SEED_A);
      expect(debutAge).toBeGreaterThanOrEqual(13);
      expect(debutAge).toBeLessThanOrEqual(19);
    }
  });

  it("no visible player is ever younger than 13 at any career season", () => {
    for (const seasonIndex of [0, 2, 5]) {
      for (const id of samplePlayerIds) {
        const view = realPlayerView(id, ctxAt(seasonIndex));
        if (view) expect(view.age).toBeGreaterThanOrEqual(13);
      }
    }
  });

  it("peak ages stay inside CAREER_DEV.peakAgeRange", () => {
    const [min, max] = CAREER_DEV.peakAgeRange;
    for (const id of samplePlayerIds) {
      const peak = derivePeakAge(id, SEED_A);
      expect(peak).toBeGreaterThanOrEqual(min);
      expect(peak).toBeLessThanOrEqual(max);
    }
  });
});

// ---------------------------------------------------------------------------
// Potential
// ---------------------------------------------------------------------------

describe("derivePotential", () => {
  it("potential ≥ current overall and ≤ 99, always", () => {
    for (const id of samplePlayerIds) {
      for (const current of [62, 75.5, 90, 99]) {
        const pot = derivePotential(id, SEED_A, current);
        expect(pot).toBeGreaterThanOrEqual(current);
        expect(pot).toBeLessThanOrEqual(99);
      }
    }
  });

  it("wonderkid authenticity: a big real future ⇒ a high hidden ceiling", () => {
    // Find the dataset player with the largest first-card → best-card climb.
    let bestId = allPlayerIds[0];
    let bestGap = -1;
    for (const [id, cards] of cardsByPlayer) {
      const gap = Math.max(...cards.map((c) => c.overall)) - cards[0].overall;
      if (gap > bestGap) {
        bestGap = gap;
        bestId = id;
      }
    }
    const cards = cardsByPlayer.get(bestId)!;
    const maxFuture = Math.max(...cards.map((c) => c.overall));
    const pot = derivePotential(bestId, SEED_A, cards[0].overall);
    // Jitter floor: potential never undershoots the real ceiling by more than |jitter min|.
    expect(pot).toBeGreaterThanOrEqual(maxFuture + CAREER_DEV.potentialJitter[0]);
    expect(bestGap).toBeGreaterThanOrEqual(5); // the dataset really has wonderkids
  });

  it("jitter stays inside CAREER_DEV.potentialJitter when unclamped", () => {
    const [jMin, jMax] = CAREER_DEV.potentialJitter;
    for (const id of samplePlayerIds) {
      const maxAll = Math.max(...cardsByPlayer.get(id)!.map((c) => c.overall));
      if (maxAll + jMax > 99) continue; // 99-clamp can bind
      const pot = derivePotential(id, SEED_A, 60);
      expect(pot - maxAll).toBeGreaterThanOrEqual(jMin);
      expect(pot - maxAll).toBeLessThanOrEqual(jMax);
    }
  });

  it("card-less ids get currentOverall + endedCareerHeadroom", () => {
    expect(derivePotential("fic:EU:7", SEED_A, 70)).toBe(70 + CAREER_DEV.endedCareerHeadroom);
  });
});

// ---------------------------------------------------------------------------
// Attribute offsets
// ---------------------------------------------------------------------------

describe("deriveAttrOffsets", () => {
  it("respects the ±attrOffsetCap and follows the archetype shape", () => {
    const cap = CAREER_DEV.attrOffsetCap;
    for (const id of samplePlayerIds.slice(0, 10)) {
      const mech = deriveAttrOffsets(id, SEED_A, "mechanical");
      for (const key of STAT_KEYS) {
        expect(Math.abs(mech[key])).toBeLessThanOrEqual(cap);
      }
      expect(mech.mechanics).toBeGreaterThanOrEqual(3); // base 4 ± 1 jitter
      const all = deriveAttrOffsets(id, SEED_A, "allround");
      for (const key of STAT_KEYS) {
        expect(Math.abs(all[key])).toBeLessThanOrEqual(1); // base 0 ± 1 jitter
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Anchors & real views
// ---------------------------------------------------------------------------

describe("anchorOverall / realPlayerView", () => {
  it("anchors to the latest card at/before the given order, null pre-debut", () => {
    const id = samplePlayerIds[0];
    const cards = cardsByPlayer.get(id)!;
    expect(anchorOverall(id, cards[0].order - 1)).toBeNull();
    expect(anchorOverall(id, cards[0].order)).toBe(cards[0].overall);
    expect(anchorOverall(id, 999)).toBe(cards[cards.length - 1].overall);
  });

  it("realPlayerView: anchored on-script, off-script once a delta exists, null when retired", () => {
    // A player already debuted at career season 0 (dataset order ≤ 10).
    const id = allPlayerIds.find((p) => cardsByPlayer.get(p)![0].order <= 10)!;
    const clean = realPlayerView(id, ctxAt(0))!;
    expect(clean.anchored).toBe(true);
    expect(clean.overall).toBe(anchorOverall(id, 10));

    const world = emptyWorld();
    world.overallDelta[id] = 0; // a delta entry — even 0 — means off-script forever
    const touched = realPlayerView(id, ctxAt(0, world))!;
    expect(touched.anchored).toBe(false);

    world.overallDelta[id] = 4;
    expect(realPlayerView(id, ctxAt(0, world))!.overall).toBe(
      Math.min(99, anchorOverall(id, 10)! + 4),
    );

    const retiredWorld = emptyWorld();
    retiredWorld.retiredIds.push(id);
    expect(realPlayerView(id, ctxAt(0, retiredWorld))).toBeNull();
  });

  it("realPlayerView is null before the player's real debut season", () => {
    const lateDebut = allPlayerIds.find((p) => cardsByPlayer.get(p)![0].order > 10);
    if (!lateDebut) return; // dataset without post-2020 debuts — nothing to assert
    expect(realPlayerView(lateDebut, ctxAt(0))).toBeNull();
    const debutOrder = cardsByPlayer.get(lateDebut)![0].order;
    const seasonIndex = CAREER_SEASONS.findIndex((s) => s.order >= debutOrder);
    expect(realPlayerView(lateDebut, ctxAt(seasonIndex === -1 ? 5 : seasonIndex))).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fictional fillers & rookies
// ---------------------------------------------------------------------------

describe("fillerPlayerView", () => {
  it("is deterministic, named from the bank, aged 16-23 at season 0", () => {
    const view = fillerPlayerView("EU", 3, ctxAt(0));
    expect(view).toEqual(fillerPlayerView("EU", 3, ctxAt(0)));
    expect(view.id).toBe("fic:EU:3");
    expect(view.kind).toBe("fictional");
    expect(view.name).toBe(PLAYER_NAME_BANK.EU[3]);
    expect(view.age).toBeGreaterThanOrEqual(16);
    expect(view.age).toBeLessThanOrEqual(23);
    expect(view.potential).toBeGreaterThanOrEqual(view.overall);
    expect(view.anchored).toBe(false);
    expect(view.country).toBeTruthy();
  });

  it("wraps the name bank with a numeral suffix and ages across seasons", () => {
    const len = PLAYER_NAME_BANK.NA.length;
    const wrapped = fillerPlayerView("NA", len + 2, ctxAt(0));
    expect(wrapped.name.startsWith(PLAYER_NAME_BANK.NA[2])).toBe(true);
    expect(wrapped.name).not.toBe(PLAYER_NAME_BANK.NA[2]);

    const now = fillerPlayerView("NA", 1, ctxAt(0));
    const later = fillerPlayerView("NA", 1, ctxAt(5));
    expect(later.age - now.age).toBe(seasonYear(5) - seasonYear(0));
  });

  it("overalls sit in fillerOverallRange, with the occasional wonderkid ceiling", () => {
    const [oMin, oMax] = CAREER_WORLD.fillerOverallRange;
    let wonderkids = 0;
    for (let n = 0; n < 300; n++) {
      const view = fillerPlayerView("SAM", n, ctxAt(0));
      expect(view.overall).toBeGreaterThanOrEqual(oMin);
      expect(view.overall).toBeLessThanOrEqual(oMax);
      if (view.potential >= 88) wonderkids += 1;
    }
    expect(wonderkids).toBeGreaterThan(0); // ~5% of 300
    expect(wonderkids).toBeLessThan(60);
  });
});

describe("rookieView", () => {
  it("ranges are legal and potential is capped in the dataset era", () => {
    const [aMin, aMax] = CAREER_WORLD.rookieAgeRange;
    const [oMin, oMax] = CAREER_WORLD.rookieOverallRange;
    for (let n = 0; n < 200; n++) {
      const rook = rookieView("EU", 2, n, SEED_A, false);
      expect(rook.age).toBeGreaterThanOrEqual(aMin);
      expect(rook.age).toBeLessThanOrEqual(aMax);
      expect(rook.overall).toBeGreaterThanOrEqual(oMin);
      expect(rook.overall).toBeLessThanOrEqual(oMax);
      expect(rook.potential).toBeGreaterThanOrEqual(rook.overall);
      expect(rook.potential).toBeLessThanOrEqual(CAREER_WORLD.datasetEraPotentialCeiling);
    }
  });

  it("the generational top tier only rolls in the infinite era", () => {
    let above = 0;
    for (let n = 0; n < 300; n++) {
      const rook = rookieView("NA", 7, n, SEED_A, true);
      if (rook.potential > CAREER_WORLD.datasetEraPotentialCeiling) above += 1;
      expect(rook.potential).toBeLessThanOrEqual(99);
    }
    expect(above).toBeGreaterThan(0); // pyramid tiers 3+4 ≈ 15%
  });
});

describe("playerViewById", () => {
  it("dispatches real / fic / rook ids and applies deltas + retirement", () => {
    const realId = allPlayerIds.find((p) => cardsByPlayer.get(p)![0].order <= 10)!;
    expect(playerViewById(realId, ctxAt(0))).toEqual(realPlayerView(realId, ctxAt(0)));
    expect(playerViewById("fic:EU:3", ctxAt(0))).toEqual(fillerPlayerView("EU", 3, ctxAt(0)));

    const world = emptyWorld();
    world.overallDelta["rook:1:EU:0"] = 3;
    const rookThen = rookieView("EU", 1, 0, SEED_A, false);
    const rookNow = playerViewById("rook:1:EU:0", { careerSeed: SEED_A, seasonIndex: 4, world })!;
    expect(rookNow.overall).toBe(Math.min(99, rookThen.overall + 3));
    expect(rookNow.age).toBe(rookThen.age + (seasonYear(4) - seasonYear(1)));
    expect(playerViewById("rook:4:EU:0", ctxAt(1))).toBeNull(); // pre-intake

    const retired = emptyWorld();
    retired.retiredIds.push("fic:EU:3", realId);
    expect(playerViewById("fic:EU:3", ctxAt(0, retired))).toBeNull();
    expect(playerViewById(realId, ctxAt(0, retired))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// statsFromView & scoutedBand
// ---------------------------------------------------------------------------

describe("statsFromView", () => {
  it("clamps every attribute to 60-99 and applies flat bonuses", () => {
    const offsets = { offense: 6, defense: -6, mechanics: 0, consistency: 2, experience: 0, clutch: 0 };
    const high = statsFromView({ overall: 97, attrOffsets: offsets });
    expect(high.offense).toBe(99);
    expect(high.defense).toBe(91);
    const low = statsFromView({ overall: 61, attrOffsets: offsets });
    expect(low.defense).toBe(60);

    const boosted = statsFromView({ overall: 80, attrOffsets: offsets }, { clutch: 1, consistency: 1 });
    expect(boosted.clutch).toBe(81);
    expect(boosted.consistency).toBe(83);
    expect(boosted.offense).toBe(86); // untouched by the bonus map
  });
});

describe("scoutedBand", () => {
  it("always contains the truth, floors at the overall, caps at 99, L3 exact", () => {
    for (const level of [0, 1, 2, 3] as const) {
      for (const [pot, ovr] of [
        [88, 80],
        [95, 94],
        [99, 90],
        [73, 72],
        [84, 60],
      ]) {
        for (const pid of ["p-one", "p-two", "p-three"]) {
          const band = scoutedBand(pot, ovr, level, SEED_A, pid);
          expect(band.min).toBeLessThanOrEqual(pot);
          expect(band.max).toBeGreaterThanOrEqual(pot);
          expect(band.min).toBeGreaterThanOrEqual(Math.floor(ovr));
          expect(band.max).toBeLessThanOrEqual(99);
          expect(band.level).toBe(level);
          expect(band).toEqual(scoutedBand(pot, ovr, level, SEED_A, pid)); // deterministic
          const w = CAREER_SCOUT.bandWidthByLevel[level];
          expect(band.max - band.min).toBeLessThanOrEqual(2 * w);
          if (level === 3) {
            expect(band.min).toBe(pot);
            expect(band.max).toBe(pot);
          }
        }
      }
    }
  });

  it("is never the exactly-centered (pot−w, pot+w) band below L3", () => {
    for (const level of [0, 1, 2] as const) {
      const w = CAREER_SCOUT.bandWidthByLevel[level];
      for (let i = 0; i < 25; i++) {
        // Mid-range values so neither the overall floor nor the 99 cap binds.
        const band = scoutedBand(85, 70, level, SEED_A, `player-${i}`);
        expect(85 - band.min === w && band.max - 85 === w).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

const trainCtx = (over: Partial<Parameters<typeof trainWeek>[1]> = {}) => ({
  seasonIndex: 0,
  coachOverall: 85,
  gearBonus: 0.1,
  trainingWeekBonus: false,
  splitGained: 0,
  seasonGained: 0,
  ...over,
});

describe("trainWeek", () => {
  it("17yo with headroom gains ≈ +0.1-0.2/wk; 24yo near potential gains ~nothing", () => {
    const teen = mkSquad({ birthYear: seasonYear(0) - 17, overall: 75, potential: 87 });
    const { gained: teenGain } = trainWeek(teen, trainCtx());
    expect(teenGain).toBeGreaterThanOrEqual(0.08);
    expect(teenGain).toBeLessThanOrEqual(0.22);

    const vet = mkSquad({ birthYear: seasonYear(0) - 24, overall: 89.5, potential: 90 });
    const { gained: vetGain } = trainWeek(vet, trainCtx());
    expect(vetGain).toBeLessThan(0.02);
  });

  it("a 15yo grows much faster than a 24yo at equal headroom", () => {
    const kid = mkSquad({ birthYear: seasonYear(0) - 15, overall: 70, potential: 85 });
    const vet = mkSquad({ birthYear: seasonYear(0) - 24, overall: 70, potential: 85 });
    const kidGain = trainWeek(kid, trainCtx()).gained;
    const vetGain = trainWeek(vet, trainCtx()).gained;
    expect(kidGain).toBeGreaterThan(vetGain * 3);
  });

  it("focus trades overall share for offset growth; auto rides the coach plan", () => {
    const base = mkSquad({ birthYear: seasonYear(0) - 18, overall: 74, potential: 88 });
    const balanced = trainWeek(base, trainCtx()).gained;
    const focused = trainWeek({ ...base, trainingFocus: "mechanics" }, trainCtx());
    const auto = trainWeek({ ...base, trainingFocus: "auto" }, trainCtx()).gained;

    expect(focused.gained).toBeLessThan(balanced);
    expect(focused.gained).toBeCloseTo(balanced * CAREER_TRAINING.focusOverallShare, 1);
    expect(focused.player.attrOffsets.mechanics).toBeCloseTo(
      CAREER_TRAINING.focusOffsetPerWeek,
      5,
    );
    // With a coach, auto costs a small share; WITHOUT one it falls back to
    // balanced (the missing coach already costs via coachMult.min).
    expect(auto).toBeLessThanOrEqual(balanced);
    expect(auto).toBeCloseTo(balanced * CAREER_TRAINING.autoShare, 1);
    const autoNoCoach = trainWeek(
      { ...base, trainingFocus: "auto" },
      trainCtx({ coachOverall: null }),
    ).gained;
    const balancedNoCoach = trainWeek(base, trainCtx({ coachOverall: null })).gained;
    expect(autoNoCoach).toBe(balancedNoCoach);
  });

  it("intensity scales the tick: heavy > normal > light (v0.2)", () => {
    const base = mkSquad({ birthYear: seasonYear(0) - 18, overall: 74, potential: 88 });
    const light = trainWeek({ ...base, trainingIntensity: "light" }, trainCtx()).gained;
    const normal = trainWeek(base, trainCtx()).gained;
    const heavy = trainWeek({ ...base, trainingIntensity: "heavy" }, trainCtx()).gained;
    expect(light).toBeLessThan(normal);
    expect(heavy).toBeGreaterThan(normal);
    expect(heavy).toBeCloseTo(normal * CAREER_TRAINING.intensityMult.heavy, 1);
  });

  it("trainDay ticks at 1/trainingDaysPerWeek of a week", () => {
    const p = mkSquad({ birthYear: seasonYear(0) - 16, overall: 70, potential: 90 });
    const week = trainWeek(p, trainCtx()).gained;
    const day = trainDay(p, trainCtx()).gained;
    // floor2 rounding makes the daily tick slightly lossy — bound it instead.
    expect(day).toBeGreaterThan(0);
    expect(day).toBeLessThanOrEqual(week / (CAREER_TRAINING.trainingDaysPerWeek - 1));
  });

  it("the Training Week bonus multiplies the gain", () => {
    const p = mkSquad({ birthYear: seasonYear(0) - 18, overall: 74, potential: 88 });
    const plain = trainWeek(p, trainCtx()).gained;
    const bonus = trainWeek(p, trainCtx({ trainingWeekBonus: true })).gained;
    expect(bonus).toBeGreaterThan(plain);
    expect(bonus).toBeCloseTo(plain * (1 + CAREER_CALENDAR.trainingWeekBonus), 1);
  });

  it("split and season caps stop the gain exactly at the limit", () => {
    const p = mkSquad({ birthYear: seasonYear(0) - 16, overall: 70, potential: 90 });
    const atSplitCap = trainWeek(p, trainCtx({ splitGained: CAREER_TRAINING.maxSplitGain }));
    expect(atSplitCap.gained).toBe(0);
    expect(atSplitCap.player.overall).toBe(p.overall);

    const nearCap = trainWeek(p, trainCtx({ splitGained: CAREER_TRAINING.maxSplitGain - 0.03 }));
    expect(nearCap.gained).toBeLessThanOrEqual(0.03);

    const atSeasonCap = trainWeek(p, trainCtx({ seasonGained: CAREER_TRAINING.maxSeasonGain }));
    expect(atSeasonCap.gained).toBe(0);
  });

  it("repeated focus weeks never push the offset past the cap nor the attr past 99", () => {
    let p = mkSquad({
      birthYear: seasonYear(0) - 17,
      overall: 70,
      potential: 95,
      trainingFocus: "clutch",
    });
    for (let week = 0; week < 60; week++) {
      p = trainWeek(p, trainCtx()).player;
    }
    expect(p.attrOffsets.clutch).toBeLessThanOrEqual(CAREER_DEV.attrOffsetCap);
    expect(statsFromView(p).clutch).toBeLessThanOrEqual(99);
    expect(p.overall).toBeLessThanOrEqual(p.potential);
  });
});

describe("applyMatchXp", () => {
  it("scales with field quality, pays the sub less, and clamps the multiplier", () => {
    const p = mkSquad({ birthYear: seasonYear(0) - 18, overall: 74, potential: 88 });
    const ctx = { seasonIndex: 0, coachOverall: 85, gearBonus: 0.1, isSub: false };

    const weak = applyMatchXp(p, { ...ctx, fieldQuality: 0.25 });
    const strong = applyMatchXp(p, { ...ctx, fieldQuality: 1.5 });
    expect(strong.overall - p.overall).toBeGreaterThan(weak.overall - p.overall);

    const sub = applyMatchXp(p, { ...ctx, fieldQuality: 1.0, isSub: true });
    const starter = applyMatchXp(p, { ...ctx, fieldQuality: 1.0 });
    expect(sub.overall - p.overall).toBeLessThan(starter.overall - p.overall);

    const overclamped = applyMatchXp(p, { ...ctx, fieldQuality: 50 });
    expect(overclamped.overall).toBe(strong.overall); // clamped to fieldQualityMax
    expect(strong.overall).toBeLessThanOrEqual(p.potential);
  });
});

// ---------------------------------------------------------------------------
// Rollover
// ---------------------------------------------------------------------------

describe("squadRollover", () => {
  it("a 24yo declines (mechanics first, experience grows); a 15yo does not decline", () => {
    const vet = mkSquad({ birthYear: seasonYear(1) - 24, overall: 85 });
    const vetRes = squadRollover(vet, 1, fixedRng(0.99));
    expect(vetRes.declined).toBeGreaterThan(0);
    expect(vetRes.player.overall).toBeLessThan(vet.overall);
    expect(vetRes.player.attrOffsets.mechanics).toBeLessThan(vet.attrOffsets.mechanics);
    expect(vetRes.player.attrOffsets.experience).toBeGreaterThan(vet.attrOffsets.experience);

    const kid = mkSquad({ birthYear: seasonYear(1) - 15, overall: 70 });
    const kidRes = squadRollover(kid, 1, fixedRng(0.99));
    expect(kidRes.declined).toBe(0);
    expect(kidRes.player.overall).toBe(kid.overall);
    expect(kidRes.player.attrOffsets.experience).toBeGreaterThan(kid.attrOffsets.experience);
  });

  it("decline rate and dampen shape the drop", () => {
    const age = 25;
    const expected =
      CAREER_AGE.declineByAge.a25_26 *
      CAREER_AGE.declineRateMult.fast *
      CAREER_AGE.trainingDeclineDampen;
    const p = mkSquad({ birthYear: seasonYear(2) - age, overall: 88, declineRate: "fast" });
    const res = squadRollover(p, 2, fixedRng(0.99));
    expect(res.declined).toBeCloseTo(expected, 2);
  });

  it("retirement: announced final season retires now; the age roll announces one ahead", () => {
    const announced = mkSquad({
      birthYear: seasonYear(3) - 26,
      finalSeasonAnnounced: true,
    });
    const out = squadRollover(announced, 3, fixedRng(0.99));
    expect(out.retiresNow).toBe(true);
    expect(out.announcedRetirement).toBe(false);

    const young = mkSquad({ birthYear: seasonYear(1) - 18 });
    expect(squadRollover(young, 1, fixedRng(0)).announcedRetirement).toBe(false); // no roll < 23

    const old = mkSquad({ birthYear: seasonYear(1) - 27, overall: 78 });
    const hit = squadRollover(old, 1, fixedRng(0));
    expect(hit.announcedRetirement).toBe(true);
    expect(hit.retiresNow).toBe(false);
    expect(hit.player.finalSeasonAnnounced).toBe(true);
  });

  it("stars linger: the same roll retires a 78 OVR but not a 90 OVR 27yo", () => {
    // p(27) = 0.55 → star p = 0.275. A 0.3 roll hits only the non-star.
    const roll = fixedRng(0.3);
    const normal = mkSquad({ birthYear: seasonYear(1) - 27, overall: 78 });
    const star = mkSquad({ birthYear: seasonYear(1) - 27, overall: 90 });
    expect(squadRollover(normal, 1, roll).announcedRetirement).toBe(true);
    expect(squadRollover(star, 1, fixedRng(0.3)).announcedRetirement).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Field quality
// ---------------------------------------------------------------------------

describe("fieldQualityFor", () => {
  it("ramps between the anchors and clamps outside them", () => {
    const { fieldQualityMin, fieldQualityMax, fieldQualityAnchor } = CAREER_TRAINING;
    expect(fieldQualityFor([fieldQualityAnchor[0], fieldQualityAnchor[0]])).toBeCloseTo(
      fieldQualityMin,
      5,
    );
    expect(fieldQualityFor([fieldQualityAnchor[1]])).toBeCloseTo(fieldQualityMax, 5);
    const mid = (fieldQualityAnchor[0] + fieldQualityAnchor[1]) / 2;
    expect(fieldQualityFor([mid])).toBeCloseTo((fieldQualityMin + fieldQualityMax) / 2, 5);
    expect(fieldQualityFor([50, 55])).toBe(fieldQualityMin);
    expect(fieldQualityFor([99, 99])).toBe(fieldQualityMax);
    expect(fieldQualityFor([])).toBe(fieldQualityMin);
  });
});
