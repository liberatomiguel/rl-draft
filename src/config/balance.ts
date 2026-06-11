/**
 * BALANCE CONFIG — every tunable number in the game lives here.
 *
 * Designers: edit values, run `npm run test` (the sanity suite asserts the
 * design targets from the base document still hold), then playtest.
 * See docs/BALANCE-GUIDE.md for what each knob does and its safe range.
 */

import type { BuffLevel, Difficulty, HistoricalStrength } from "@/engine/types";

// ---------------------------------------------------------------------------
// Card rarity (visual only — does not affect simulation)
// ---------------------------------------------------------------------------

export const RARITY = {
  /** overall >= blueMin → blue card. */
  blueMin: 90,
  /** overall >= goldMin → gold card. Below → silver. */
  goldMin: 80,
} as const;

// ---------------------------------------------------------------------------
// Org / coach buff symbols → numeric levels
// ---------------------------------------------------------------------------

export const BUFF_LEVEL_VALUE: Record<BuffLevel, number> = {
  "~": 0,
  "+": 1,
  "++": 2,
  "+++": 3,
};

// ---------------------------------------------------------------------------
// Team rating — design target weighting (base doc §18):
// players ~75%, coach ~8%, sub ~4%, org ~5%, chemistry ~5%, specials ~3%.
// Implemented as: rating = avg player overall + bounded additive modifiers.
// ---------------------------------------------------------------------------

export const TEAM_RATING = {
  coach: {
    /** Modifier = (overall - baseline) * scale + bonusLevel * perBonusLevel */
    baseline: 75,
    scale: 0.1,
    perBonusLevel: 0.25,
    max: 2.5,
  },
  sub: {
    baseline: 75,
    scale: 0.05,
    max: 1.2,
    /** Player cards drafted into the sub slot use the same formula. */
  },
  org: {
    perBuffLevel: 0.6, // "+" 0.6 · "++" 1.2 · "+++" 1.8
  },
  special: {
    /** Passive rating per special card on the roster (situational effects are separate). */
    perCard: 0.4,
    max: 1.2,
  },
} as const;

// ---------------------------------------------------------------------------
// Chemistry (base doc §22). Raw points → percent of maxRaw → tier.
// The rating impact of chemistry is per-difficulty (chemistryMaxBonus).
// ---------------------------------------------------------------------------

export const CHEMISTRY = {
  weights: {
    /** Per pair of the 3 players. Strongest link counts (lineup ⊃ org). */
    sameLineupPair: 3,
    sameCountryPair: 2,
    sameOrgPair: 1,
    /** Per player whose card org matches the drafted org. */
    orgLinkPerPlayer: 1,
    /** Coach sharing lineup/org with players or org (capped). */
    coachLink: 1,
    coachLinkMax: 2,
    /** Sub sharing lineup/org/country with players or org (capped). */
    subLink: 1,
    subLinkMax: 2,
  },
  /** 3 pairs × 3 + 3 org links + coach 2 + sub 2. */
  maxRaw: 16,
  /** Percent thresholds (inclusive lower bound) → tier. */
  tiers: [
    { min: 85, tier: "Perfect" },
    { min: 62, tier: "Great" },
    { min: 40, tier: "Good" },
    { min: 18, tier: "Okay" },
    { min: 0, tier: "Poor" },
  ] as const,
} as const;

// ---------------------------------------------------------------------------
// Difficulty profiles (base doc §7, §25, §26).
// IMPORTANT DESIGN RULE: difficulty never touches the draft lineup pool.
// ---------------------------------------------------------------------------

export interface DifficultyProfile {
  label: string;
  tagline: string;
  rerolls: number;
  /** When true the run is always played with hidden overalls. */
  overallLockedHidden: boolean;
  /** User-team per-game random roll range [min, max]. */
  userRollRange: [number, number];
  /** AI per-game roll range (both sides in AI vs AI). */
  aiRollRange: [number, number];
  /** Scales chemistry rating bonus: percent/100 * chemistryMaxBonus. */
  chemistryMaxBonus: number;
  /** Flat rating shift applied to every opponent. */
  opponentRatingShift: number;
  /** Chance per opponent team of upgrading one card to its special version. */
  opponentSpecialChance: number;
  /** Sampling weights for opponent lineups by historical strength. */
  opponentTierWeights: Record<HistoricalStrength, number>;
  /** XP multiplier for run rewards. */
  xpMultiplier: number;
  /** Requires a Hard tournament win to play. */
  requiresLegacyUnlock?: boolean;
}

export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  easy: {
    label: "Easy",
    tagline: "Learn the loop. Forgiving variance, friendlier bracket.",
    rerolls: 3,
    overallLockedHidden: false,
    userRollRange: [-3, 5],
    aiRollRange: [-4, 4],
    chemistryMaxBonus: 1.2,
    opponentRatingShift: -1.5,
    opponentSpecialChance: 0.02,
    opponentTierWeights: { elite: 0.5, strong: 1.0, solid: 1.8, underdog: 1.8 },
    xpMultiplier: 1.0,
  },
  normal: {
    label: "Normal",
    tagline: "The standard RLCS experience. Balanced field.",
    rerolls: 1,
    overallLockedHidden: false,
    userRollRange: [-4, 4],
    aiRollRange: [-4, 4],
    chemistryMaxBonus: 2.2,
    opponentRatingShift: 0,
    opponentSpecialChance: 0.05,
    opponentTierWeights: { elite: 1.0, strong: 1.0, solid: 1.0, underdog: 1.0 },
    xpMultiplier: 1.0,
  },
  hard: {
    label: "Hard",
    tagline: "Hidden overalls. Stronger field. Knowledge wins.",
    rerolls: 0,
    overallLockedHidden: true,
    userRollRange: [-5, 4],
    aiRollRange: [-4, 4],
    chemistryMaxBonus: 2.8,
    opponentRatingShift: 1.0,
    opponentSpecialChance: 0.12,
    opponentTierWeights: { elite: 1.8, strong: 1.3, solid: 0.6, underdog: 0.4 },
    xpMultiplier: 1.5,
  },
  legacy: {
    label: "Legacy",
    tagline: "An all-time gauntlet of championship rosters.",
    rerolls: 0,
    overallLockedHidden: true,
    userRollRange: [-5, 5],
    aiRollRange: [-4, 4],
    chemistryMaxBonus: 2.8,
    opponentRatingShift: 1.5,
    opponentSpecialChance: 0.18,
    opponentTierWeights: { elite: 2.6, strong: 1.2, solid: 0.15, underdog: 0.1 },
    xpMultiplier: 2.0,
    requiresLegacyUnlock: true,
  },
};

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

export const DRAFT = {
  /** Chance a player card appears as its special version (if one exists). */
  specialAppearanceChance: 0.07,
  /** Lineups are drawn without replacement; pool resets if exhausted. */
  withoutReplacement: true,
} as const;

// ---------------------------------------------------------------------------
// Match simulation (base doc §25). Overall must remain the strongest factor.
// Design anchors (asserted by tests/match.sanity):
//   ~equal ratings → ~50/50 series · +2 → ~62-72% · +6 → ≥90% · +12 → ≥98%
// ---------------------------------------------------------------------------

export const SIMULATION = {
  /**
   * Per-series "form" swing (±). Rolled once per team per series, so it does
   * not average out across a best-of like per-game noise does — this is the
   * main upset engine. Consistency/defense_stability dampen its bad side.
   */
  seriesFormRange: 6,
  /** Stat baseline for situational modifiers: (stat - baseline) / divisor. */
  statBaseline: 82,
  statDivisor: 18,
  /** Deciding-game clutch weight. */
  clutchWeight: 1.2,
  /** Playoff experience weight (applies every playoff game). */
  experienceWeight: 0.8,
  /** Negative-roll dampening from consistency: roll *= 1 - factor*norm. */
  consistencyDampen: 0.35,
  /** Mechanics "high roll" proc: chance scales with stat, flat bonus. */
  mechProcBaseChance: 0.12,
  mechProcBonus: 2.0,
  /** Effective-score gap under which a game goes to overtime. */
  overtimeThreshold: 0.9,
  /** Extra clutch weight applied to the OT winner check. */
  overtimeClutchWeight: 0.8,
  /** defense_stability special: extra negative-variance dampening per value point. */
  defenseStabilityDampenPerPoint: 0.08,
  /** upset_boost activates when own rating is below opponent's by this margin. */
  upsetActivationGap: 2,
} as const;

// ---------------------------------------------------------------------------
// Tournament structure (base doc §24)
// ---------------------------------------------------------------------------

export const TOURNAMENT = {
  swiss: {
    teams: 16,
    bestOf: 5,
    winsToAdvance: 3,
    lossesToEliminate: 3,
  },
  playoffs: {
    teams: 8,
    bestOf: 7,
  },
} as const;

// ---------------------------------------------------------------------------
// Progression (base doc §30)
// ---------------------------------------------------------------------------

export const XP = {
  completeRun: 50,
  swissWin: 20,
  qualifyPlayoffs: 75,
  reachSemifinal: 50,
  reachFinal: 75,
  winTournament: 200,
  /** Bonus multiplier when the run was played with hidden overalls. */
  hiddenOverallBonus: 0.25,
} as const;

export const RANKS = [
  { id: "bronze", label: "Bronze", minXp: 0 },
  { id: "silver", label: "Silver", minXp: 300 },
  { id: "gold", label: "Gold", minXp: 800 },
  { id: "platinum", label: "Platinum", minXp: 1600 },
  { id: "diamond", label: "Diamond", minXp: 2800 },
  { id: "champion", label: "Champion", minXp: 4500 },
  { id: "grand-champion", label: "Grand Champion", minXp: 7000 },
  { id: "supersonic-legend", label: "Supersonic Legend", minXp: 10000 },
] as const;

export const HISTORY_LIMIT = 25;
