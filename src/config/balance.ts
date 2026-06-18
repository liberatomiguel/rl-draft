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
  /** overall >= goldMin → gold card. */
  goldMin: 80,
  /** overall >= silverMin → silver card. Below → common (no rarity). */
  silverMin: 70,
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
  /**
   * Superteam compression (v0.5): rating above the pivot counts at the slope.
   * The champion-heavy dataset produces historical rosters at 98-102 total
   * (elite players + 100% lineup chemistry + maxed buffs) — an unbeatable
   * wall in a Bo7. Compressing BOTH sides (AI lineups and dream drafts alike)
   * keeps the hierarchy while making the title reachable. Applied before the
   * difficulty shift.
   */
  superteamPivot: 94,
  superteamSlope: 0.55,
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
  // v1.2.0 rework — generous + REACHABLE; v1.2.1 lowered the tier floors so MAX
  // is attainable. A drafted team that commits to a country stack (or a real
  // lineup) now lands Perfect; a same-lineup pair lands Good. AI lineups are full
  // stacks (≈100% either way), so this
  // does NOT inflate the field — it lets the PLAYER close the chemistry gap by
  // building, which is the intended strategic lever (trade a little overall for
  // a coherent roster). Earlier the realistic ceiling was ~Okay; now it pays off.
  weights: {
    /** Per pair of the 3 players. Strongest link counts: lineup > org > country > region. */
    sameLineupPair: 4,
    /** Shared org now OUTRANKS country (v1.3.1) — org overlap is the path to Perfect. */
    sameOrgPair: 3,
    sameCountryPair: 2,
    /**
     * Same-region pair: the weakest link — the floor that lifts a coherent-but-
     * mixed roster (e.g. a Brazil+Argentina SAM duo) out of Poor. In region-locked
     * play (everyone shares a region) this keeps the baseline around Okay/Good
     * while real org overlap is still required for Perfect.
     */
    sameRegionPair: 1,
    /** Per player whose drafted card org matches the drafted org (org loyalty). */
    orgLinkPerPlayer: 1.5,
    /**
     * Coach/sub connect by lineup, org or nationality (same country, or region at
     * half), each capped. Lets a drafted coach who shares the roster's heritage
     * contribute — staff cards carry country/region.
     */
    coachLink: 1.5,
    coachLinkMax: 3,
    subLink: 1,
    subLinkMax: 2,
    /** Fraction of a staff link granted for a region-only (not country) match. */
    staffRegionFactor: 0.5,
  },
  /**
   * Full bar (v1.3.1). Raising the ceiling from 12 to 15 means **Perfect requires
   * real org/lineup overlap** — the strongest a country-only roster can reach is a
   * 3-country stack (6) + national staff (~+4) ≈ Good. Perfect (a FULL bar) needs
   * a real trio + their org, or a heavy org dynasty + staff. Per Miguel: only a
   * completely full bar reads "Perfect", and country alone must never get there.
   */
  maxRaw: 15,
  /**
   * Percent thresholds (inclusive lower bound) → tier. Perfect is **100% only** —
   * the bar must be completely full (raw ≥ maxRaw). A 3-player country stack lands
   * Good; org/lineup overlap + loyalty/staff is what climbs to Great → Perfect.
   */
  tiers: [
    { min: 100, tier: "Perfect" },
    { min: 72, tier: "Great" },
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
  /** Scales the USER team's chemistry rating bonus: percent/100 * chemistryMaxBonus. */
  chemistryMaxBonus: number;
  /**
   * Same, but for AI opponents. AI lineups are real rosters (~100% chemistry),
   * so a shared cap handed the whole field a near-flat buff the player (low
   * chemistry) couldn't match. Splitting it lets chemistry be the PLAYER's edge:
   * Hard/Legacy set this to 0 (opponents earn their strength from overall + the
   * rating shift + a stronger field, not from chemistry). See DESIGN-DECISIONS #54.
   */
  opponentChemistryMaxBonus: number;
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

/*
 * v0.5 playtest pass: the live MVP played too hard — good rosters were
 * missing playoffs on Normal. Two structural causes:
 *  1. Every AI lineup is a real historical roster → 100% chemistry, while a
 *     drafted all-star mix sits near ~20%. chemistryMaxBonus was effectively
 *     a flat buff to the WHOLE FIELD, so it was lowered across the board.
 *  2. Per-series form swing (±6) drowned out rating gaps → lowered to ±4.5
 *     (see SIMULATION.seriesFormRange).
 */
export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  easy: {
    label: "Easy",
    tagline: "Learn the loop. Forgiving variance, friendlier bracket.",
    rerolls: 3,
    overallLockedHidden: false,
    userRollRange: [-3, 5],
    aiRollRange: [-4, 4],
    chemistryMaxBonus: 1.3,
    opponentChemistryMaxBonus: 1.3,
    opponentRatingShift: -2.0,
    opponentSpecialChance: 0.02,
    opponentTierWeights: { elite: 0.4, strong: 0.9, solid: 1.8, underdog: 2.0 },
    xpMultiplier: 1.0,
  },
  normal: {
    label: "Normal",
    tagline: "The standard RLCS experience. Balanced field.",
    rerolls: 1,
    overallLockedHidden: false,
    userRollRange: [-3, 4],
    aiRollRange: [-4, 4],
    chemistryMaxBonus: 2.0,
    opponentChemistryMaxBonus: 2.0,
    // v1.3.1: Normal is the "you can win with a good team" mode. A -1.0 field
    // shift makes a 90-overall team a real (if modest ~3%) title threat and a
    // 92 elite a strong one (~13%), per Miguel's targets.
    opponentRatingShift: -1.0,
    opponentSpecialChance: 0.05,
    opponentTierWeights: { elite: 0.7, strong: 1.0, solid: 1.25, underdog: 1.3 },
    xpMultiplier: 1.0,
  },
  hard: {
    label: "Hard",
    tagline: "Hidden overalls. Stronger field. Knowledge wins.",
    rerolls: 0,
    overallLockedHidden: true,
    // v0.3: was [-5,4] / +1.0 / elite 1.8 — playtesting showed good rosters
    // missing playoffs too often (the champion-heavy dataset compounds it).
    // v0.5: user roll moves toward Normal's — Hard's identity is the stronger
    // field and hidden overalls, not a punitive dice range.
    userRollRange: [-3.5, 4],
    aiRollRange: [-4, 4],
    // v1.3: chemistry is the PLAYER's asymmetric edge here (AI cap = 0), so a
    // small bump rewards a coherent draft without inflating the field.
    chemistryMaxBonus: 2.3,
    opponentChemistryMaxBonus: 0,
    // v1.3.1: targets — a 90 team should NOT win Hard, a 92 elite ~10%, a 95
    // dream comfortably. The field is fewer-superteams (low elite weight) but
    // still stronger than Normal (more strong, fewer underdogs) and, crucially,
    // played with overalls HIDDEN — the real difficulty is drafting blind.
    opponentRatingShift: -0.2,
    opponentSpecialChance: 0.12,
    opponentTierWeights: { elite: 0.7, strong: 1.1, solid: 1.0, underdog: 0.7 },
    xpMultiplier: 1.5,
  },
  legacy: {
    label: "Legacy",
    tagline: "An all-time gauntlet of championship rosters.",
    rerolls: 0,
    overallLockedHidden: true,
    userRollRange: [-5, 5],
    aiRollRange: [-4, 4],
    // v1.3: legacy was near-unwinnable even with a strong draft (live feedback:
    // a 2h session, zero titles). Two levers, both keeping it the hardest mode:
    //  · opponentRatingShift 1.2 → 0.9 — the gauntlet still hits harder than Hard,
    //    but a genuinely great draft can now break through.
    //  · chemistryMaxBonus 2.6 → 2.9 — the player's edge (AI cap = 0); a committed,
    //    coherent roster is rewarded. The bigger structural help is the org-unique
    //    field (engine/opponents) — you no longer face the same superteam 3×.
    chemistryMaxBonus: 2.9,
    opponentChemistryMaxBonus: 0,
    // v1.3.1 targets — a 95+ dream draft wins ~10%, a 92 elite very rarely (<2%),
    // a 90 team never. Softer than v1.3 (shift 0.6→0.2, elite 1.8→1.4) so a true
    // dream team breaks through ~1-in-10 while it stays comfortably the hardest
    // mode. The Bo7 gauntlet is inherently steep — a 3-overall gap (92→95) is the
    // difference between "almost never" and "~10%", which is the intended feel.
    opponentRatingShift: 0.2,
    opponentSpecialChance: 0.18,
    opponentTierWeights: { elite: 1.4, strong: 1.1, solid: 0.3, underdog: 0.15 },
    xpMultiplier: 2.0,
    requiresLegacyUnlock: true,
  },
};

/**
 * Region-locked normalisation (v1.3.1). A regional pool (SAM) tops out far below
 * the worldwide field — its best teams sit ~88-90, not ~96 — so the same
 * difficulty would be trivially easy. This flat boost is added to every
 * region-locked OPPONENT's rating so the regional curve mirrors the worldwide one
 * with adapted overalls: a SAM-best (~90) draft faces roughly the same odds a
 * worldwide dream (~95) does. Tuned so SAM legacy lands near the worldwide
 * targets. Only applies when a run is region-locked; worldwide runs use 0.
 */
export const REGION_LOCK = {
  opponentRatingBoost: 3,
} as const;

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

export const DRAFT = {
  /** Lineups are drawn without replacement; pool resets if exhausted. */
  withoutReplacement: true,
  /**
   * Anti-frustration tilt (v1.3). The draft stays mostly random — weak rosters
   * MUST keep showing up — but offers are softly weighted toward historically
   * stronger lineups so a long session is less likely to be a parade of teams
   * that could never win. `tierBias` lerps from 0 (pure uniform, off) to 1 (the
   * full `draftTierWeights`). Kept deliberately gentle: at 0.35 an elite lineup
   * is ~1.35× as likely and an underdog ~0.9× — a nudge, not a filter.
   *
   * Mode-gated: NEVER applied to the daily (its draw must stay byte-identical for
   * the globally-shared seed); classic/quick only. Does NOT touch the candidate
   * pool, so the hard rule "difficulty never shapes the draft" is intact — this
   * is a global, difficulty-independent feel tweak.
   */
  tierBias: 0.35,
  draftTierWeights: { elite: 2.0, strong: 1.4, solid: 1.0, underdog: 0.7 } as Record<
    HistoricalStrength,
    number
  >,
  /**
   * When the only open slots are coach/sub, the draw favors lineups that can
   * still fill them (weight ramps from 1 → this as the lineup covers more of
   * the missing kinds). Soft bias — blanks still appear, just rarely.
   */
  staffScarcityBoost: 5,
  /**
   * Easter-egg lineups (Lineup.rareSpawn) are EXCLUDED from the normal draw and
   * instead force-injected into one offer at this per-offer chance — only in a
   * region-locked pool that contains one (Wings, SAM). ~1% per offer ≈ 8-10%
   * over a classic run / 3-6% over a quick run. When it appears the creator's
   * card is guaranteed to be the Creator special. Tune to taste; 0 disables.
   * (v1.2.0)
   */
  easterEggChance: 0.01,
} as const;

// ---------------------------------------------------------------------------
// Special cards (v0.5: specials belong to the PLAYER, not one base card —
// any Kronovi card can roll any Kronovi special).
// ---------------------------------------------------------------------------

export const SPECIALS = {
  /**
   * Chance a player card in an offer appears as one of that player's
   * specials. v0.5.1: 0.16 → 0.06 by direction — at 16% (×the per-player
   * pool) runs were seeing 3-4 specials and they stopped feeling special.
   */
  appearanceChance: 0.05,
  /** Coach cards roll their person's coach specials at this chance. */
  coachAppearanceChance: 0.05,
  /**
   * When a special DOES appear, which one is weighted by rarity tier.
   * Within a player's pool: rare ≈ common sight, legendary ≈ chase pull.
   */
  rarityWeights: { rare: 100, epic: 55, mythic: 28, legendary: 12, creator: 12 } as Record<
    string,
    number
  >,
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
   * v0.5: 6 → 4.5 — at ±6 a +3 rating edge was close to a coin flip, which
   * read as "my good team keeps losing" in playtests.
   */
  seriesFormRange: 4.5,
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
  /** Quick Draft: straight 8-team single-elimination, shorter series. */
  quick: {
    teams: 8,
    bestOf: 5,
  },
} as const;

// ---------------------------------------------------------------------------
// Progression (base doc §30)
// ---------------------------------------------------------------------------

export const XP = {
  completeRun: 50,
  swissWin: 20,
  qualifyPlayoffs: 75,
  /** Per playoff series won (double elimination has up to 5 for the user). */
  playoffSeriesWin: 40,
  /** Final placement bonuses. */
  placementBonus: {
    champion: 200,
    runner_up: 100,
    third: 60,
    fourth: 40,
  } as Record<string, number>,
  /** Bonus multiplier when the run was played with hidden overalls. */
  hiddenOverallBonus: 0.25,
  /** Run-XP multiplier per game mode. */
  modeMultiplier: {
    classic: 1.0,
    quick: 0.5,
    daily: 1.5,
  } as Record<string, number>,
  /**
   * Flat XP for unlocking a NEW special card, by rarity (v0.7.0). Kept modest
   * by direction — it's a collection reward, not run performance, so it is
   * added AFTER the difficulty multiplier (like achievement XP) and never
   * scaled. Reference: a run completion is 50 XP.
   */
  specialUnlock: { rare: 10, epic: 20, mythic: 40, legendary: 75, creator: 100 } as Record<
    string,
    number
  >,
} as const;

/**
 * Rank ladder (v0.3 curve). Target: Supersonic Legend in ~100-150 runs.
 * An average run earns ~150-300 XP, a winning run ~500-800.
 */
export const RANKS = [
  { id: "unranked", label: "Unranked", minXp: 0 },
  // v1.3: Bronze lowered 400 → 300 so even a losing first run clears it — the
  // Unranked on-ramp (no specials / no collection) is meant to be one run long.
  { id: "bronze", label: "Bronze", minXp: 300 },
  { id: "silver", label: "Silver", minXp: 1200 },
  { id: "gold", label: "Gold", minXp: 3000 },
  { id: "platinum", label: "Platinum", minXp: 6500 },
  { id: "diamond", label: "Diamond", minXp: 11500 },
  { id: "champion", label: "Champion", minXp: 19000 },
  { id: "grand-champion", label: "Grand Champion", minXp: 29000 },
  { id: "supersonic-legend", label: "Supersonic Legend", minXp: 40000 },
] as const;

/**
 * Rank-gated rewards (v1.3) — progression now UNLOCKS content, giving the ladder
 * real stakes:
 *  · `rarities`  — special-card rarities that can appear in YOUR draft (and thus
 *    your collection). Lower ranks unlock tiers in turn; Diamond+ have them all.
 *  · `specialChance` — the player's special-appearance chance per offer card. The
 *    chase quickens at the very top (Champion 8% / GC 12% / SSL 16%).
 *  · `collection` — whether the Collection screen is open.
 *  · `hardMode` — whether Hard difficulty is available (Legacy still needs a Hard
 *    win on top). Unranked is a brief on-ramp; Bronze is ~1 run away.
 * NEVER touches opponents, the draft POOL, or the daily — only the player's
 * own special-card rewards and screen/mode access.
 */
export const RANK_REWARDS: Record<
  string,
  { rarities: string[]; specialChance: number; collection: boolean; hardMode: boolean }
> = {
  unranked: { rarities: [], specialChance: 0, collection: false, hardMode: false },
  bronze: { rarities: ["rare"], specialChance: 0.05, collection: true, hardMode: false },
  silver: { rarities: ["rare", "epic"], specialChance: 0.05, collection: true, hardMode: true },
  gold: { rarities: ["rare", "epic", "mythic"], specialChance: 0.05, collection: true, hardMode: true },
  platinum: { rarities: ["rare", "epic", "mythic"], specialChance: 0.05, collection: true, hardMode: true },
  diamond: { rarities: ["rare", "epic", "mythic", "legendary", "creator"], specialChance: 0.05, collection: true, hardMode: true },
  champion: { rarities: ["rare", "epic", "mythic", "legendary", "creator"], specialChance: 0.08, collection: true, hardMode: true },
  "grand-champion": { rarities: ["rare", "epic", "mythic", "legendary", "creator"], specialChance: 0.12, collection: true, hardMode: true },
  "supersonic-legend": { rarities: ["rare", "epic", "mythic", "legendary", "creator"], specialChance: 0.16, collection: true, hardMode: true },
};

export const HISTORY_LIMIT = 25;

// ---------------------------------------------------------------------------
// Experimental feature flags (v0.7.0). Each is a single revert point — flip
// to false to fully disable the feature with no other code change.
// ---------------------------------------------------------------------------

export const FEATURES = {
  /**
   * Results screen reveals the lineup that knocked the user out on a lost run
   * (a subdued strip — "who ended my run"). EASY TO REVERT: set false and the
   * results `eliminatedBy` data stays null, so the UI block renders nothing.
   */
  showEliminatorTeam: true,
} as const;
