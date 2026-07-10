/**
 * Road to Worlds — player development & derivation (design doc §8).
 *
 * Everything derivable about a world player — birth year, archetype, attribute
 * offsets, hidden potential, peak age, decline rate — is DERIVED from
 * (careerSeed, playerId) by pure functions instead of stored: the save keeps
 * deltas and decisions, this module recomputes the rest on demand. Real players
 * anchor to their dataset cards; fictional fillers/rookies derive everything
 * from their generated id.
 *
 * Engine rules: pure TS, no React, no storage; per-entity randomness through
 * `derivedFloat` (cursor-free), rollover rolls through the injected Rng.
 * All tunables from `@/config/balance` CAREER_* groups.
 */

import {
  CAREER_AGE,
  CAREER_CALENDAR,
  CAREER_DEV,
  CAREER_SCOUT,
  CAREER_SEASONS,
  CAREER_TRAINING,
  CAREER_WORLD,
} from "@/config/balance";
import { playerById, playerCards, seasonById } from "@/data";
import { PLAYER_NAME_BANK } from "@/data/career/names";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/util";
import { finalOverall } from "../cards";
import type { PlayerCard, Region, StatKey, Stats } from "../types";
import { derivedFloat, streams } from "./seeds";
import type {
  ArchetypeId,
  CareerPlayerView,
  DeclineRate,
  PotentialBand,
  ScoutLevel,
  SquadPlayer,
  WorldState,
} from "./types";

// ---------------------------------------------------------------------------
// Local constants (frozen shapes; candidates for balance.ts if ever re-tuned)
// ---------------------------------------------------------------------------

const STAT_KEYS: StatKey[] = [
  "offense",
  "defense",
  "mechanics",
  "consistency",
  "experience",
  "clutch",
];

/** Fixed pick order for the archetype roll — NEVER reorder (derivation stability). */
const ARCHETYPES: ArchetypeId[] = [
  "allround",
  "mechanical",
  "playmaker",
  "anchor",
  "icecold",
  "veteranmind",
];

/**
 * Archetype base attribute offsets (design §8: sum ~0, flavor not roles).
 * Pinned by the cross-module contract; if these ever become tunable they move
 * to CAREER_DEV.
 */
const ARCHETYPE_OFFSETS: Record<ArchetypeId, Record<StatKey, number>> = {
  mechanical: { mechanics: 4, offense: 2, consistency: -3, defense: -2, experience: -1, clutch: 0 },
  anchor: { defense: 4, consistency: 3, offense: -4, mechanics: -2, experience: 0, clutch: -1 },
  playmaker: { offense: 3, mechanics: 1, experience: 1, defense: -2, consistency: -1, clutch: -2 },
  icecold: { clutch: 4, consistency: 2, mechanics: -1, offense: -1, defense: -1, experience: -3 },
  veteranmind: { experience: 4, consistency: 2, defense: 1, mechanics: -4, offense: -2, clutch: -1 },
  allround: { offense: 0, defense: 0, mechanics: 0, consistency: 0, experience: 0, clutch: 0 },
};

/** Fictional filler ages (design §10 filler world) — contract-pinned 16-23. */
const FILLER_AGE_RANGE: readonly [number, number] = [16, 23];
/** Wonderkid filler hidden ceiling band — contract-pinned 88-95. */
const FILLER_WONDERKID_POTENTIAL: readonly [number, number] = [88, 95];
/** "Stars linger" retirement threshold (design §8) — contract-pinned OVR 85. */
const RETIREMENT_STAR_OVERALL = 85;
/** No player is ever younger than this at any season they appear in. */
const MIN_AGE = 13;

/** Plausible ISO2 nationalities per region for generated fictional players. */
const REGION_COUNTRIES: Record<Region, readonly string[]> = {
  NA: ["US", "CA", "MX"],
  EU: ["FR", "DE", "GB", "ES", "NL", "SE", "DK"],
  SAM: ["BR", "AR", "CL"],
  MENA: ["SA", "AE", "MA", "KW"],
  OCE: ["AU", "NZ"],
  APAC: ["JP", "KR", "SG"],
  SSA: ["ZA", "NG", "KE"],
};

// ---------------------------------------------------------------------------
// Small deterministic helpers
// ---------------------------------------------------------------------------

const round2 = (n: number): number => Math.round(n * 100) / 100;
/** Round DOWN to 2 decimals — used for capped gains so totals never exceed a cap. */
const floor2 = (n: number): number => Math.floor(n * 100) / 100;

/** Uniform int in [min, max] from a 0..1 float. */
function intFrom(f: number, min: number, max: number): number {
  return min + Math.floor(f * (max - min + 1));
}

/** Deterministic weighted pick from a fixed-order item list. */
function weightedFrom<T>(f: number, items: readonly T[], weightOf: (item: T) => number): T {
  let total = 0;
  for (const item of items) total += Math.max(0, weightOf(item));
  if (total <= 0) return items[0];
  let target = f * total;
  for (const item of items) {
    target -= Math.max(0, weightOf(item));
    if (target <= 0) return item;
  }
  return items[items.length - 1];
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const roman = (n: number): string => ROMAN[n] ?? `x${n}`;

/** First 4-digit year in a season's `year` label ("2020-21" → 2020). */
function parseFirstYear(label: string): number {
  const match = /\d{4}/.exec(label);
  return match ? Number(match[0]) : NaN;
}

/** Player cards ordered by season chronology, per player (built once). */
const cardsByPlayer: Map<string, PlayerCard[]> = (() => {
  const map = new Map<string, PlayerCard[]>();
  for (const card of playerCards) {
    const list = map.get(card.playerId);
    if (list) list.push(card);
    else map.set(card.playerId, [card]);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) => (seasonById.get(a.seasonId)?.order ?? 0) - (seasonById.get(b.seasonId)?.order ?? 0),
    );
  }
  return map;
})();

const cardOrder = (card: PlayerCard): number => seasonById.get(card.seasonId)?.order ?? 0;

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** Calendar year a season starts (2020,2021,2022,2024,2025,2026; infinite: 2026+n-5). */
export function seasonYear(seasonIndex: number): number {
  const last = CAREER_SEASONS.length - 1;
  if (seasonIndex <= last) {
    return parseFirstYear(CAREER_SEASONS[Math.max(0, seasonIndex)].year);
  }
  return parseFirstYear(CAREER_SEASONS[last].year) + (seasonIndex - last);
}

export function ageOf(birthYear: number, seasonIndex: number): number {
  return seasonYear(seasonIndex) - birthYear;
}

/** Dataset season `order` a career seasonIndex maps to (0..5 → 10..15; infinite extends). */
function seasonOrderFor(seasonIndex: number): number {
  const last = CAREER_SEASONS.length - 1;
  if (seasonIndex <= last) return CAREER_SEASONS[Math.max(0, seasonIndex)].order;
  return CAREER_SEASONS[last].order + (seasonIndex - last);
}

// ---------------------------------------------------------------------------
// Real-player derivation (stable per careerSeed + playerId)
// ---------------------------------------------------------------------------

/**
 * Debut-age inference: the first dataset card's season gives the debut year;
 * a weighted debut age (13-17) is sampled per career, biased one year younger
 * when the player's last-2-cards trend is rising (still ascending → young) and
 * one year older when falling. Ages never go below 13 at any appearance.
 */
export function deriveBirthYear(playerId: string, careerSeed: number): number {
  const cards = cardsByPlayer.get(playerId);
  const debutYear =
    cards && cards.length > 0
      ? parseFirstYear(seasonById.get(cards[0].seasonId)?.year ?? "") || seasonYear(0)
      : seasonYear(0);

  const f = derivedFloat(careerSeed, streams.gen("age", playerId));
  const ages = Object.keys(CAREER_DEV.debutAgeWeights)
    .map(Number)
    .sort((a, b) => a - b);
  const sampled = weightedFrom(f, ages, (a) => CAREER_DEV.debutAgeWeights[a] ?? 0);

  let bias = 0;
  if (cards && cards.length >= 2) {
    const prev = finalOverall(cards[cards.length - 2]);
    const lastOverall = finalOverall(cards[cards.length - 1]);
    if (lastOverall > prev) bias = -1;
    else if (lastOverall < prev) bias = 1;
  }

  // The debut season is the player's EARLIEST appearance, so clamping the debut
  // age at 13 keeps every later appearance ≥ 13 too.
  const debutAge = Math.max(MIN_AGE, sampled + bias);
  return debutYear - debutAge;
}

export function deriveArchetype(playerId: string, careerSeed: number): ArchetypeId {
  const f = derivedFloat(careerSeed, streams.gen("arch", playerId));
  return weightedFrom(f, ARCHETYPES, (a) => CAREER_DEV.archetypeWeights[a] ?? 0);
}

export function deriveAttrOffsets(
  playerId: string,
  careerSeed: number,
  archetype: ArchetypeId,
): Record<StatKey, number> {
  const base = ARCHETYPE_OFFSETS[archetype];
  const cap = CAREER_DEV.attrOffsetCap;
  const out = {} as Record<StatKey, number>;
  for (const key of STAT_KEYS) {
    const jitter = intFrom(derivedFloat(careerSeed, streams.gen("attr", `${playerId}:${key}`)), -1, 1);
    out[key] = clamp(base[key] + jitter, -cap, cap);
  }
  return out;
}

/**
 * Hidden ceiling. Real players: max overall across their cards from their debut
 * on (their real future — wonderkids are the real ones) + a small jitter.
 * No cards at all (fictional ids / ended careers with nothing ahead) → modest
 * headroom over the current overall. Always within [currentOverall, 99].
 */
export function derivePotential(
  playerId: string,
  careerSeed: number,
  currentOverall: number,
): number {
  const cards = cardsByPlayer.get(playerId);
  let base: number;
  if (!cards || cards.length === 0) {
    base = currentOverall + CAREER_DEV.endedCareerHeadroom;
  } else {
    const debutOrder = cardOrder(cards[0]);
    let best = -Infinity;
    for (const card of cards) {
      if (cardOrder(card) >= debutOrder) best = Math.max(best, finalOverall(card));
    }
    const f = derivedFloat(careerSeed, streams.gen("pot", playerId));
    const [jMin, jMax] = CAREER_DEV.potentialJitter;
    base = best + intFrom(f, jMin, jMax);
  }
  return clamp(base, currentOverall, 99);
}

export function derivePeakAge(playerId: string, careerSeed: number): number {
  const [min, max] = CAREER_DEV.peakAgeRange;
  return intFrom(derivedFloat(careerSeed, streams.gen("peak", playerId)), min, max);
}

export function deriveDeclineRate(playerId: string, careerSeed: number): DeclineRate {
  const f = derivedFloat(careerSeed, streams.gen("decline", playerId));
  const rates: DeclineRate[] = ["slow", "normal", "fast"];
  return weightedFrom(f, rates, (r) => CAREER_AGE.declineRateDist[r] ?? 0);
}

/** Latest dataset card overall at/before this season order; null = not yet debuted. */
export function anchorOverall(playerId: string, seasonOrder: number): number | null {
  const cards = cardsByPlayer.get(playerId);
  if (!cards || cards.length === 0) return null;
  let latest: PlayerCard | null = null;
  for (const card of cards) {
    if (cardOrder(card) <= seasonOrder) latest = card; // cards are order-sorted
    else break;
  }
  return latest ? finalOverall(latest) : null;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface ViewCtx {
  careerSeed: number;
  seasonIndex: number;
  world: WorldState;
}

/**
 * Full view of a REAL dataset player right now. Null when not yet debuted
 * (no card at/before the current season order) or retired from the world.
 * Anchored players read straight off their dataset cards; once the world sim
 * or a user signing writes an overallDelta entry the player is permanently
 * off-script (`anchored: false`), even at delta 0.
 */
export function realPlayerView(playerId: string, ctx: ViewCtx): CareerPlayerView | null {
  if (ctx.world.retiredIds.includes(playerId)) return null;
  const anchor = anchorOverall(playerId, seasonOrderFor(ctx.seasonIndex));
  if (anchor === null) return null;
  const player = playerById.get(playerId);
  if (!player) return null;

  const offScript = playerId in ctx.world.overallDelta;
  const overall = clamp(anchor + (ctx.world.overallDelta[playerId] ?? 0), 60, 99);
  const archetype = deriveArchetype(playerId, ctx.careerSeed);
  return {
    id: playerId,
    kind: "real",
    name: player.nickname,
    country: player.country,
    region: player.region,
    age: ageOf(deriveBirthYear(playerId, ctx.careerSeed), ctx.seasonIndex),
    archetype,
    overall,
    attrOffsets: deriveAttrOffsets(playerId, ctx.careerSeed, archetype),
    potential: derivePotential(playerId, ctx.careerSeed, overall),
    peakAge: derivePeakAge(playerId, ctx.careerSeed),
    declineRate: deriveDeclineRate(playerId, ctx.careerSeed),
    anchored: !offScript,
  };
}

/**
 * Deterministic fictional filler (id "fic:{region}:{n}"). Name from the bank
 * (numeral suffix once the bank wraps), base overall in fillerOverallRange,
 * small wonderkid chance; ages tick with the career calendar from seasonIndex 0.
 */
export function fillerPlayerView(region: Region, n: number, ctx: ViewCtx): CareerPlayerView {
  const id = `fic:${region}:${n}`;
  const key = `${region}:${n}`;
  const bank = PLAYER_NAME_BANK[region];
  const wrap = Math.floor(n / bank.length);
  const name = bank[n % bank.length] + (wrap > 0 ? ` ${roman(wrap + 1)}` : "");

  const [oMin, oMax] = CAREER_WORLD.fillerOverallRange;
  const baseOverall = intFrom(derivedFloat(ctx.careerSeed, streams.gen("fic-ovr", key)), oMin, oMax);
  const overall = clamp(baseOverall + (ctx.world.overallDelta[id] ?? 0), 60, 99);

  const wonderkid =
    derivedFloat(ctx.careerSeed, streams.gen("fic-wk", key)) < CAREER_WORLD.fillerWonderkidChance;
  const potential = wonderkid
    ? Math.max(
        intFrom(
          derivedFloat(ctx.careerSeed, streams.gen("fic-pot", key)),
          FILLER_WONDERKID_POTENTIAL[0],
          FILLER_WONDERKID_POTENTIAL[1],
        ),
        overall,
      )
    : derivePotential(id, ctx.careerSeed, overall);

  const age0 = intFrom(
    derivedFloat(ctx.careerSeed, streams.gen("fic-age", key)),
    FILLER_AGE_RANGE[0],
    FILLER_AGE_RANGE[1],
  );
  const birthYear = seasonYear(0) - age0;

  const countries = REGION_COUNTRIES[region];
  const country =
    countries[intFrom(derivedFloat(ctx.careerSeed, streams.gen("fic-country", key)), 0, countries.length - 1)];

  const archetype = deriveArchetype(id, ctx.careerSeed);
  return {
    id,
    kind: "fictional",
    name,
    country,
    region,
    age: ageOf(birthYear, ctx.seasonIndex),
    archetype,
    overall,
    attrOffsets: deriveAttrOffsets(id, ctx.careerSeed, archetype),
    potential,
    peakAge: derivePeakAge(id, ctx.careerSeed),
    declineRate: deriveDeclineRate(id, ctx.careerSeed),
    anchored: false,
  };
}

/**
 * Procedural rookie (id "rook:{seasonIndex}:{region}:{n}"), generated at the
 * given season's intake. Potential rolls the pyramid; the "generational" top
 * tier is reachable only in the infinite era — the dataset era caps at
 * datasetEraPotentialCeiling so procedural kids never out-legend the real ones.
 */
export function rookieView(
  region: Region,
  seasonIndex: number,
  n: number,
  careerSeed: number,
  infinite: boolean,
): CareerPlayerView {
  const id = `rook:${seasonIndex}:${region}:${n}`;
  const key = `${seasonIndex}:${region}:${n}`;
  const bank = PLAYER_NAME_BANK[region];
  const name = bank[intFrom(derivedFloat(careerSeed, streams.gen("rook-name", key)), 0, bank.length - 1)];

  const [aMin, aMax] = CAREER_WORLD.rookieAgeRange;
  const age = intFrom(derivedFloat(careerSeed, streams.gen("rook-age", key)), aMin, aMax);
  const [oMin, oMax] = CAREER_WORLD.rookieOverallRange;
  const overall = intFrom(derivedFloat(careerSeed, streams.gen("rook-ovr", key)), oMin, oMax);

  const tier = weightedFrom(
    derivedFloat(careerSeed, streams.gen("rook-tier", key)),
    CAREER_WORLD.rookiePotentialPyramid,
    (t) => t.p,
  );
  let potential = intFrom(
    derivedFloat(careerSeed, streams.gen("rook-pot", key)),
    tier.range[0],
    tier.range[1],
  );
  if (!infinite) potential = Math.min(potential, CAREER_WORLD.datasetEraPotentialCeiling);
  potential = clamp(potential, overall, 99);

  const countries = REGION_COUNTRIES[region];
  const country =
    countries[intFrom(derivedFloat(careerSeed, streams.gen("rook-country", key)), 0, countries.length - 1)];

  const archetype = deriveArchetype(id, careerSeed);
  return {
    id,
    kind: "fictional",
    name,
    country,
    region,
    age,
    archetype,
    overall,
    attrOffsets: deriveAttrOffsets(id, careerSeed, archetype),
    potential,
    peakAge: derivePeakAge(id, careerSeed),
    declineRate: deriveDeclineRate(id, careerSeed),
    anchored: false,
  };
}

const REGION_SET = new Set<string>(Object.keys(PLAYER_NAME_BANK));

/**
 * ANY world player view by id — dispatches real / "fic:" / "rook:" ids, applies
 * world.overallDelta, and returns null for retired (any kind) or not-yet-debuted
 * players (real pre-debut, rookies before their intake season).
 */
export function playerViewById(id: string, ctx: ViewCtx): CareerPlayerView | null {
  if (ctx.world.retiredIds.includes(id)) return null;

  if (id.startsWith("fic:")) {
    const [, region, nRaw] = id.split(":");
    const n = Number(nRaw);
    if (!REGION_SET.has(region) || !Number.isInteger(n) || n < 0) return null;
    return fillerPlayerView(region as Region, n, ctx);
  }

  if (id.startsWith("rook:")) {
    const [, sRaw, region, nRaw] = id.split(":");
    const genSeason = Number(sRaw);
    const n = Number(nRaw);
    if (!REGION_SET.has(region) || !Number.isInteger(genSeason) || !Number.isInteger(n) || n < 0) {
      return null;
    }
    if (genSeason > ctx.seasonIndex) return null; // not yet in the world
    const infinite = genSeason >= CAREER_SEASONS.length;
    const base = rookieView(region as Region, genSeason, n, ctx.careerSeed, infinite);
    const overall = clamp(base.overall + (ctx.world.overallDelta[id] ?? 0), 60, 99);
    return {
      ...base,
      age: base.age + (seasonYear(ctx.seasonIndex) - seasonYear(genSeason)),
      overall,
      potential: Math.max(base.potential, overall),
    };
  }

  return realPlayerView(id, ctx);
}

// ---------------------------------------------------------------------------
// Stats & scouting
// ---------------------------------------------------------------------------

/**
 * Stats block for team assembly: clamp(round(overall + offset + flat bonus))
 * per key, 60-99. `bonus` carries flat squad perks (psychologist).
 */
export function statsFromView(
  view: { overall: number; attrOffsets: Record<StatKey, number> },
  bonus?: Partial<Record<StatKey, number>>,
): Stats {
  const out = {} as Stats;
  for (const key of STAT_KEYS) {
    out[key] = clamp(
      Math.round(view.overall + (view.attrOffsets[key] ?? 0) + (bonus?.[key] ?? 0)),
      60,
      99,
    );
  }
  return out;
}

/**
 * Spoiler-safe potential band. Always contains the truth, never prints it:
 * the band is off-center by a stable per-(player,level) jitter so its midpoint
 * never gives the scalar away; min never dips below the current overall
 * (floored) and max never exceeds 99. Level 3 = exact.
 */
export function scoutedBand(
  potential: number,
  overall: number,
  level: ScoutLevel,
  careerSeed: number,
  playerId: string,
): PotentialBand {
  const w = CAREER_SCOUT.bandWidthByLevel[level] ?? 0;
  if (w <= 0) {
    const exact = Math.round(potential);
    return { min: exact, max: exact, level };
  }
  const f = derivedFloat(careerSeed, streams.gen("band", `${playerId}:${level}`));
  // Split the 2w total width unevenly around the truth (never below === above).
  let below = Math.floor(f * 2 * w); // 0 .. 2w-1
  if (below >= w) below += 1; // skip the exact center → 0..2w minus w
  const min = Math.max(Math.floor(potential - below), Math.floor(overall));
  const max = Math.min(Math.ceil(potential + (2 * w - below)), 99);
  return { min, max, level };
}

// ---------------------------------------------------------------------------
// Training (weekly tick) & match XP
// ---------------------------------------------------------------------------

function growthMultFor(age: number): number {
  const g = CAREER_AGE.growthMult;
  if (age <= 16) return g.u16;
  if (age <= 18) return g.a17_18;
  if (age <= 20) return g.a19_20;
  if (age <= 22) return g.a21_22;
  if (age <= 24) return g.a23_24;
  return g.a25plus;
}

function coachMultFor(coachOverall: number | null): number {
  const { perPoint, min, max } = CAREER_TRAINING.coachMult;
  if (coachOverall === null) return min;
  return clamp(1 + (coachOverall - 75) * perPoint, min, max);
}

interface GainCtx {
  seasonIndex: number;
  coachOverall: number | null;
  /** Additive training-efficiency bonus from the gear ladder (0..~0.35). */
  gearBonus: number;
  trainingWeekBonus: boolean;
  /** Training-week equivalents applied at once (match XP multiplies here). */
  weeks: number;
}

/**
 * Overall-rate share of a focus mode (v0.2 rebalance): balanced trains pure
 * overall; a single-attribute focus trades a slice of overall for offset
 * growth; auto is the coach's near-optimal plan — WITHOUT a coach it falls
 * back to balanced (the missing coach already costs via coachMult.min).
 */
export function focusShareFor(
  focus: SquadPlayer["trainingFocus"],
  coachOverall: number | null,
): number {
  if (focus === "auto") {
    return coachOverall !== null ? CAREER_TRAINING.autoShare : CAREER_TRAINING.balancedShare;
  }
  if (focus === "balanced") return CAREER_TRAINING.balancedShare;
  return CAREER_TRAINING.focusOverallShare;
}

/** Session intensity multiplier (v0.2: light/normal/heavy). */
export function intensityMultFor(intensity: SquadPlayer["trainingIntensity"]): number {
  return CAREER_TRAINING.intensityMult[intensity ?? "normal"] ?? 1;
}

/** Raw overall gain for `weeks` training-week equivalents (before caps). */
function rawGain(p: SquadPlayer, ctx: GainCtx): number {
  const age = ageOf(p.birthYear, ctx.seasonIndex);
  const headroom = Math.max(0, p.potential - p.overall);
  const headroomMult = headroom / (headroom + CAREER_TRAINING.headroomSoftK);
  return (
    CAREER_TRAINING.weeklyBase *
    growthMultFor(age) *
    headroomMult *
    coachMultFor(ctx.coachOverall) *
    (1 + ctx.gearBonus) *
    focusShareFor(p.trainingFocus, ctx.coachOverall) *
    intensityMultFor(p.trainingIntensity) *
    (ctx.trainingWeekBonus ? 1 + CAREER_CALENDAR.trainingWeekBonus : 1) *
    ctx.weeks
  );
}

/** Focused-attribute offset growth for `weeks` (respects the cap and attr ≤ 99). */
function grownOffsets(
  p: SquadPlayer,
  weeks: number,
  newOverall: number,
): Record<StatKey, number> {
  const focus = p.trainingFocus;
  if (focus === "balanced" || focus === "auto") return { ...p.attrOffsets };
  const cap = CAREER_DEV.attrOffsetCap;
  const current = p.attrOffsets[focus] ?? 0;
  // Grow, but never past the offset cap nor past a visible 99 attribute —
  // and never *reduce* an already-high offset.
  const allowedMax = Math.min(cap, Math.max(current, 99 - newOverall));
  const next = Math.min(current + CAREER_TRAINING.focusOffsetPerWeek * weeks, allowedMax);
  return { ...p.attrOffsets, [focus]: round2(Math.max(next, -cap)) };
}

export interface TrainTickCtx {
  seasonIndex: number;
  coachOverall: number | null;
  /** Additive training-efficiency bonus from the gear ladder. */
  gearBonus: number;
  trainingWeekBonus: boolean;
  splitGained: number;
  seasonGained: number;
  /** Training-week equivalents (1 = a full week; a weekday = 1/trainingDaysPerWeek). */
  weeks?: number;
}

/**
 * One training tick for a USER squad player — `weeks` training-week
 * equivalents (default 1; the v0.2 day clock ticks Mon-Fri at
 * 1/trainingDaysPerWeek each). Applies age/headroom/coach/gear multipliers,
 * the Training Week bonus, the focus share + intensity (v0.2), focused
 * offset growth, and the split/season gain caps (via ctx.splitGained/
 * seasonGained). The returned player carries updated accumulators.
 */
export function trainWeek(
  p: SquadPlayer,
  ctx: TrainTickCtx,
): { player: SquadPlayer; gained: number } {
  const weeks = ctx.weeks ?? 1;
  const raw = rawGain(p, { ...ctx, weeks });
  const gained = floor2(
    Math.max(
      0,
      Math.min(
        raw,
        CAREER_TRAINING.maxSplitGain - ctx.splitGained,
        CAREER_TRAINING.maxSeasonGain - ctx.seasonGained,
        p.potential - p.overall,
      ),
    ),
  );
  const overall = clamp(round2(p.overall + gained), 60, 99);
  return {
    player: {
      ...p,
      overall,
      attrOffsets: grownOffsets(p, weeks, overall),
      gainedThisSplit: round2(ctx.splitGained + gained),
      gainedThisSeason: round2(ctx.seasonGained + gained),
    },
    gained,
  };
}

/** One weekday of training (the v0.2 daily tick). */
export function trainDay(
  p: SquadPlayer,
  ctx: Omit<TrainTickCtx, "weeks">,
): { player: SquadPlayer; gained: number } {
  return trainWeek(p, { ...ctx, weeks: 1 / CAREER_TRAINING.trainingDaysPerWeek });
}

/**
 * Truthful UI projection (v0.2 — the Training screen must not re-implement
 * engine math): expected overall gain per WEEK plus the focused-offset weekly
 * growth, before split/season caps.
 */
export function trainingProjection(
  p: SquadPlayer,
  ctx: {
    seasonIndex: number;
    coachOverall: number | null;
    gearBonus: number;
    trainingWeekBonus: boolean;
  },
): { weeklyOverall: number; weeklyOffset: number } {
  const weeklyOverall = round2(
    Math.max(0, Math.min(rawGain(p, { ...ctx, weeks: 1 }), p.potential - p.overall)),
  );
  const focused = p.trainingFocus !== "balanced" && p.trainingFocus !== "auto";
  return {
    weeklyOverall,
    weeklyOffset: focused ? CAREER_TRAINING.focusOffsetPerWeek : 0,
  };
}

/**
 * Field-quality-scaled match XP (design §8): an event grants bonus training
 * weeks — weeks = matchXpWeeks × fieldQuality (clamped) × subXpFactor for the
 * registered sub — applied as ONE multiplied gain (no rng, no loop). Reads and
 * bumps the player's own gainedThisSplit/gainedThisSeason accumulators, so the
 * split/season caps hold across training + match XP combined.
 */
export function applyMatchXp(
  p: SquadPlayer,
  ctx: {
    seasonIndex: number;
    fieldQuality: number;
    isSub: boolean;
    coachOverall: number | null;
    gearBonus: number;
    /** Scale for partial match XP (scrims grant a fraction; default 1). */
    xpWeeksOverride?: number;
  },
): SquadPlayer {
  const quality = clamp(
    ctx.fieldQuality,
    CAREER_TRAINING.fieldQualityMin,
    CAREER_TRAINING.fieldQualityMax,
  );
  const baseWeeks = ctx.xpWeeksOverride ?? CAREER_TRAINING.matchXpWeeks;
  const weeks = baseWeeks * quality * (ctx.isSub ? CAREER_TRAINING.subXpFactor : 1);
  const raw = rawGain(p, {
    seasonIndex: ctx.seasonIndex,
    coachOverall: ctx.coachOverall,
    gearBonus: ctx.gearBonus,
    trainingWeekBonus: false,
    weeks,
  });
  const gained = floor2(
    Math.max(
      0,
      Math.min(
        raw,
        CAREER_TRAINING.maxSplitGain - p.gainedThisSplit,
        CAREER_TRAINING.maxSeasonGain - p.gainedThisSeason,
        p.potential - p.overall,
      ),
    ),
  );
  const overall = clamp(round2(p.overall + gained), 60, 99);
  return {
    ...p,
    overall,
    attrOffsets: grownOffsets(p, weeks, overall),
    gainedThisSplit: round2(p.gainedThisSplit + gained),
    gainedThisSeason: round2(p.gainedThisSeason + gained),
  };
}

// ---------------------------------------------------------------------------
// Season rollover (user squad)
// ---------------------------------------------------------------------------

/**
 * Season rollover for a USER squad player. `seasonIndex` is the NEW season
 * (already incremented) — the age tick is implicit. Applies the age-curve
 * decline (dampened by active training — in v1 every squad player has a
 * training focus set, so the dampen always applies), the mechanics-first /
 * experience-grows offset drift, and the retirement rolls: an announced final
 * season retires NOW; otherwise the age roll (halved for stars) announces
 * retirement one season ahead — never an abrupt exit. `rng` = rollover stream.
 */
export function squadRollover(
  p: SquadPlayer,
  seasonIndex: number,
  rng: Rng,
): { player: SquadPlayer; declined: number; announcedRetirement: boolean; retiresNow: boolean } {
  const age = ageOf(p.birthYear, seasonIndex);
  const cap = CAREER_DEV.attrOffsetCap;

  const d = CAREER_AGE.declineByAge;
  const baseDecline = age >= 27 ? d.a27plus : age >= 25 ? d.a25_26 : age >= 23 ? d.a23_24 : age >= 22 ? d.a22 : 0;
  const declineAmount =
    baseDecline *
    (CAREER_AGE.declineRateMult[p.declineRate] ?? 1) *
    // v1: training focus is always set (auto by default), so active-training
    // dampening applies to every squad player.
    CAREER_AGE.trainingDeclineDampen;

  const overall = clamp(round2(p.overall - declineAmount), 60, 99);
  const declined = round2(p.overall - overall);

  const attrOffsets = { ...p.attrOffsets };
  if (declined > 0) {
    // Mechanics decline first…
    attrOffsets.mechanics = round2(
      Math.max(attrOffsets.mechanics - CAREER_AGE.mechanicsDeclineOffset, -cap),
    );
  }
  // …experience grows with every season played.
  attrOffsets.experience = round2(
    Math.min(attrOffsets.experience + CAREER_AGE.expGrowthPerSeason, cap),
  );

  if (p.finalSeasonAnnounced) {
    return {
      player: { ...p, overall, attrOffsets, gainedThisSplit: 0, gainedThisSeason: 0 },
      declined,
      announcedRetirement: false,
      retiresNow: true,
    };
  }

  const baseChance = CAREER_AGE.retirementByAge[Math.min(age, 28)] ?? 0;
  const chance =
    baseChance * (p.overall >= RETIREMENT_STAR_OVERALL ? CAREER_AGE.retirementStarMult : 1);
  // Always consume exactly one roll — keeps the rollover stream stable per player.
  const announcedRetirement = rng.chance(chance);

  return {
    player: {
      ...p,
      overall,
      attrOffsets,
      ...(announcedRetirement ? { finalSeasonAnnounced: true } : {}),
    },
    declined,
    announcedRetirement,
    retiresNow: false,
  };
}

// ---------------------------------------------------------------------------
// Field quality
// ---------------------------------------------------------------------------

/**
 * Field-quality multiplier for match XP: the average field rating ramps
 * linearly between the CAREER_TRAINING anchors → [fieldQualityMin, fieldQualityMax].
 */
export function fieldQualityFor(fieldRatings: number[]): number {
  const { fieldQualityMin, fieldQualityMax, fieldQualityAnchor } = CAREER_TRAINING;
  if (fieldRatings.length === 0) return fieldQualityMin;
  const avg = fieldRatings.reduce((sum, r) => sum + r, 0) / fieldRatings.length;
  const [lo, hi] = fieldQualityAnchor;
  const t = (avg - lo) / (hi - lo);
  return clamp(
    fieldQualityMin + t * (fieldQualityMax - fieldQualityMin),
    fieldQualityMin,
    fieldQualityMax,
  );
}
