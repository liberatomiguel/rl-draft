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
  BUFF_LEVEL_VALUE,
  CAREER_AGE,
  CAREER_CALENDAR,
  CAREER_DEV,
  CAREER_SCOUT,
  CAREER_SEASONS,
  CAREER_TRAINING,
  CAREER_WORLD,
  TEAM_RATING,
} from "@/config/balance";
import { lineupById, playerById, playerCardById, playerCards, seasonById, specialCards } from "@/data";
import { PLAYER_NAME_BANK, playerNameBankFor } from "@/data/career/names";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/util";
import { finalOverall } from "../cards";
import type { BuffLevel, PlayerCard, Region, StatKey, Stats, TournamentState } from "../types";
import { derivedFloat, streams } from "./seeds";
import { coachProfileOf, objectiveEffectPct } from "./training";
import type {
  ArchetypeId,
  CoachState,
  DrillId,
  CareerPlayerView,
  DeclineRate,
  FormerSquadPlayer,
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
/**
 * No player is ever younger than this at any season they appear in.
 * DEV-02 (R48): the minimum competitive age — one constant for debut ages,
 * the market and the signing gate.
 */
const MIN_AGE = CAREER_AGE.minCompetitiveAge;

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
/**
 * v0.3 stagnation fix: training gains quantize at 4 decimals, not 2 — the old
 * floor2 zeroed any daily tick below 0.01 OVR/day, so slower developers
 * (21+, near-potential) gained literal 0 forever. Still rounds DOWN so
 * accumulated totals never exceed a cap.
 */
const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const floor4 = (n: number): number => Math.floor(n * 10000) / 10000;

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

/**
 * rc.32 — THE AGE CLOCK's year for a season `year` label: the year the
 * season ENDS ("2020-21" → 2021, "2022-23" → 2023, "2024" → 2024). Every
 * label steps exactly one year from the one before it (RLCS 2022-23 ran into
 * 2023, then came 2024), so ages tick +1 a season. The old anchor (the first
 * year: 2020, 2021, 2022, then 2024) aged everyone two years at the
 * 2022-23 → 2024 rollover. Real birth dates (R39) give the real age from
 * RLCS 2024 on.
 */
function labelEndYear(label: string): number {
  const match = /(\d{4})(-\d{2,4})?/.exec(label);
  if (!match) return NaN;
  return Number(match[1]) + (match[2] ? 1 : 0);
}

/** Player cards ordered by season chronology, per player (built once). */
const cardsByPlayer: Map<string, PlayerCard[]> = (() => {
  const map = new Map<string, PlayerCard[]>();
  for (const card of playerCards) {
    // National-team cards (v2.0, FIFAe) are not club history: they share the
    // RLCS season order, so they would hijack the career anchors and potential.
    if (lineupById.get(card.lineupId)?.national) continue;
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

/**
 * The age clock's year of a season — the year it ENDS (labelEndYear): 2021,
 * 2022, 2023, 2024, 2025, 2026; infinite: 2026 + n − 5. Exactly +1 a season.
 * Ages only: the calendar's day clock and the labels shown (`year`,
 * `startDate`) are unchanged.
 */
export function seasonYear(seasonIndex: number): number {
  const last = CAREER_SEASONS.length - 1;
  if (seasonIndex <= last) {
    return labelEndYear(CAREER_SEASONS[Math.max(0, seasonIndex)].year);
  }
  return labelEndYear(CAREER_SEASONS[last].year) + (seasonIndex - last);
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
 * Birth year of a real player. v2.0: a real birth date in the dataset
 * (players.json `birthday`, from the base export) wins — the career shows the
 * player's real age. Otherwise, debut-age inference: the first dataset card's
 * season gives the debut year; a weighted debut age (13-17) is sampled per
 * career, biased one year younger when the player's last-2-cards trend is
 * rising (still ascending → young) and one year older when falling. Ages never
 * go below 13 at any appearance. rc.32: the debut year is read on the age
 * clock itself (labelEndYear, the year a season ends), so an inferred debut
 * age stays 13–17 in the career's seasons too.
 */
export function deriveBirthYear(playerId: string, careerSeed: number): number {
  const birthday = playerById.get(playerId)?.birthday;
  if (birthday) return Number(birthday.slice(0, 4));
  const cards = cardsByPlayer.get(playerId);
  const debutYear =
    cards && cards.length > 0
      ? labelEndYear(seasonById.get(cards[0].seasonId)?.year ?? "") || seasonYear(0)
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

// ---------------------------------------------------------------------------
// DEV-01 (rc.32, R55–R57): the growth contract — development model 2
// ---------------------------------------------------------------------------

/** The development model a world runs on: absent = rc.31's model (1). */
export function growthModelOf(world: { growthModel?: number } | null | undefined): number {
  return world?.growthModel ?? 1;
}

/** True when a career runs the DEV-01 growth contract (model 2+). */
export function isGrowthContract(model: number | undefined): boolean {
  return (model ?? 1) >= 2;
}

/** DEV-01: a career's growth context right now — its model, today and its seed (see GrowthCtx). */
export function growthCtxOf(save: {
  world: { growthModel?: number };
  careerSeed: number;
  clock: { day: number };
}): { model: number; day: number; careerSeed: number } {
  return { model: growthModelOf(save.world), day: save.clock.day, careerSeed: save.careerSeed };
}

/** DEV-01b: when a player reaches his top. */
export type MaturityProfile = "early" | "standard" | "late";

/**
 * DEV-01b: the three separate dimensions of a player's arc — when he reaches
 * his top (maturity → `peakAge`), how long he stays there (`plateauYears`)
 * and how fast he declines after (`declineRate`) — plus how far his real peak
 * lands from his potential (`peakOffset`, within ±CAREER_DEV.peakTolerance).
 * Derived from (careerSeed, playerId) only: a signing, a sale, a renewal or a
 * new club never rerolls it.
 */
export interface DevelopmentProfile {
  maturity: MaturityProfile;
  peakAge: number;
  plateauYears: number;
  declineRate: DeclineRate;
  peakOffset: number;
}

/** Fixed pick order — NEVER reorder (derivation stability). */
const MATURITIES: MaturityProfile[] = ["early", "standard", "late"];

/**
 * The age clock's year of each dataset season order (for a real player's
 * moments): the year a season ends, as `seasonYear` (rc.32 R54) — a
 * single-year label is its own year, "2020-21" is 2021.
 */
const yearByOrder: Map<number, number> = (() => {
  const map = new Map<number, number>();
  for (const s of seasonById.values()) map.set(s.order, labelEndYear(s.year));
  return map;
})();

/**
 * DEV-01c: per real player, his best ELIGIBLE special — the card's printed
 * overall (no effect, boost or chemistry) and the season of its moment.
 * Eligible: his own player card (by playerId, never a coach card) of a real
 * RLCS moment type and rarity (CAREER_DEV.potentialSpecialTypes /
 * potentialSpecialRarities). National-team cards (a derived boost), the
 * community vote, the Creator and the Wings tributes would bend the curve
 * and never count.
 */
const bestSpecialByPlayer: Map<string, { overall: number; order: number }> = (() => {
  const types = new Set(CAREER_DEV.potentialSpecialTypes);
  const rarities = new Set(CAREER_DEV.potentialSpecialRarities);
  const firstCareerOrder = CAREER_SEASONS[0].order;
  const map = new Map<string, { overall: number; order: number }>();
  for (const sp of specialCards) {
    if (sp.kind === "coach" || !types.has(sp.cardType) || !rarities.has(sp.rarity)) continue;
    const base = playerCardById.get(sp.baseCardId);
    if (!base || base.playerId !== sp.playerId || lineupById.get(base.lineupId)?.national) continue;
    const order = seasonById.get(base.seasonId)?.order ?? 0;
    if (CAREER_DEV.potentialSpecialCareerEraOnly && order < firstCareerOrder) continue;
    const was = map.get(sp.playerId);
    if (!was || sp.overall > was.overall || (sp.overall === was.overall && order < was.order)) {
      map.set(sp.playerId, { overall: sp.overall, order });
    }
  }
  return map;
})();

/** DEV-01c: a real player's best eligible special overall (null = none). */
export function bestEligibleSpecialOverall(playerId: string): number | null {
  return bestSpecialByPlayer.get(playerId)?.overall ?? null;
}

/**
 * DEV-01c (model 2): a real player's FIXED potential — his best club card
 * (from his debut on) plus the stable jitter, or his best eligible special
 * when that is higher (the special sets it exactly). It never reads his
 * current overall, so it never moves; his debut overall is untouched.
 */
export function derivePotentialV2(playerId: string, careerSeed: number): number {
  const cards = cardsByPlayer.get(playerId);
  let best = -Infinity;
  for (const card of cards ?? []) best = Math.max(best, finalOverall(card));
  const special = bestSpecialByPlayer.get(playerId)?.overall ?? -Infinity;
  if (best === -Infinity && special === -Infinity) return 60 + CAREER_DEV.endedCareerHeadroom;
  const f = derivedFloat(careerSeed, streams.gen("pot", playerId));
  const [jMin, jMax] = CAREER_DEV.potentialJitter;
  const fromCards = best === -Infinity ? -Infinity : best + intFrom(f, jMin, jMax);
  return clamp(Math.max(fromCards, special), 60, 99);
}

/** A player's age in the season of a dataset `order` — the career's own clock inside the career era. */
function ageAtOrder(birthYear: number, order: number): number {
  const idx = CAREER_SEASONS.findIndex((s) => s.order === order);
  if (idx >= 0) return ageOf(birthYear, idx);
  return (yearByOrder.get(order) ?? seasonYear(0)) - birthYear;
}

/**
 * DEV-01b: the development profile of any player id, model 2. A generated
 * player draws his maturity (CAREER_DEV.maturity) and a peak age inside it; a
 * REAL player peaks at the age of his best moment (the club card or special
 * his potential comes from, inside realPeakAgeRange) and stays at the top at
 * least as long as his real cards do (within peakTolerance of his best club
 * card). Plateau, decline rate and the peak offset are separate rolls.
 */
export function developmentProfileOf(playerId: string, careerSeed: number): DevelopmentProfile {
  const f = (what: string) => derivedFloat(careerSeed, streams.gen(what, playerId));
  const years = Object.keys(CAREER_DEV.plateauYearsWeights)
    .map(Number)
    .sort((a, b) => a - b);
  let plateauYears = weightedFrom(f("dev-plateau"), years, (y) => CAREER_DEV.plateauYearsWeights[y] ?? 0);
  const peakOffset = weightedFrom(f("dev-offset"), CAREER_DEV.peakOffsetWeights, (o) => o.weight).offset;
  const declineRate = deriveDeclineRate(playerId, careerSeed);

  const cards = playerById.has(playerId) ? cardsByPlayer.get(playerId) : undefined;
  if (cards && cards.length > 0) {
    const birthYear = deriveBirthYear(playerId, careerSeed);
    let bestClub = -Infinity;
    let bestOrder = cardOrder(cards[0]);
    for (const card of cards) {
      const o = finalOverall(card);
      if (o > bestClub) {
        bestClub = o;
        bestOrder = cardOrder(card);
      }
    }
    const special = bestSpecialByPlayer.get(playerId);
    const momentOrder = special && special.overall > bestClub ? special.order : bestOrder;
    const [lo, hi] = CAREER_DEV.realPeakAgeRange;
    const peakAge = clamp(ageAtOrder(birthYear, momentOrder), lo, hi);
    // His real top years: the last club card within peakTolerance of his best.
    let lastTop = momentOrder;
    for (const card of cards) {
      if (finalOverall(card) >= bestClub - CAREER_DEV.peakTolerance) lastTop = Math.max(lastTop, cardOrder(card));
    }
    const realTopYears = Math.max(0, ageAtOrder(birthYear, lastTop) - ageAtOrder(birthYear, momentOrder));
    plateauYears = Math.max(plateauYears, realTopYears);
    const m = CAREER_DEV.maturity;
    const maturity: MaturityProfile =
      peakAge < m.standard.peakAge[0] ? "early" : peakAge > m.standard.peakAge[1] ? "late" : "standard";
    return { maturity, peakAge, plateauYears, declineRate, peakOffset };
  }

  const maturity = weightedFrom(f("dev-maturity"), MATURITIES, (k) => CAREER_DEV.maturity[k].weight);
  const [lo, hi] = CAREER_DEV.maturity[maturity].peakAge;
  return { maturity, peakAge: intFrom(f("dev-peak"), lo, hi), plateauYears, declineRate, peakOffset };
}

/**
 * DEV-01b: a generated player's peak age, never sooner than his gap needs —
 * at least ceil(gap ÷ seasonGainCap) + peakRoomSlackYears seasons away, so a
 * big-headroom kid cannot be an early maturer who runs out of time — and
 * never past the top of CAREER_DEV.realPeakAgeRange (26), so the retirement
 * window (24–29) always closes on schedule.
 */
export function peakAgeWithRoom(profilePeak: number, age: number, gap: number): number {
  if (gap <= 0) return profilePeak;
  const need = age + Math.ceil(gap / CAREER_DEV.seasonGainCap) + CAREER_DEV.peakRoomSlackYears;
  return Math.max(profilePeak, Math.min(need, CAREER_DEV.realPeakAgeRange[1]));
}

/** DEV-01b: the real peak a player grows toward — his potential ± his offset (60–99). */
export function peakTargetOf(potential: number, profile: Pick<DevelopmentProfile, "peakOffset">): number {
  return clamp(Math.round(potential) + profile.peakOffset, 60, 99);
}

/** DEV-01b: where a player stands on his arc at an exact age. */
export type DevelopmentPhase = "growing" | "peak" | "declining";

export function developmentPhaseOf(
  exactAge: number,
  profile: Pick<DevelopmentProfile, "peakAge" | "plateauYears">,
): DevelopmentPhase {
  if (exactAge < profile.peakAge) return "growing";
  if (exactAge < profile.peakAge + profile.plateauYears) return "peak";
  return "declining";
}

/** A season age plus the share of the season played (day 1 = +0) — no step at the rollover. */
export function exactAgeOf(seasonAge: number, day: number | undefined): number {
  const days = CAREER_CALENDAR.weeksPerSeason * CAREER_CALENDAR.daysPerWeek;
  const d = day ?? days / 2;
  return seasonAge + clamp(d - 1, 0, days) / days;
}

/**
 * DEV-01d: the base growth pace in overall points per YEAR — steep when young,
 * slowing near the peak, never stopping short of it: paceCurvature × gap ÷
 * years left to the peak age (never under paceMinYears), at least
 * paceFloorPerYear while a gap remains, at most the season cap a year (so a
 * season's growth spreads over the season instead of front-loading it). Zero
 * once he is at his real peak or past his plateau (a declining player never
 * closes an old gap).
 */
export function growthPacePerYear(input: {
  overall: number;
  target: number;
  exactAge: number;
  peakAge: number;
  plateauYears: number;
}): number {
  const gap = input.target - input.overall;
  if (gap <= 0) return 0;
  if (input.exactAge >= input.peakAge + input.plateauYears) return 0;
  const D = CAREER_DEV;
  const yearsLeft = Math.max(D.paceMinYears, input.peakAge - input.exactAge);
  return clamp((D.paceCurvature * gap) / yearsLeft, D.paceFloorPerYear, D.seasonGainCap);
}

/** DEV-01b: overall lost per year at an exact age — zero until his plateau ends, then gradual. */
export function declinePerYearOf(input: {
  exactAge: number;
  peakAge: number;
  plateauYears: number;
  declineRate: DeclineRate;
}): number {
  const past = input.exactAge - (input.peakAge + input.plateauYears);
  if (past < 0) return 0;
  const table = CAREER_DEV.declinePerYear;
  const base = table[Math.min(table.length - 1, Math.floor(past))];
  return base * (CAREER_AGE.declineRateMult[input.declineRate] ?? 1);
}

/** DEV-01 base growth: the series the user's team played in an event (every fielded player played them all). */
export function userSeriesPlayed(t: Pick<TournamentState, "swiss" | "playoffs">): number {
  let n = 0;
  for (const r of t.swiss.rounds) for (const s of r.series) if (s.teamAId === "user" || s.teamBId === "user") n += 1;
  for (const r of t.playoffs?.rounds ?? []) for (const s of r.series) if (s.teamAId === "user" || s.teamBId === "user") n += 1;
  return n;
}

// ---------------------------------------------------------------------------
// DEV-02 (R48): the competitive window — age 13 in, retirement 24–29
// ---------------------------------------------------------------------------

/**
 * The player's peak age — the ONE read every longevity rule goes through (no
 * retirement before it). Today the stored / derived `peakAge`
 * (CAREER_DEV.peakAgeRange, 18–22); DEV-01 individualises the peak here.
 */
export function peakAgeOf(p: { peakAge: number }): number {
  return p.peakAge;
}

/** Old enough to be signed, registered and fielded (CAREER_AGE.minCompetitiveAge). */
export function isCompetitiveAge(age: number): boolean {
  return age >= MIN_AGE;
}

/**
 * The chance that the season a player plays at `age` is his last. Zero before
 * the window (retireMinAge) or before his peak; one when the next season would
 * take him past retireMaxAge (rc.32: the age clock steps +1 a season, so that
 * is the season at 29 — rc.31's 2022 → 2024 jump made 28 the last there);
 * otherwise CAREER_AGE.retirementByAge, times retirementStarMult for a star —
 * stars linger, inside the window only.
 */
export function retirementChanceFor(p: {
  age: number;
  nextAge: number;
  peakAge: number;
  overall: number;
  starOverall: number;
}): number {
  const A = CAREER_AGE;
  const earliest = Math.min(A.retireMaxAge, Math.max(A.retireMinAge, p.peakAge));
  if (p.age < earliest) return 0;
  if (p.nextAge > A.retireMaxAge) return 1;
  const base = A.retirementByAge[Math.min(p.age, A.retireMaxAge)] ?? 0;
  return clamp(base * (p.overall >= p.starOverall ? A.retirementStarMult : 1), 0, 1);
}

/**
 * DEV-02 (R48): is the season being played now certainly his last? True when
 * the coming rollover retires him for sure (`retirementChanceFor` is 1: the
 * next season would take him past retireMaxAge — rc.32: a 29-year-old, in
 * every season, now that the age clock steps +1). The squad only decides at a
 * rollover, so a player SIGNED in that season would otherwise play one more
 * (at 30): he joins for this final season instead — announced at signing, a
 * 1-season contract.
 */
export function signsForFinalSeason(
  p: { age: number; peakAge: number; overall: number },
  seasonIndex: number,
): boolean {
  return (
    retirementChanceFor({
      age: p.age,
      nextAge: p.age + (seasonYear(seasonIndex + 1) - seasonYear(seasonIndex)),
      peakAge: peakAgeOf(p),
      overall: p.overall,
      starOverall: CAREER_AGE.retirementStarOverallSquad,
    }) >= 1
  );
}

/**
 * Does this retiring player move into coaching? Real ex-pros only (the coach
 * market lists real names; generated coaches fill the rest), a
 * retireCoachConvertRate share of them, fixed per (career, player) from the
 * seed — no save state. Generic (fictional) players leave the game.
 */
export function becomesCoachOnRetirement(playerId: string, careerSeed: number): boolean {
  if (!playerById.has(playerId)) return false;
  return derivedFloat(careerSeed, streams.gen("retireCoach", playerId)) < CAREER_AGE.retireCoachConvertRate;
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

/**
 * rc.34 (DEV-03 decision 5-A): a player's CAREER-BEST club card overall (the
 * ex-pro coach's quality reads it, not the last card); null = no card.
 */
export function bestCardOverall(playerId: string): number | null {
  const cards = cardsByPlayer.get(playerId);
  if (!cards || cards.length === 0) return null;
  let best = -Infinity;
  for (const card of cards) best = Math.max(best, finalOverall(card));
  return Number.isFinite(best) ? best : null;
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
  // DEV-01 (model 2): a fixed potential (cards + eligible specials) and the
  // real-moment peak; rc.31 derived both per view (potential clamped up to the
  // current overall, peak 18–22).
  const dev01 = isGrowthContract(growthModelOf(ctx.world));
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
    potential: dev01 ? derivePotentialV2(playerId, ctx.careerSeed) : derivePotential(playerId, ctx.careerSeed, overall),
    peakAge: dev01
      ? developmentProfileOf(playerId, ctx.careerSeed).peakAge
      : derivePeakAge(playerId, ctx.careerSeed),
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
  // rc.29: a world created from rc.29 on reads the bank without real nicknames.
  // rc.30: a name the legacy repair stored for this filler comes first.
  const bank = playerNameBankFor(region, ctx.world.nameBankVersion);
  const wrap = Math.floor(n / bank.length);
  const name =
    ctx.world.rookieNames?.[id] ?? bank[n % bank.length] + (wrap > 0 ? ` ${roman(wrap + 1)}` : "");

  // v0.3 headliner: the first slot of each filler-org triplet (n % 3 === 0)
  // may roll a stronger base — one visible name per filler org, chance-gated,
  // so thin regions get texture without early superteams.
  const headliner =
    n % 3 === 0 &&
    derivedFloat(ctx.careerSeed, streams.gen("fic-head", key)) <
      CAREER_WORLD.fillerHeadlinerChance;
  const [oMin, oMax] = headliner
    ? CAREER_WORLD.fillerHeadlinerRange
    : CAREER_WORLD.fillerOverallRange;
  const baseOverall = intFrom(derivedFloat(ctx.careerSeed, streams.gen("fic-ovr", key)), oMin, oMax);
  const overall = clamp(baseOverall + (ctx.world.overallDelta[id] ?? 0), 60, 99);

  const age0 = intFrom(
    derivedFloat(ctx.careerSeed, streams.gen("fic-age", key)),
    FILLER_AGE_RANGE[0],
    FILLER_AGE_RANGE[1],
  );
  const birthYear = seasonYear(0) - age0;

  const dev01 = isGrowthContract(growthModelOf(ctx.world));
  const profile = dev01 ? developmentProfileOf(id, ctx.careerSeed) : null;
  const wonderkidRoll = derivedFloat(ctx.careerSeed, streams.gen("fic-wk", key)) < CAREER_WORLD.fillerWonderkidChance;
  const wonderkidPot = () =>
    intFrom(
      derivedFloat(ctx.careerSeed, streams.gen("fic-pot", key)),
      FILLER_WONDERKID_POTENTIAL[0],
      FILLER_WONDERKID_POTENTIAL[1],
    );
  let potential: number;
  let peakAge = profile?.peakAge ?? 0;
  if (profile) {
    // DEV-01 (model 2): a FIXED ceiling that fits his arc — a wonderkid only
    // with two seasons or more to grow (and a peak late enough for his gap),
    // otherwise his base overall plus the years to his peak ×
    // CAREER_DEV.fillerHeadroomPerYear (0 once past it). rc.31: the current
    // overall + 2, which moved with him every season.
    const yearsToPeak = Math.max(0, profile.peakAge - age0);
    if (wonderkidRoll && yearsToPeak >= 2) {
      potential = Math.max(wonderkidPot(), baseOverall);
      peakAge = peakAgeWithRoom(profile.peakAge, age0, potential - baseOverall);
    } else {
      const [rLo, rHi] = CAREER_DEV.fillerHeadroomPerYear;
      const rate = rLo + derivedFloat(ctx.careerSeed, streams.gen("fic-room", key)) * (rHi - rLo);
      potential = clamp(baseOverall + Math.round(yearsToPeak * rate), baseOverall, 99);
    }
  } else {
    potential = wonderkidRoll ? Math.max(wonderkidPot(), overall) : derivePotential(id, ctx.careerSeed, overall);
  }

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
    peakAge: profile ? peakAge : derivePeakAge(id, ctx.careerSeed),
    declineRate: deriveDeclineRate(id, ctx.careerSeed),
    anchored: false,
  };
}

/**
 * rc.32 (integration review): a former founder of the user's squad, read off
 * the record kept when he left (WorldState.formerSquad); world growth and
 * decline move him through world.overallDelta like any generated player.
 */
function formerSquadView(id: string, p: FormerSquadPlayer, ctx: ViewCtx): CareerPlayerView {
  return {
    id,
    kind: "fictional",
    name: ctx.world.rookieNames?.[id] ?? p.name,
    country: p.country,
    region: p.region,
    age: ageOf(p.birthYear, ctx.seasonIndex),
    archetype: p.archetype,
    overall: clamp(p.overall + (ctx.world.overallDelta[id] ?? 0), 60, 99),
    attrOffsets: { ...p.attrOffsets },
    potential: p.potential,
    peakAge: p.peakAge,
    declineRate: p.declineRate,
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
  /** rc.29 (CAR-01): the name stored at intake (world.rookieNames), if any. */
  storedName?: string,
  /** rc.32 (DEV-01): the world's development model (absent = rc.31's). */
  model?: number,
): CareerPlayerView {
  const id = `rook:${seasonIndex}:${region}:${n}`;
  const key = `${seasonIndex}:${region}:${n}`;
  const bank = PLAYER_NAME_BANK[region];
  const name =
    storedName ?? bank[intFrom(derivedFloat(careerSeed, streams.gen("rook-name", key)), 0, bank.length - 1)];

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
  const ceiling = CAREER_WORLD.datasetEraPotentialCeiling;
  const dev01 = isGrowthContract(model);
  if (!infinite) {
    // DEV-01a (model 2): a kid of 13–15 from a top tier the dataset era caps
    // may be a rare elite prospect (93–98) instead of sitting at the ceiling —
    // the share of 88+ kids does not grow. rc.31: every one capped at 88.
    const elite = CAREER_WORLD.eliteProspect;
    if (
      dev01 &&
      tier.range[1] > ceiling &&
      age <= elite.maxAge &&
      derivedFloat(careerSeed, streams.gen("rook-elite", key)) < elite.chance
    ) {
      const pots = Object.keys(elite.weights)
        .map(Number)
        .sort((a, b) => a - b);
      potential = weightedFrom(derivedFloat(careerSeed, streams.gen("rook-elite-pot", key)), pots, (p) => elite.weights[p] ?? 0);
    } else {
      potential = Math.min(potential, ceiling);
    }
  }
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
    // DEV-01b (model 2): his maturity profile's peak, never sooner than his
    // gap needs (an elite kid is never an early maturer out of time).
    peakAge: dev01
      ? peakAgeWithRoom(developmentProfileOf(id, careerSeed).peakAge, age, potential - overall)
      : derivePeakAge(id, careerSeed),
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
    if (!REGION_SET.has(region)) return null;
    if (!Number.isInteger(n) || n < 0) {
      // rc.32: a founder who left the user's squad ("fic:{region}:starterN").
      const former = ctx.world.formerSquad?.[id];
      return former ? formerSquadView(id, former, ctx) : null;
    }
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
    const model = growthModelOf(ctx.world);
    const base = rookieView(region as Region, genSeason, n, ctx.careerSeed, infinite, ctx.world.rookieNames?.[id], model);
    const overall = clamp(base.overall + (ctx.world.overallDelta[id] ?? 0), 60, 99);
    return {
      ...base,
      age: base.age + (seasonYear(ctx.seasonIndex) - seasonYear(genSeason)),
      overall,
      // DEV-01e (model 2): the potential never moves (rc.31 lifted it to the overall).
      potential: isGrowthContract(model) ? base.potential : Math.max(base.potential, overall),
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
 *
 * Model 2 (rc.33, DEV-04): the honest band (`honestBand`) — at most
 * CAREER_SCOUT.honestWidthByLevel wide, its top 0–bandMaxAbove above the
 * truth; with `opts.arc` (his peak age and exact age), capped at what the age
 * clock still lets him reach (`reachableOverallOf`), so an older player shows
 * no potential he can no longer reach.
 *
 * Model 1 (rc.31's development, careers created on rc.31; rc.33 review): the
 * same honest band on its potential — the ceiling its training climbs to,
 * never under his overall — floored at the overall like rc.31's band, and a
 * bought report (level ≥ 1) also stays inside the band rc.31 showed at that
 * level (`rc31Band`), so it only narrows. No age cap: model 1's growth has
 * no age stop (training still climbs toward the potential at any age, the
 * rollover decline is separate), so there is nothing he can no longer reach.
 */
export function scoutedBand(
  potential: number,
  overall: number,
  level: ScoutLevel,
  careerSeed: number,
  playerId: string,
  /** rc.32 (DEV-01e): the career's development model (absent = rc.31's model 1). */
  model?: number,
  /**
   * rc.33 (DEV-04, model 2): `arc` — his peak age and exact age today — caps
   * the band at what he can still reach; `rc32Reports` keeps a bought or
   * earned level inside the band rc.32 showed (a career created before
   * rc.33, `CareerSave.bandModel` absent). Model 1 reads neither.
   */
  opts?: { arc?: { peakAge: number; exactAge: number }; rc32Reports?: boolean },
): PotentialBand {
  if (isGrowthContract(model)) {
    const band = honestBand(potential, level, careerSeed, playerId, (l) =>
      opts?.rc32Reports ? nestedBand(potential, l, careerSeed, playerId) : null,
    );
    const arc = opts?.arc;
    if (!arc) return floorAtOverall(band, overall);
    const cap = Math.round(
      reachableOverallOf({ id: playerId, overall, potential, peakAge: arc.peakAge }, arc.exactAge, careerSeed),
    );
    return floorAtOverall(cap >= band.max ? band : { min: Math.min(band.min, cap), max: cap, level }, overall);
  }
  const band = honestBand(potential, level, careerSeed, playerId, (l) =>
    rc31Band(potential, overall, l, careerSeed, playerId),
  );
  return { ...band, min: Math.min(band.max, Math.max(band.min, Math.floor(overall))) };
}

/**
 * rc.35 (front C, Miguel on rc.34: a 78 at his peak read "76–80"): a band
 * never reads below the overall he already shows — its floor is clamped to
 * his (rounded) overall, and a band wholly under it collapses onto it. The
 * top stays the honest one (or what he can still reach).
 */
function floorAtOverall(band: PotentialBand, overall: number): PotentialBand {
  const ovr = Math.round(overall);
  const max = Math.max(band.max, ovr);
  return { min: Math.max(band.min, Math.min(ovr, max)), max, level: band.level };
}

/**
 * rc.31's band (model 1) at one report level: 2 × CAREER_SCOUT.bandWidthByLevel
 * wide, split unevenly around the truth by a stable per-(player, level)
 * jitter, floored at the current overall, capped at 99; exact at level 3.
 * Since the rc.33 review it is no longer shown — only the bound a bought
 * model-1 report stays inside (`scoutedBand`).
 */
export function rc31Band(
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

/**
 * DEV-04 (rc.33): a squad player's potential band on a given day — the ONE
 * rule HQ and the squad screens read (`careerUi.potBandOfSquad`) and the
 * wizard reads for a founder before the career exists
 * (`careerFlow.founderPotentialBandFor`): his report level, the career's
 * development model, his age arc on that day and, for a career created
 * before rc.33, rc.32's reports.
 */
export function squadPotentialBand(
  p: { id: string; potential: number; overall: number; peakAge: number; birthYear: number; scoutLevel: ScoutLevel },
  ctx: { careerSeed: number; seasonIndex: number; day: number; model: number; rc32Reports: boolean },
): PotentialBand {
  const arc = { peakAge: p.peakAge, exactAge: exactAgeOf(ageOf(p.birthYear, ctx.seasonIndex), ctx.day) };
  return scoutedBand(p.potential, p.overall, p.scoutLevel, ctx.careerSeed, p.id, ctx.model, {
    arc,
    rc32Reports: ctx.rc32Reports,
  });
}

/**
 * DEV-01e (model 2, rc.32): the honest band. It reads the potential only — never the
 * current overall, the day or a reload — so it never moves; each report
 * narrows INSIDE the band shown before (level 0 → 1 → 2 → exact at 3). At
 * each level the truth's place is a uniform draw over every position the
 * previous band allows, so it can sit at the floor, in the middle or at the
 * top; the widths are CAREER_SCOUT.bandWidthByLevel × 2 (rc.31's). The floor
 * may sit under the current overall: a player at or past his expected peak
 * reads so, instead of a ceiling he can never reach. Kept inside 60–99.
 * rc.33 (DEV-04): no longer shown — `honestBand` nests a bought level inside
 * it, so a report an rc.32 career holds only narrows.
 */
export function nestedBand(potential: number, level: ScoutLevel, careerSeed: number, playerId: string): PotentialBand {
  const truth = clamp(Math.round(potential), 60, 99);
  let below = 0;
  let width = 0;
  for (let l = 0; l <= level; l++) {
    const w = 2 * (CAREER_SCOUT.bandWidthByLevel[l] ?? 0);
    if (w <= 0) return { min: truth, max: truth, level };
    // Points of the band under the truth: any value the outer band allows.
    let lo = l === 0 ? 0 : Math.max(0, below - (width - w));
    let hi = l === 0 ? w : Math.min(w, below);
    if (l === 0) {
      lo = Math.max(lo, truth + w - 99); // never above 99
      hi = Math.min(hi, truth - 60); // never under 60
      if (hi < lo) hi = lo;
    }
    const f = derivedFloat(careerSeed, streams.gen("band2", `${playerId}:${l}`));
    below = lo + Math.min(hi - lo, Math.floor(f * (hi - lo + 1)));
    width = w;
  }
  return { min: truth - below, max: truth - below + width, level };
}

/**
 * DEV-04 (rc.33, revisits DEV-01e): model 2's honest band. At each report
 * level it is at most CAREER_SCOUT.honestWidthByLevel wide (5 / 3 / 1 /
 * exact) and its top sits 0–bandMaxAbove points above the true potential, so
 * it never reads much higher than the truth — rc.32's 10-wide level-0 band
 * could put a 91 at "89–99". It reads the potential only (never the overall,
 * the day or a reload) and nests: each report narrows inside the band shown
 * before. The places are drawn inside out (the deepest report first, each
 * outer band then drawn among the places that contain it), so the deepest
 * report keeps its whole uncertainty instead of collapsing onto its top. In a
 * career created before rc.33 a bought or earned level (≥ 1) also stays
 * inside the band its old model showed at that level (`reportBound`: rc.32's
 * `nestedBand` on model 2, rc.31's `rc31Band` on model 1), so a report it
 * already holds only narrows; the band is then narrower than its width where
 * the two disagree (an old band that misses the truth is ignored). Kept
 * inside 60–99.
 */
function honestBand(
  potential: number,
  level: ScoutLevel,
  careerSeed: number,
  playerId: string,
  reportBound: (level: ScoutLevel) => PotentialBand | null,
): PotentialBand {
  const truth = clamp(Math.round(potential), 60, 99);
  const S = CAREER_SCOUT;
  const width = (l: number) => S.honestWidthByLevel[l] ?? 0;
  if (width(level) <= 0) return { min: truth, max: truth, level };
  // The deepest level with a band (2 today): its top is drawn first.
  let deepest = level;
  while (width(deepest + 1) > 0) deepest += 1;
  const ceiling = Math.max(0, Math.min(S.bandMaxAbove, 99 - truth));
  // How far each level's top sits above the truth, from the deepest out: an
  // outer band holds the inner one (top ≥ its top, floor ≤ its floor).
  const above: number[] = [];
  for (let l = deepest; l >= 0; l--) {
    const w = width(l);
    const lo = l === deepest ? 0 : above[l + 1];
    const hi = Math.min(ceiling, w, l === deepest ? w : above[l + 1] + (w - width(l + 1)));
    const span = Math.max(0, hi - lo);
    const f = derivedFloat(careerSeed, streams.gen("band4", `${playerId}:${l}`));
    above[l] = lo + Math.min(span, Math.floor(f * (span + 1)));
  }
  let min = 60;
  let max = 99;
  for (let l = 0; l <= level; l++) {
    max = Math.min(max, truth + above[l]);
    min = Math.max(min, truth + above[l] - width(l));
    const was = l >= 1 ? reportBound(l as ScoutLevel) : null;
    if (was && was.min <= truth && truth <= was.max) {
      max = Math.min(max, was.max);
      min = Math.max(min, was.min);
    }
  }
  return { min, max, level };
}

/**
 * DEV-04 (rc.33): the best overall the age clock still lets a player reach,
 * on model 2's own growth model (no new curve): growth stops when his plateau
 * ends (`growthPacePerYear` is 0 after it), never passes his real peak
 * (`peakTargetOf`), and a season adds at most CAREER_DEV.seasonGainCap. Past
 * his plateau that is his current overall.
 */
export function reachableOverallOf(
  p: { id: string; overall: number; potential: number; peakAge: number },
  exactAge: number,
  careerSeed: number,
): number {
  const profile = developmentProfileOf(p.id, careerSeed);
  const target = peakTargetOf(p.potential, profile);
  const yearsLeft = p.peakAge + profile.plateauYears - exactAge;
  if (yearsLeft <= 0 || target <= p.overall) return p.overall;
  return Math.min(target, p.overall + CAREER_DEV.seasonGainCap * Math.ceil(yearsLeft));
}

/** DEV-04: a phase tag — his phase on his arc, or "unknown" until a report reveals it. */
export type PhaseTag = DevelopmentPhase | "unknown";

/**
 * DEV-04 (rc.33): the phase tag a sheet shows — developing / at his peak /
 * declining from the REAL development state (model 2: his peak age and
 * plateau, `developmentPhaseOf` at his exact age; rc.31's model 1: the fixed
 * ages 20 / 22), or "unknown" below CAREER_SCOUT.phaseRevealLevel.
 */
export function phaseTagFor(
  p: { id: string; peakAge: number },
  ctx: { level: ScoutLevel; careerSeed: number; model: number; seasonAge: number; day?: number },
): PhaseTag {
  if (ctx.level < CAREER_SCOUT.phaseRevealLevel) return "unknown";
  if (!isGrowthContract(ctx.model)) {
    return ctx.seasonAge <= 20 ? "growing" : ctx.seasonAge <= 22 ? "peak" : "declining";
  }
  return developmentPhaseOf(exactAgeOf(ctx.seasonAge, ctx.day), {
    peakAge: p.peakAge,
    plateauYears: developmentProfileOf(p.id, ctx.careerSeed).plateauYears,
  });
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

/**
 * rc.33's coach training multiplier (0.85 floor with no coach). rc.34 (DEV-03,
 * decision 7-A): no training tick reads it any more — the base is one rate
 * for everyone (CAREER_TRAINING.baseRateMult) and the coach acts through the
 * package. Kept as rc.33's figure for tools and old tests.
 */
export function coachMultFor(coachOverall: number | null): number {
  const { perPoint, min, max } = CAREER_TRAINING.coachMult;
  if (coachOverall === null) return min;
  return clamp(1 + (coachOverall - 75) * perPoint, min, max);
}

/**
 * v2.0 (R22) — the coach's effects, spelled out for the market card, the
 * squad panel and the training screen (one formula, three surfaces):
 * the training effect, the team-rating modifier the rating engine applies
 * (TEAM_RATING.coach), and the stat buff.
 */
export interface CoachEffects {
  /**
   * rc.34 (DEV-03): the coach's effect on a Development package, in percent
   * of the base session rate (normal workload; e.g. +22 for a quality-82
   * development specialist) — `training.objectiveEffectPct`. No package =
   * the base, whoever coaches (decision 7-A). rc.33: the multiplier vs. no
   * coach (the 0.85 floor).
   */
  trainingPct: number;
  /** Flat team-rating add (0..TEAM_RATING.coach.max), one decimal. */
  ratingMod: number;
  bonusType: StatKey;
  bonusLevel: string;
}

export function coachEffectsFor(coach: {
  overall: number;
  bonusType: StatKey;
  bonusLevel: string;
} & Partial<Pick<CoachState, "id" | "name" | "source" | "experience" | "specialty" | "ceiling" | "salaryPerSplit">>): CoachEffects {
  const c = TEAM_RATING.coach;
  const ratingMod = clamp(
    Math.max(0, (coach.overall - c.baseline) * c.scale) +
      (BUFF_LEVEL_VALUE[coach.bonusLevel as BuffLevel] ?? 0) * c.perBonusLevel,
    0,
    c.max,
  );
  const profile = coachProfileOf({
    ...coach,
    id: coach.id ?? `coach:${coach.overall}`,
    name: coach.name ?? "",
    source: coach.source ?? "generated",
    salaryPerSplit: coach.salaryPerSplit ?? 0,
  });
  return {
    trainingPct: objectiveEffectPct("development", profile),
    ratingMod: Math.round(ratingMod * 10) / 10,
    bonusType: coach.bonusType,
    bonusLevel: coach.bonusLevel,
  };
}

/** v2.0 (R27): the active weekly drill's effect on a training tick. */
export interface DrillEffect {
  id: DrillId;
  attrs: readonly StatKey[];
  /** Team-wide offset growth per training-week for each attr. */
  offsetPerWeek: number;
  overallMult: number;
}

export function drillEffectFor(id: DrillId | null | undefined): DrillEffect | null {
  if (!id) return null;
  const row = CAREER_TRAINING.drills.find((d) => d.id === id);
  if (!row) return null;
  return {
    id: row.id,
    attrs: row.attrs,
    offsetPerWeek: CAREER_TRAINING.drillOffsetPerWeek,
    overallMult: CAREER_TRAINING.drillOverallMult,
  };
}

/**
 * The coach's pick when training is delegated: the drill that trains the
 * coach's own buff stat, else a week-rotating drill (no coach = still a plan).
 */
export function autoDrillFor(coachBonusType: StatKey | null, week: number): DrillId {
  const drills = CAREER_TRAINING.drills;
  if (coachBonusType) {
    const match = drills.find((d) => (d.attrs as readonly StatKey[]).includes(coachBonusType));
    if (match) return match.id;
  }
  return drills[Math.max(0, week - 1) % drills.length].id;
}

/**
 * rc.32 (DEV-01): what the growth contract needs on top of rc.31's tick
 * context — the save's development model, the day (an exact age, so no step
 * at the rollover) and the career seed (the player's derived profile). All
 * optional: absent = rc.31's model.
 */
export interface GrowthCtx {
  model?: number;
  day?: number;
  careerSeed?: number;
}

/**
 * rc.34 (DEV-03): what a training package does to one tick, from
 * `training.packageEffectFor` — absent = DEV-01's base (×1, no offsets, the
 * full decline).
 */
export interface PackageTickCtx {
  /** The package's session multiplier on the base (≥ 1). */
  packageMult?: number;
  /** Attribute offset growth per training-week (the squad focus or his tweak). */
  offsetGrowth?: Partial<Record<StatKey, number>>;
  /** DEV-01's decline × this (recovery, past the plateau). */
  declineMult?: number;
}

interface GainCtx extends GrowthCtx, PackageTickCtx {
  seasonIndex: number;
  /** @deprecated rc.34 (decision 7-A): the coach no longer scales a tick (kept for callers). */
  coachOverall: number | null;
  /** Additive training-efficiency bonus from the gear ladder (0..~0.35). */
  gearBonus: number;
  trainingWeekBonus: boolean;
  /** Training-week equivalents applied at once (match XP multiplies here). */
  weeks: number;
  /** @deprecated rc.34: the weekly drill retired into the package's squad focus — ignored. */
  drill?: DrillEffect | null;
}

/** DEV-01: a squad player's profile and real peak under the growth contract. */
function squadArcOf(
  p: Pick<SquadPlayer, "id" | "potential">,
  careerSeed: number | undefined,
): { profile: DevelopmentProfile; target: number } {
  const profile = developmentProfileOf(p.id, careerSeed ?? 0);
  return { profile, target: peakTargetOf(p.potential, profile) };
}

/**
 * DEV-01d (model 2): the base pace per training-week equivalent — the yearly
 * pace toward his real peak (his stored peak age, his profile's plateau and
 * offset) over CAREER_DEV.trainingWeeksPerYear.
 */
function contractPacePerWeek(p: SquadPlayer, ctx: GainCtx): number {
  const { profile, target } = squadArcOf(p, ctx.careerSeed);
  const pace = growthPacePerYear({
    overall: p.overall,
    target,
    exactAge: exactAgeOf(ageOf(p.birthYear, ctx.seasonIndex), ctx.day),
    peakAge: p.peakAge,
    plateauYears: profile.plateauYears,
  });
  return pace / CAREER_DEV.trainingWeeksPerYear;
}

/**
 * Overall-rate share of a focus mode (v0.2 rebalance): balanced trains pure
 * overall; a single-attribute focus trades a slice of overall for offset
 * growth; auto is the coach's near-optimal plan — WITHOUT a coach it falls
 * back to balanced (the missing coach already costs via coachMult.min).
 * rc.34 (DEV-03): no tick reads it — the per-card focus retired into the
 * package (a per-player tweak, CAREER_PLAN.tweakFocus). rc.33's figure.
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

/** Session intensity multiplier (v0.2: light/normal/heavy). rc.34: retired into the package's workload (rc.33's figure). */
export function intensityMultFor(intensity: SquadPlayer["trainingIntensity"]): number {
  return CAREER_TRAINING.intensityMult[intensity ?? "normal"] ?? 1;
}

/**
 * Raw overall gain for `weeks` training-week equivalents (before caps).
 * rc.34 (DEV-03, decision 7-A): one base for everyone — the curve ×
 * CAREER_TRAINING.baseRateMult (rc.33's no-coach floor, so DEV-01's measured
 * base is unchanged) × gear × the Training Week bonus × the package's
 * multiplier (≥ 1; absent = the base). The coach, the per-player focus and
 * intensity and the weekly drill no longer scale it: the package does.
 */
function rawGain(p: SquadPlayer, ctx: GainCtx): number {
  // DEV-01 (model 2): the pace toward his real peak replaces rc.31's
  // weeklyBase × age band × headroom/(headroom + K).
  let base: number;
  if (isGrowthContract(ctx.model)) {
    base = contractPacePerWeek(p, ctx);
  } else {
    const age = ageOf(p.birthYear, ctx.seasonIndex);
    const headroom = Math.max(0, p.potential - p.overall);
    const headroomMult = headroom / (headroom + CAREER_TRAINING.headroomSoftK);
    base = CAREER_TRAINING.weeklyBase * growthMultFor(age) * headroomMult;
  }
  return (
    base *
    CAREER_TRAINING.baseRateMult *
    (1 + ctx.gearBonus) *
    (ctx.trainingWeekBonus ? 1 + CAREER_CALENDAR.trainingWeekBonus : 1) *
    Math.max(1, ctx.packageMult ?? 1) *
    ctx.weeks
  );
}

/** rc.34: the package's attribute offset growth for `weeks` (respects the cap and attr ≤ 99). */
function grownOffsets(
  p: SquadPlayer,
  weeks: number,
  newOverall: number,
  offsetGrowth?: Partial<Record<StatKey, number>>,
): Record<StatKey, number> {
  const cap = CAREER_DEV.attrOffsetCap;
  const out = { ...p.attrOffsets };
  const grow = (key: StatKey, perWeek: number) => {
    const current = out[key] ?? 0;
    // Grow, but never past the offset cap nor past a visible 99 attribute —
    // and never *reduce* an already-high offset.
    const allowedMax = Math.min(cap, Math.max(current, 99 - newOverall));
    const next = Math.min(current + perWeek * weeks, allowedMax);
    out[key] = round2(Math.max(next, -cap));
  };
  for (const [key, perWeek] of Object.entries(offsetGrowth ?? {}) as [StatKey, number][]) {
    if (perWeek > 0) grow(key, perWeek);
  }
  return out;
}

export interface TrainTickCtx extends GrowthCtx, PackageTickCtx {
  seasonIndex: number;
  /** @deprecated rc.34 (decision 7-A): the coach no longer scales a tick (kept for callers). */
  coachOverall: number | null;
  /** Additive training-efficiency bonus from the gear ladder. */
  gearBonus: number;
  trainingWeekBonus: boolean;
  splitGained: number;
  seasonGained: number;
  /** Training-week equivalents (1 = a full week; a weekday = 1/trainingDaysPerWeek). */
  weeks?: number;
  /** @deprecated rc.34: the weekly drill retired into the package's squad focus — ignored. */
  drill?: DrillEffect | null;
  /**
   * DEV-01b (model 2): the share of a year this tick lives through — the
   * calendar day of the daily tick (1/160 of a season). Bonus training (an
   * insert, a freed matchday) passes none: only time ages a player.
   */
  agingYears?: number;
}

/** DEV-01 (model 2): a training day's share of the year (32 weeks × Mon–Fri). */
const TRAINING_DAY_YEARS = 1 / (CAREER_TRAINING.trainingDaysPerWeek * CAREER_CALENDAR.weeksPerSeason);

/**
 * rc.35 (front T): the season cap's room for one tick. rc.32–34 stopped dead
 * at CAREER_DEV.seasonGainCap, so a prospect on a package banked the season's
 * points weeks before the rollover and read flat until it (Miguel: "he stops
 * growing, then resumes"). The room left is now spread over the calendar
 * weeks left: a tick may take seasonCapSpread × its share (its weeks ÷ the
 * weeks left), so
 * growth slows near the cap but never stops, and the season total still
 * holds. A tick with no day (an old caller) keeps the plain room.
 */
function seasonRoomFor(ctx: { seasonGained: number; weeks: number; day?: number }): number {
  const room = Math.max(0, CAREER_DEV.seasonGainHardCap - ctx.seasonGained);
  if (ctx.day === undefined) return room;
  const seasonDays = CAREER_CALENDAR.weeksPerSeason * CAREER_CALENDAR.daysPerWeek;
  const weeksLeft = Math.max(0, seasonDays - ctx.day + 1) / CAREER_CALENDAR.daysPerWeek;
  const share = (ctx.weeks * CAREER_DEV.seasonCapSpread) / Math.max(1e-6, weeksLeft);
  return share >= 1 ? room : room * share;
}

/**
 * DEV-01 (model 2): one tick of the growth contract. Growth runs at the pace
 * toward his real peak (potential ± offset), never past it, under the season
 * cap only (no split cap); past his plateau the tick instead loses
 * declinePerYear × the year share it lives × trainingDeclineDampen — the
 * decline lands day by day, never at the rollover.
 */
function contractTick(
  p: SquadPlayer,
  ctx: TrainTickCtx & { weeks: number },
): { player: SquadPlayer; gained: number; declined: number } {
  const { profile, target } = squadArcOf(p, ctx.careerSeed);
  const raw = rawGain(p, ctx);
  const gained = floor4(Math.max(0, Math.min(raw, seasonRoomFor(ctx), target - p.overall)));
  const exactAge = exactAgeOf(ageOf(p.birthYear, ctx.seasonIndex), ctx.day);
  // rc.34 (DEV-03): a recovery package slows the decline while it runs (declineMult ≤ 1).
  const decline = ctx.agingYears
    ? declinePerYearOf({ exactAge, peakAge: p.peakAge, plateauYears: profile.plateauYears, declineRate: p.declineRate }) *
      ctx.agingYears *
      CAREER_AGE.trainingDeclineDampen *
      clamp(ctx.declineMult ?? 1, 0, 1)
    : 0;
  const overall = clamp(round4(p.overall + gained - decline), 60, 99);
  return {
    player: {
      ...p,
      overall,
      attrOffsets: grownOffsets(p, ctx.weeks, overall, ctx.offsetGrowth),
      gainedThisSplit: round4(ctx.splitGained + gained),
      gainedThisSeason: round4(ctx.seasonGained + gained),
    },
    gained,
    declined: Math.max(0, round4(p.overall + gained - overall)),
  };
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
): { player: SquadPlayer; gained: number; declined: number } {
  const weeks = ctx.weeks ?? 1;
  if (isGrowthContract(ctx.model)) return contractTick(p, { ...ctx, weeks });
  const raw = rawGain(p, { ...ctx, weeks });
  const gained = floor4(
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
  const overall = clamp(round4(p.overall + gained), 60, 99);
  return {
    player: {
      ...p,
      overall,
      attrOffsets: grownOffsets(p, weeks, overall, ctx.offsetGrowth),
      gainedThisSplit: round4(ctx.splitGained + gained),
      gainedThisSeason: round4(ctx.seasonGained + gained),
    },
    gained,
    declined: 0,
  };
}

/**
 * One weekday of training (the v0.2 daily tick). `weekShare` scales the day
 * (v0.3: committed-event weeks train at CAREER_TRAINING.matchPrepShare
 * instead of freezing — weak-field events are no longer a development trap).
 */
export function trainDay(
  p: SquadPlayer,
  ctx: Omit<TrainTickCtx, "weeks" | "agingYears"> & {
    /** DEV-01 (model 2): a calendar training day — he also ages a day's share of the year. */
    aging?: boolean;
  },
  weekShare = 1,
): { player: SquadPlayer; gained: number; declined: number } {
  const { aging, ...rest } = ctx;
  return trainWeek(p, {
    ...rest,
    weeks: weekShare / CAREER_TRAINING.trainingDaysPerWeek,
    ...(aging ? { agingYears: TRAINING_DAY_YEARS } : {}),
  });
}

/**
 * Truthful UI projection (v0.2 — the Training screen must not re-implement
 * engine math): expected overall gain per WEEK plus the focused-offset weekly
 * growth, before split/season caps.
 */
export function trainingProjection(
  p: SquadPlayer,
  ctx: GrowthCtx &
    PackageTickCtx & {
      seasonIndex: number;
      coachOverall: number | null;
      gearBonus: number;
      trainingWeekBonus: boolean;
      /** @deprecated rc.34: ignored (the drill retired into the package). */
      drill?: DrillEffect | null;
    },
): {
  weeklyOverall: number;
  /** rc.34: the largest attribute offset growth a week (the package's focus or his tweak). */
  weeklyOffset: number;
  /** DEV-01 (model 2): overall lost per week past his plateau (0 before it; rc.31: 0, the rollover took it). */
  weeklyDecline: number;
} {
  const weeklyOffset = round2(Math.max(0, ...Object.values(ctx.offsetGrowth ?? {}).map((v) => v ?? 0)));
  if (isGrowthContract(ctx.model)) {
    const { profile, target } = squadArcOf(p, ctx.careerSeed);
    const exactAge = exactAgeOf(ageOf(p.birthYear, ctx.seasonIndex), ctx.day);
    const weeklyDecline = round2(
      (declinePerYearOf({ exactAge, peakAge: p.peakAge, plateauYears: profile.plateauYears, declineRate: p.declineRate }) *
        CAREER_AGE.trainingDeclineDampen *
        clamp(ctx.declineMult ?? 1, 0, 1)) /
        CAREER_CALENDAR.weeksPerSeason,
    );
    const weeklyOverall = round2(Math.max(0, Math.min(rawGain(p, { ...ctx, weeks: 1 }), target - p.overall)));
    return { weeklyOverall, weeklyOffset, weeklyDecline };
  }
  const weeklyOverall = round2(
    Math.max(0, Math.min(rawGain(p, { ...ctx, weeks: 1 }), p.potential - p.overall)),
  );
  return { weeklyOverall, weeklyOffset, weeklyDecline: 0 };
}

/**
 * v2.0 (R29) — growth made tangible: how far the player is into the next
 * overall point, how many TRAINING DAYS until it lands at the current weekly
 * rate (null when nothing moves: capped, at potential, or zero rate), and
 * what the split/season caps still allow.
 */
export function trainingEta(
  p: SquadPlayer,
  ctx: GrowthCtx &
    PackageTickCtx & {
      seasonIndex: number;
      coachOverall: number | null;
      gearBonus: number;
      trainingWeekBonus: boolean;
      /** @deprecated rc.34: ignored (the drill retired into the package). */
      drill?: DrillEffect | null;
    },
): {
  progress: number;
  toNext: number;
  daysToNext: number | null;
  weeklyRate: number;
  splitCapLeft: number;
  seasonCapLeft: number;
  atPotential: boolean;
  /** DEV-01 (model 2): false — the split has no cap of its own (rc.31: true, CAREER_TRAINING.maxSplitGain). */
  splitCapped: boolean;
} {
  const whole = Math.floor(p.overall + 1e-9);
  const progress = clamp(p.overall - whole, 0, 1);
  const toNext = round2(Math.max(0, whole + 1 - p.overall));
  const dev01 = isGrowthContract(ctx.model);
  // DEV-01 (model 2): the season cap only, and his real peak (potential ± offset) as the ceiling.
  const ceiling = dev01 ? squadArcOf(p, ctx.careerSeed).target : p.potential;
  const seasonCapLeft = round2(
    Math.max(0, (dev01 ? CAREER_DEV.seasonGainHardCap : CAREER_TRAINING.maxSeasonGain) - p.gainedThisSeason),
  );
  const splitCapLeft = dev01 ? seasonCapLeft : round2(Math.max(0, CAREER_TRAINING.maxSplitGain - p.gainedThisSplit));
  const atPotential = ceiling - p.overall < 1e-6;
  const weeklyRate = trainingProjection(p, ctx).weeklyOverall;
  const capLeft = Math.min(splitCapLeft, seasonCapLeft, Math.max(0, ceiling - p.overall));
  const daysToNext =
    weeklyRate <= 0 || capLeft < toNext - 1e-9
      ? null
      : Math.max(1, Math.ceil((toNext / weeklyRate) * CAREER_TRAINING.trainingDaysPerWeek));
  return { progress, toNext, daysToNext, weeklyRate, splitCapLeft, seasonCapLeft, atPotential, splitCapped: !dev01 };
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
  ctx: GrowthCtx & {
    seasonIndex: number;
    fieldQuality: number;
    isSub: boolean;
    coachOverall: number | null;
    gearBonus: number;
    /** Scale for partial match XP (scrims grant a fraction; default 1). */
    xpWeeksOverride?: number;
    /**
     * DEV-01 (model 2): the series this player actually played in the event —
     * XP = series × CAREER_DEV.xpWeeksPerSeries × field quality.
     */
    seriesPlayed?: number;
  },
): SquadPlayer {
  const quality = clamp(
    ctx.fieldQuality,
    CAREER_TRAINING.fieldQualityMin,
    CAREER_TRAINING.fieldQualityMax,
  );
  if (isGrowthContract(ctx.model)) {
    // DEV-01 base growth: XP comes from the series a player actually plays.
    // A reserve who did not play keeps his training days and earns no
    // starter XP (rc.31 paid the registered sub subXpFactor of the event).
    if (ctx.isSub) return p;
    const weeks =
      (ctx.xpWeeksOverride !== undefined
        ? ctx.xpWeeksOverride
        : (ctx.seriesPlayed ?? 0) * CAREER_DEV.xpWeeksPerSeries) * quality;
    if (weeks <= 0) return p;
    return trainWeek(p, {
      seasonIndex: ctx.seasonIndex,
      coachOverall: ctx.coachOverall,
      gearBonus: ctx.gearBonus,
      trainingWeekBonus: false,
      splitGained: p.gainedThisSplit,
      seasonGained: p.gainedThisSeason,
      weeks,
      model: ctx.model,
      day: ctx.day,
      careerSeed: ctx.careerSeed,
    }).player;
  }
  const baseWeeks = ctx.xpWeeksOverride ?? CAREER_TRAINING.matchXpWeeks;
  const weeks = baseWeeks * quality * (ctx.isSub ? CAREER_TRAINING.subXpFactor : 1);
  const raw = rawGain(p, {
    seasonIndex: ctx.seasonIndex,
    coachOverall: ctx.coachOverall,
    gearBonus: ctx.gearBonus,
    trainingWeekBonus: false,
    weeks,
  });
  const gained = floor4(
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
  const overall = clamp(round4(p.overall + gained), 60, 99);
  return {
    ...p,
    overall,
    attrOffsets: grownOffsets(p, weeks, overall),
    gainedThisSplit: round4(p.gainedThisSplit + gained),
    gainedThisSeason: round4(p.gainedThisSeason + gained),
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
 * retirement one season ahead — never an abrupt exit. DEV-02 (R48): the roll
 * is `retirementChanceFor` (the 24–29 window, never before the peak); a
 * legacy player already past 29 announces at once and plays one farewell
 * season. `rng` = rollover stream.
 */
export function squadRollover(
  p: SquadPlayer,
  seasonIndex: number,
  rng: Rng,
  /** rc.32 (DEV-01): the save's development model (absent = rc.31's rollover decline). */
  growth?: GrowthCtx,
): { player: SquadPlayer; declined: number; announcedRetirement: boolean; retiresNow: boolean } {
  const age = ageOf(p.birthYear, seasonIndex);
  const cap = CAREER_DEV.attrOffsetCap;
  // DEV-01b (model 2): the decline already landed day by day through the
  // season (contractTick) — the rollover moves no overall; past his plateau
  // the mechanics-first offset drift still applies.
  const dev01 = isGrowthContract(growth?.model);

  const d = CAREER_AGE.declineByAge;
  const baseDecline = age >= 27 ? d.a27plus : age >= 25 ? d.a25_26 : age >= 23 ? d.a23_24 : age >= 22 ? d.a22 : 0;
  const declineAmount = dev01
    ? 0
    : baseDecline *
      (CAREER_AGE.declineRateMult[p.declineRate] ?? 1) *
      // v1: training focus is always set (auto by default), so active-training
      // dampening applies to every squad player.
      CAREER_AGE.trainingDeclineDampen;

  const overall = dev01 ? p.overall : clamp(round2(p.overall - declineAmount), 60, 99);
  const declined = round2(p.overall - overall);
  const declining = dev01
    ? developmentPhaseOf(exactAgeOf(age, 1), {
        peakAge: p.peakAge,
        plateauYears: squadArcOf(p, growth?.careerSeed).profile.plateauYears,
      }) === "declining"
    : declined > 0;

  const attrOffsets = { ...p.attrOffsets };
  if (declining) {
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

  // DEV-02 (R48): announce at the rollover into his final season — only
  // inside the 24–29 window and never before his peak; the season at 29 (or
  // the last one before a calendar jump past 29) always ends it.
  const chance = retirementChanceFor({
    age,
    nextAge: ageOf(p.birthYear, seasonIndex + 1),
    peakAge: peakAgeOf(p),
    overall: p.overall,
    starOverall: CAREER_AGE.retirementStarOverallSquad,
  });
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
