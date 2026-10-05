/**
 * BALANCE CONFIG — every tunable number in the game lives here.
 *
 * Designers: edit values, run `npm run test` (the sanity suite asserts the
 * design targets from the base document still hold), then playtest.
 * See docs/BALANCE-GUIDE.md for what each knob does and its safe range.
 */

import type { BuffLevel, Difficulty, HistoricalStrength, Placement } from "@/engine/types";

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
    /**
     * Situational stat bonus the sub lends as squad DEPTH (v1.3.3): consistency
     * (a steady bench) and experience (a veteran presence), scaling with the sub's
     * overall so a strong — or special — sub matters more than a token bench piece.
     * bonus = clamp(1 + (overall - depthBaseline) * depthScale, depthMin, depthMax).
     */
    depthBaseline: 80,
    depthScale: 0.12,
    depthMin: 0.5,
    depthMax: 2.5,
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
  // v1.4 ADDITIVE model (Miguel's call): chemistry should reward EVERY factor the
  // player weighed when building, not just the single strongest link. Per player pair,
  // raw = CONNECTION + HERITAGE — two INDEPENDENT axes, summed. WITHIN each axis only
  // the strongest form counts, because the alternatives describe the SAME underlying
  // fact (being ex-teammates already implies a shared lineup/org), so stacking them
  // would double-count one relationship and explode the bar. ACROSS the two axes they
  // DO stack: a same-country pair who also shared an org now scores country + org, not
  // just country — which is the whole point (shared-org history finally counts on top).
  weights: {
    // CONNECTION axis — how their teams/orgs overlap (strongest form wins):
    connLineup: 4, //     drafted from the SAME lineup (rare for players)
    connTeammates: 3, //  were on a real lineup together in their careers (ex-teammates)
    connOrg: 2.5, //      share an org — current cards same org, OR a shared career org
    // HERITAGE axis — shared origin (strongest form wins):
    herCountry: 2.5,
    herRegion: 1.5, //    the floor that lifts a mixed-nationality regional roster
    /** Per player whose drafted card org matches the drafted org (org loyalty). */
    orgLinkPerPlayer: 2,
    /**
     * Coach/sub connect by lineup, org or nationality (same country, or region at
     * half), each capped. These are additive supplements on top of the pair axes.
     */
    coachLink: 2,
    coachLinkMax: 3,
    subLink: 2,
    subLinkMax: 2,
    /** Staff NATIONALITY is a soft bonus, below a full org/lineup link. */
    staffCountryBonus: 0.5,
    /** Fraction of the country bonus granted for a region-only (not country) match. */
    staffRegionFactor: 0.5,
  },
  /**
   * Ceiling (v1.4, additive). maxRaw 10: **3 same-country players land Great**
   * (3 pairs × 2.5 = 7.5 → 75%) and **any real connection completes the bar** —
   * shared org/teammates (+2.5/pair), org loyalty (+2/player) or matching staff. A
   * pure country stack never reaches Perfect on its own. Real historical lineups
   * saturate (a true trio is ~19+ → capped 100%), so the AI field is not inflated.
   */
  maxRaw: 10,
  /**
   * Percent thresholds (inclusive lower bound) → tier. Perfect is **100% only**
   * (a full bar). A 3-player country stack lands Great; a real connection completes it.
   */
  tiers: [
    { min: 100, tier: "Perfect" },
    { min: 70, tier: "Great" },
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
    opponentRatingShift: -1.3,
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
    chemistryMaxBonus: 2.4,
    opponentChemistryMaxBonus: 0,
    // v1.3.1 targets, eased v1.4: a 90 team shouldn't win Hard, a 92 elite a real
    // shot, a 95 dream comfortably. The field is fewer-superteams (low elite weight)
    // but still stronger than Normal and played with overalls HIDDEN — the real
    // difficulty is drafting blind. v1.4: -0.2 -> -0.7 nudges the blended total
    // toward ~15% (Miguel's target; faithful sim showed ~12.5% at -0.2). The curve
    // is flat (weak teams dominate the blend), so this is a measured, not drastic,
    // move; the §25 anchors are about rating DIFFS, untouched.
    opponentRatingShift: -0.7,
    opponentSpecialChance: 0.12,
    opponentTierWeights: { elite: 1.0, strong: 1.1, solid: 1.0, underdog: 0.7 },
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
    chemistryMaxBonus: 3,
    opponentChemistryMaxBonus: 0,
    // v1.4 retune (#79.1) anchored on the REALISTIC-draft win-rate CURVE
    // (`difficulty.sim.test.ts`: real synergy-aware drafts + the reset behaviour,
    // measured by final overall — not a hardcoded team). Target: the elite TIER has a
    // real, satisfying shot (no "never win"), while non-elite ≈ 0.
    // v1.4 "World Stage" final pass (#94): shift 1.2 → 1.3 to make Legacy a touch
    // harder (Miguel: "1-2% harder, sem exagero"). Worldwide curve at 1.3: a ~92 team
    // ≈ 0%, 94-95 ≈ 2.5%, 96-97 ≈ 15% (holds), a 98+ pinnacle ≈ 42% — tightened from
    // ~49% at 1.2, so the all-time wall is a touch higher at the very top while still
    // rewarding (no "never win"). The earlier 1.35 → 1.70 → 1.2 sweep had lifted the
    // whole elite tier; this +0.1 nudges it back down a hair, concentrated at 98+.
    // SAM lives on its own flatter scale via REGION_LOCK.legacy and is hardened
    // SEPARATELY this pass (boost 1.5 → 1.65, NOT lockstep) so both scales toughen.
    opponentRatingShift: 1.3,
    opponentSpecialChance: 0.18,
    opponentTierWeights: { elite: 1.8, strong: 1.1, solid: 0.3, underdog: 0.15 },
    xpMultiplier: 2.0,
    requiresLegacyUnlock: true,
  },
};

/**
 * Region-locked normalisation (v1.3.1, per-difficulty since v1.3.3). A regional
 * pool (SAM) tops out far below the worldwide field — best rosters ~89, best
 * players ~91 vs ~95/98 worldwide — so without help the same difficulty would be
 * trivially easy. This flat boost is added to every region-locked OPPONENT's
 * rating so the regional curve mirrors the worldwide one with adapted overalls.
 * Only applies when a run is region-locked; worldwide runs use 0.
 */
export const REGION_LOCK = {
  // Per-difficulty (v1.3.3) so each mode's regional field can be tuned on its own.
  //  · easy/normal/hard keep the v1.3.2 value (2). SAM there stays the accessible,
  //    region-pride mode — Hard SAM is still easy at the top (a strong draft wins
  //    most runs); Hard has its own rate and was left untouched this pass.
  //  · legacy 4.0 (v1.4.3, #99; was 2.8 in #98, 1.65 in #94): SAM lives on a LOWER, FLATTER
  //    overall scale (weaker pool, but very high chemistry), so it gets its OWN curve, not
  //    the worldwide one. The SAM effective shift = legacy.opponentRatingShift (1.3) +
  //    this boost = 5.30. The achievable SAM ceiling is ~95 (the strongest roster ever
  //    built). At 2.8 the TITLE rate looked fine, but the REACH-THE-FINAL rate exposed the
  //    ease (Miguel's #99 feedback — winning/reaching the final with weak teams): a "not so
  //    strong" 90-91 reached the grand final in 32% of runs and a 92-93 in 68%. Raised
  //    2.8 → 4.0 to wall out non-elite while the 95 ceiling stays rewarding. Measured
  //    (`difficulty.sim.test.ts`, SAM — title / reach-final): 88-89 ≈ 0.6% / 2%, 90-91 ≈
  //    3% / 14%, 92-93 ≈ 13% / 48%, the 94-95 ceiling ≈ 32% / 87%, blended ≈ 10% / 34%.
  //    The flat SAM curve means hardening the top also hardens the middle.
  opponentRatingBoost: { easy: 2, normal: 2, hard: 2, legacy: 4.0 } as Record<
    Difficulty,
    number
  >,
} as const;

// ---------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------

export const DRAFT = {
  /** Lineups are drawn without replacement; pool resets if exhausted. */
  withoutReplacement: true,
  /**
   * Anti-frustration tilt (v1.3; overall-based since v1.3.3). The draft stays
   * mostly random — weak rosters MUST keep showing up — but offers are softly
   * weighted toward higher-OVERALL lineups so a long session is less likely to be
   * a parade of teams that could never win. A lineup's roster overall is
   * normalised within the draw pool (0 = pool's weakest, 1 = strongest), mapped to
   * a raw weight in [draftWeight.min, .max], then scaled by the bias:
   * `weight = 1 + (raw - 1) * bias`.
   *
   * Why overall, not historicalStrength (the v1.3 axis): placement-tier tracks
   * roster overall worldwide (elite teams ARE high-overall) but NOT in the
   * compressed SAM pool — there the "strong" teams averaged LOWER overall than the
   * "solid" ones and there is no elite tier, so the tilt did nothing regionally.
   * Overall is the metric the tilt actually cares about, and it self-adapts to any
   * pool. See DESIGN-DECISIONS #76.
   *
   * `regionTierBias` is a FIRMER nudge for region-locked pools (SAM): that pool is
   * bottom-heavy (most teams are low-overall), so it needs more push to surface its
   * few good rosters as often as the worldwide tilt does. Mode-gated: NEVER the
   * daily (byte-identical seed); classic/quick only. Never filters the pool, so the
   * hard rule "difficulty never shapes the draft" holds.
   */
  tierBias: 0.35,
  regionTierBias: 0.6,
  draftWeight: { min: 0.7, max: 2.0 },
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
   * v1.4 rarity rework — ABSOLUTE per-rarity appearance rates.
   *
   * `rarityChance[r]` is the chance a given offer card shows a special of rarity
   * `r`, at the baseline rank (mult 1.0). Each rarity the person OWNS is rolled
   * independently, **rarest first**; the first tier to proc supplies the card
   * (chosen uniformly within that tier). This decouples a rarity's appearance
   * rate from how many cards a player has of it — the old model normalised a
   * single weighted pick across the person's pool, so a lone-legendary player
   * (kronovi, m0nkeym00n, violentpanda) showed their legendary EVERY time a
   * special procced (~4%). Now a legendary appears at its own low rate (~1%)
   * regardless of pool size. Calibrated with `scripts/calibrate-rarity.mjs`:
   * the overall special rate stays ~unchanged (~1.6% per offer slot) while
   * legendaries are ~4x rarer. Coaches roll their own pool with the same table.
   */
  rarityChance: {
    rare: 0.045,
    epic: 0.036,
    mythic: 0.03,
    legendary: 0.01,
    // Easter-egg rarities (creator/wings) bypass this — assigned via the rareSpawn
    // path and excluded from normal rolls — so their chance here is nominal only.
    creator: 0.006,
    wings: 0.006,
    // Content-creator cards (v1.4): sit at the RARE tier (same rate), a fun find
    // when their (coach) card is drawn, without flooding the special economy.
    community: 0.045,
  } as Record<string, number>,
  /** Roll order — rarest first. The first tier the person owns that procs wins. */
  rarityOrder: ["creator", "wings", "legendary", "mythic", "epic", "rare", "community"] as const,
  /**
   * Baseline rank special chance (Bronze–Platinum). `specialChanceMult` is
   * `rewards.specialChance / this`, so the common ranks sit at mult 1.0 and the
   * top ranks ramp — v1.4: Diamond ×1.5 / Champion ×2.25 / GC ×3 / SSL ×4. The
   * mult scales every per-rarity rate together.
   */
  rankBaselineChance: 0.04,
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
 * MMR (v1.4 rework) — a COSMETIC "skill rating" parallel to XP, à la Rocket League.
 * Starts at `start` (1000), rises ONLY on a real tournament TITLE (or a Legacy grand
 * final), never spent or lost (cloud merge takes MAX). Surfaces on the profile card,
 * the results screen, and as the headline leaderboard category. Does NOT touch gameplay.
 *
 * PHILOSOPHY (v1.4): MMR is hard to earn and reads like a badge of real achievement.
 *   - WINS ONLY. A mediocre run is worth nothing; only a championship moves the bar,
 *     and only by a few points. The flat per-title `award` table below is the WHOLE
 *     economy — no placement curve, no per-Swiss-win, no difficulty multiplier, no
 *     regional bonus. Easy is a token +1 and Normal +2; the prestige sits in Hard (+5),
 *     the Legacy grand final (+4) and the Legacy title (+9). (Re-tuned v1.4.4.)
 *   - Live gains are LINEAR and tiny, so climbing well past 1500 takes a real grind.
 *   - BACKFILL is capped at `backfillCap` (1600): the retroactive value for a profile
 *     created before this rework is a SATURATING curve of its title history, so the best
 *     current players land NEAR 1600 (never above) and a fresh/mediocre account stays at
 *     ~`start`. Above the elite band is only reachable by playing forward. `backfillScale`
 *     (K) is
 *     the single tuning knob — smaller K pushes histories toward the cap faster.
 *
 * Daily counts (it's a real tournament + a title); Challenge mode never reaches the MMR
 * path (it grants XP via `completeChallenge`, no placement), so it stays 0 — by design.
 */
export const MMR = {
  /** Everyone starts here. ~1500 is the elite band; above it is a forward-play grind. */
  start: 1000,
  /** Retroactive (backfill) values are clamped here — nobody is seeded above 1600. */
  backfillCap: 1600,
  /** Saturation constant for the backfill curve (K). Lower = histories approach the cap
   *  faster. K=120 puts raw 100→~1339, 200→~1487, 300→~1551, 500→~1591 (cap 1600). */
  backfillScale: 120,
  /** Flat MMR per QUALIFYING outcome. Everything not listed here is worth 0.
   *  Re-tuned v1.4.4 (Hard now reads as real prestige; Normal a small step up). */
  award: {
    easyTitle: 1,
    normalTitle: 2,
    hardTitle: 5,
    legacyFinalist: 4, // Legacy grand finalist (runner-up)
    legacyTitle: 9,
  },
} as const;

/** Flat MMR a finished run is worth (v1.4): wins only, by difficulty; Legacy also
 *  credits the grand finalist. Every other placement/outcome is worth 0. */
export function mmrRawGain(difficulty: Difficulty, placement: Placement): number {
  if (placement === "champion") {
    if (difficulty === "legacy") return MMR.award.legacyTitle;
    if (difficulty === "hard") return MMR.award.hardTitle;
    if (difficulty === "normal") return MMR.award.normalTitle;
    if (difficulty === "easy") return MMR.award.easyTitle;
  }
  if (placement === "runner_up" && difficulty === "legacy") return MMR.award.legacyFinalist;
  return 0;
}

/** MMR total after one finished run — a plain, linear add of the flat award (no damping,
 *  no cap on live play, so a determined grinder can climb past 1500 slowly). */
export function mmrAfterRun(mmr: number, difficulty: Difficulty, placement: Placement): number {
  return mmr + mmrRawGain(difficulty, placement);
}

/**
 * Retroactive MMR from a profile's aggregate title history (`wins` per difficulty), for
 * accounts created before this rework or a fresh device. We only have champion counts
 * (no per-difficulty runner-up counter), so Legacy grand finals are not reconstructable
 * here — a small, accepted undercount. The summed raw value is mapped through a
 * SATURATING curve and CLAMPED at `backfillCap` (1500): elite histories cluster just
 * under 1500, a no-title account stays at `start`. Monotone in the counts; no reset of
 * ranks/achievements needed.
 */
export function mmrBackfillFloor(wins: Record<Difficulty, number>): number {
  const raw =
    wins.easy * MMR.award.easyTitle +
    wins.normal * MMR.award.normalTitle +
    wins.hard * MMR.award.hardTitle +
    wins.legacy * MMR.award.legacyTitle;
  const span = MMR.backfillCap - MMR.start;
  return Math.min(
    MMR.backfillCap,
    Math.round(MMR.start + span * (1 - Math.exp(-raw / MMR.backfillScale))),
  );
}

/**
 * Rank ladder (v0.3 curve). Target: Supersonic Legend in ~100-150 runs.
 * An average run earns ~150-300 XP, a winning run ~500-800.
 */
export const RANKS = [
  { id: "unranked", label: "Unranked", minXp: 0 },
  // Bronze stays at 200 so even a losing first run clears the Unranked on-ramp and
  // opens the Collection immediately. v1.3.5: the rest of the ladder is stretched
  // (SSL 50k → 60k, mid-ranks redistributed) for a longer, steadier endgame climb
  // with progressively larger gaps.
  { id: "bronze", label: "Bronze", minXp: 200 },
  { id: "silver", label: "Silver", minXp: 1500 },
  { id: "gold", label: "Gold", minXp: 4000 },
  { id: "platinum", label: "Platinum", minXp: 8500 },
  { id: "diamond", label: "Diamond", minXp: 15000 },
  { id: "champion", label: "Champion", minXp: 24000 },
  { id: "grand-champion", label: "Grand Champion", minXp: 38000 },
  { id: "supersonic-legend", label: "Supersonic Legend", minXp: 60000 },
] as const;

/**
 * Rank-gated rewards (v1.3) — progression now UNLOCKS content, giving the ladder
 * real stakes:
 *  · `rarities`  — special-card rarities that can appear in YOUR draft (and thus
 *    your collection). Lower ranks unlock tiers in turn; Diamond+ have them all.
 *  · `specialChance` — the player's special-appearance chance per offer card. The
 *    chase quickens at the very top (Champion 8% / GC 12% / SSL 16%).
 *  · `collection` — whether the Collection screen is open.
 *  · `hardMode` — kept for structure but ALWAYS true (v1.3.2): gating Hard behind a
 *    rank broke the experience in playtest, so every difficulty is open from the
 *    start (Legacy still needs a Hard win, as always).
 * NEVER touches opponents, the draft POOL, or the daily — only the player's
 * own special-card rewards and Collection access.
 */
export const RANK_REWARDS: Record<
  string,
  { rarities: string[]; specialChance: number; collection: boolean; hardMode: boolean }
> = {
  // Each rank Bronze→Platinum unlocks ONE new VISIBLE rarity (rare→epic→mythic→legendary);
  // from Diamond on, nothing new unlocks but the appearance chance RAMPS (v1.4 retune:
  // legendary moved Diamond→Platinum, ramp now starts at Diamond, not Champion).
  // `creator` is the SECRET easter-egg card (the dev card): eligible from Bronze at its
  // own tiny rate, but never surfaced as an "unlocks at" message (the Collection's rarity
  // grid omits it), so it just rarely turns up. Unranked unlocks nothing.
  // `community` (content-creator cards) rides alongside `creator`: eligible from
  // Bronze at its own rate so the creator nods can turn up for everyone (v1.4).
  unranked: { rarities: [], specialChance: 0, collection: false, hardMode: true },
  bronze: { rarities: ["rare", "creator", "wings", "community"], specialChance: 0.04, collection: true, hardMode: true },
  silver: { rarities: ["rare", "epic", "creator", "wings", "community"], specialChance: 0.04, collection: true, hardMode: true },
  gold: { rarities: ["rare", "epic", "mythic", "creator", "wings", "community"], specialChance: 0.04, collection: true, hardMode: true },
  platinum: { rarities: ["rare", "epic", "mythic", "legendary", "creator", "wings", "community"], specialChance: 0.04, collection: true, hardMode: true },
  diamond: { rarities: ["rare", "epic", "mythic", "legendary", "creator", "wings", "community"], specialChance: 0.06, collection: true, hardMode: true },
  champion: { rarities: ["rare", "epic", "mythic", "legendary", "creator", "wings", "community"], specialChance: 0.09, collection: true, hardMode: true },
  "grand-champion": { rarities: ["rare", "epic", "mythic", "legendary", "creator", "wings", "community"], specialChance: 0.12, collection: true, hardMode: true },
  "supersonic-legend": { rarities: ["rare", "epic", "mythic", "legendary", "creator", "wings", "community"], specialChance: 0.16, collection: true, hardMode: true },
};

export const HISTORY_LIMIT = 25;

/**
 * Challenges (v1.4). Authored puzzles play a constrained draft then a single Bo7
 * vs a fixed boss.
 *
 * Rerolls now scale with the challenge's sim DIFFICULTY (v1.4 retune): the easier
 * tiers are forgiving (assemble freely), the brutal ones make every pick count.
 * The per-challenge `sim.opponentShift` boss handicap is the other knob that keeps
 * each authored seed winnable. The named tiers map onto the game's difficulty enum:
 *   very-easy → easy (8), normal → normal (5), hard → hard (3), very-hard → legacy (0).
 */
export const CHALLENGE = {
  rerollsByDifficulty: { easy: 8, normal: 5, hard: 3, legacy: 0 } as Record<Difficulty, number>,
} as const;

// ===========================================================================
// ROAD TO WORLDS (v1.5) — career-mode tunables.
// Design source: docs/ROAD-TO-WORLDS-DESIGN.md. Every number here is an
// initial value; the career pacing harness owns the final calibration.
// All groups are consumed ONLY by src/engine/career/* + careerStore — nothing
// below touches the existing modes.
// ===========================================================================

/**
 * The historical timeline: seasonIndex 0..5. Infinite era clones the last entry.
 * `startDate` is the season's day 1 (always a MONDAY — the day grid depends on
 * it); the v0.2 day clock derives every calendar date from it.
 */
export const CAREER_SEASONS = [
  { seasonId: "rlcs-x", label: "RLCS Season X", shortLabel: "Season X", year: "2020-21", order: 10, startDate: "2020-10-05" },
  { seasonId: "rlcs-2021-22", label: "RLCS 2021-22", shortLabel: "2021-22", year: "2021-22", order: 11, startDate: "2021-10-11" },
  { seasonId: "rlcs-2022-23", label: "RLCS 2022-23", shortLabel: "2022-23", year: "2022-23", order: 12, startDate: "2022-10-10" },
  { seasonId: "rlcs-2024", label: "RLCS 2024", shortLabel: "2024", year: "2024", order: 13, startDate: "2024-01-08" },
  { seasonId: "rlcs-2025", label: "RLCS 2025", shortLabel: "2025", year: "2025", order: 14, startDate: "2025-01-06" },
  { seasonId: "rlcs-2026", label: "RLCS 2026", shortLabel: "2026", year: "2026", order: 15, startDate: "2026-01-05" },
] as const;

/**
 * Season shape: 32 weeks — W1-2 preseason (window), 3 × [8-week split:
 * open, R1, open, R2, open, R3, open, Major] with 2-week windows after
 * splits 1 & 2, then the 1-week Worlds window (W31) and Worlds (W32).
 *
 * v0.2 DAY CLOCK: the playable clock is the DAY (1..weeksPerSeason×7,
 * Monday-start weeks). The week grid above stays the scheduling skeleton —
 * seed streams and event ids remain week-keyed — but the player advances one
 * day at a time: weekly world processing lands on Mondays, training runs
 * Mon-Fri, official/unofficial events resolve on `eventDayOfWeek` (Saturday),
 * Sunday rests.
 */
export const CAREER_CALENDAR = {
  weeksPerSeason: 32,
  preseasonWeeks: 2,
  splitWeeks: 8,
  windowWeeks: 2,
  /** Regionals land on the 2nd/4th/6th week of a split; the Major on the 8th. */
  regionalOffsets: [2, 4, 6],
  majorOffset: 8,
  worldsWindowWeek: 31,
  worldsWeek: 32,
  /** Training-efficiency bonus on a week spent without an event ("Training Week"). */
  trainingWeekBonus: 0.25,
  /** Day grid: 7-day weeks starting Monday; events play on Saturday (dow 6). */
  daysPerWeek: 7,
  eventDayOfWeek: 6,
} as const;

/** Placement → Season Points (regionals; Majors pay ×2; Worlds pays none). */
export const CAREER_POINTS = {
  regional: {
    champion: 400, runner_up: 320, third: 260, fourth: 210,
    top4: 210, top6: 160, top8: 120, swiss_exit: 60,
  } as Record<string, number>,
  majorMultiplier: 2,
} as const;

/** Major/Worlds slots per region (sums to 16 — the engine field size). */
export const CAREER_SLOTS = {
  major: { NA: 4, EU: 4, SAM: 2, MENA: 2, OCE: 2, APAC: 1, SSA: 1 } as Record<string, number>,
  worlds: { NA: 4, EU: 4, SAM: 2, MENA: 2, OCE: 2, APAC: 1, SSA: 1 } as Record<string, number>,
} as const;

/**
 * Prize tables (in-game USD, "close to real, simplified"). 16-team events pay
 * every placement; 9-16th flat. 8-team single-elim uses the `single8` shape.
 */
export const CAREER_PRIZES = {
  pools: { t3: 2_000, t2: 10_000, regional: 40_000, major: 150_000, worlds: 600_000 },
  /**
   * v0.3: pools grow ×this^seasonIndex (esports money arrives as the scene
   * matures) — the income-side counterweight to salary inflation 1.08^N.
   */
  growthPerSeason: 1.12,
  /** Percent per placement for swiss16 events (champion → swiss_exit-flat ×8). */
  swiss16Pct: {
    champion: 30, runner_up: 20, third: 13, fourth: 10,
    top6: 6.5, top8: 4, swiss_exit: 1,
  } as Record<string, number>,
  single8Pct: { champion: 40, runner_up: 22, top4: 11, top8: 4 } as Record<string, number>,
} as const;

/** Unofficial tournaments (t3 Community Cup · t2 Invitational; t1 LAN = v1.1). */
export const CAREER_UNOFFICIAL = {
  t3RatingBand: 4,
  /** t3 offers stop above this team rating ("outgrown the community circuit"). */
  t3RatingCeiling: 85,
  t3MaxEntriesPerSplit: 2,
  t3RepCapPerSplit: 2,
  t2RepGate: 30,
  t2OfferChance: 0.6,
  /** Auto-enter only fields whose median is within ± this of the user rating. */
  autoEnterBand: 3,
} as const;

/** Roster Stability (the 2/3 rule, tiered): counted on FIELDED new faces per split. */
export const CAREER_STABILITY = {
  freeNewFaces: 1,
  secondFacePenaltyPct: 25,
  thirdFacePenaltyPct: 60,
  preseasonExempt: true,
} as const;

/**
 * Career chemistry (v0.1 adjustment): chemistry is EARNED over time together,
 * not granted. A brand-new squad starts near the floor (heritage only); a core
 * kept 2+ splits together climbs to High. Per pair: connection (time together)
 * + heritage (country/region). Swapping a starter drops it (the new pair has 0
 * tenure). Replaces the leaky "same career org" chemistry for the user team.
 */
export const CAREER_CHEMISTRY = {
  connPerSplitTogether: 2.0,
  connMaxPerPair: 4.0,
  herCountry: 2.5,
  herRegion: 1.5,
  /** Per-pair denominator (≤ conn cap + country makes Perfect reachable). */
  maxRawPerPair: 6.0,
  /**
   * v0.2 swap softening: a newcomer's pairs inherit partial tenure from the
   * incumbent core (an established structure absorbs one new face). Pair
   * tenure = max(actual, incumbent-avg-tenure × this). Swapping a starter now
   * dents chemistry (~85% → ~60%) instead of halving it.
   */
  newcomerGraceFactor: 0.35,
} as const;

/**
 * Scrims (v0.2 day clock): optional weekday blocks between events. A scrim
 * simulates one Bo5 vs a nearby-strength org from the user's region — small
 * chemistry credit + light match XP. No money, no points; capped per week.
 */
export const CAREER_SCRIM = {
  maxPerWeek: 2,
  /** splitsTogether credit per scrim (chemistry accrual convention). */
  chemistryCredit: 0.05,
  /** Match-XP weeks granted, before the field-quality ramp of the opponent. */
  xpWeeks: 0.5,
  /** Opponent pick: closest orgs by rating within this band, seeded. */
  ratingBand: 6,
  /** v0.3 scheduling: opponent shortlist size on the Training screen. */
  shortlistSize: 6,
  /** How many days ahead a scrim can be booked (within the season). */
  scheduleHorizonDays: 14,
} as const;

/**
 * v0.3 salary negotiation (supersedes §21.4's fixed-ask-only market): every
 * player carries a hidden, deterministic reserve factor in
 * [reserveFloor, 1] × ask per (player, season, window). Counter-offers below
 * the reserve are rejected and HARDEN the player (+hardenPerReject on the
 * reserve, telegraphed); after maxRejects only the full ask signs this
 * window. The accept-chance readout shown in the UI is the true uniform CDF —
 * legible risk, no save-scum (the reserve is fixed per window).
 */
export const CAREER_NEGOTIATION = {
  reserveFloor: 0.88,
  hardenPerReject: 0.04,
  maxRejects: 2,
  /** UI floor for the counter-offer stepper (below this is auto-insulting). */
  minOfferFactor: 0.85,
} as const;

/** Player derivation (ages are RL-realistic: debut 13-15, careers end ~24-25). */
export const CAREER_DEV = {
  attrOffsetCap: 6,
  potentialJitter: [-1, 2] as const,
  endedCareerHeadroom: 2,
  peakAgeRange: [18, 22] as const,
  debutAgeWeights: { 13: 0.1, 14: 0.2, 15: 0.3, 16: 0.25, 17: 0.15 } as Record<number, number>,
  archetypeWeights: {
    allround: 0.3, mechanical: 0.18, playmaker: 0.16,
    anchor: 0.14, icecold: 0.11, veteranmind: 0.11,
  } as Record<string, number>,
} as const;

export const CAREER_TRAINING = {
  /** v0.3 pacing pass: 0.1 → 0.13 (players read as stagnant at 0.1). */
  weeklyBase: 0.13,
  /**
   * v0.3: 4 → 2.5 — the h/(h+K) collapse near potential was the visible
   * "stagnation": at K=4 a player 2 pts short trained at 1/3 speed forever.
   */
  headroomSoftK: 2.5,
  /** coachMult = clamp(1 + (coachOVR - 75) × perPoint, min, max); no coach = min. */
  coachMult: { perPoint: 0.01, min: 0.85, max: 1.2 },
  /** Training days per week (Mon-Fri); the daily tick is weeklyBase ÷ this. */
  trainingDaysPerWeek: 5,
  /**
   * v0.3: committed-event weeks train at this share instead of freezing —
   * playing weak unofficials must never be a development trap.
   */
  matchPrepShare: 0.5,
  /**
   * v0.2 focus rebalance (design: balanced must not dominate). Shares of the
   * base overall rate per focus mode: single-attribute focus now grows overall
   * at 0.9 AND its attribute offset (a real specialize-vs-grow tradeoff);
   * auto with a coach is near-optimal (that's what the coach is paid for);
   * auto without a coach falls back to balanced at the no-coach multiplier.
   */
  balancedShare: 1.0,
  autoShare: 0.95,
  focusOffsetPerWeek: 0.35,
  focusOverallShare: 0.9,
  /**
   * Session intensity (per player): heavier training develops faster but adds
   * telegraphed fatigue risk (added to the pre-event unavailability roll).
   */
  intensityMult: { light: 0.6, normal: 1.0, heavy: 1.35 } as Record<string, number>,
  heavyUnavailabilityAdd: 0.01,
  /** Match XP: bonus training weeks = base × fieldQuality (weak → stacked field). */
  matchXpWeeks: 2,
  fieldQualityMin: 0.25,
  fieldQualityMax: 1.5,
  /** Field quality ramps with avg field rating between these anchors. */
  fieldQualityAnchor: [72, 92] as const,
  subXpFactor: 0.7,
  /** v0.3: 6/2.5 → 7/3 — headroom for the faster pacing to breathe. */
  maxSeasonGain: 7,
  maxSplitGain: 3,
} as const;

/** Age curve (young scene): growth to ~20, decline lands at season rollover. */
export const CAREER_AGE = {
  /** v0.3: 21-24 lifted (0.6/0.3 → 0.7/0.35) — veterans trained at ~zero. */
  growthMult: { u16: 1.5, a17_18: 1.25, a19_20: 1.0, a21_22: 0.7, a23_24: 0.35, a25plus: 0.15 },
  declineByAge: { a22: 0.5, a23_24: 1.5, a25_26: 2.0, a27plus: 3.0 },
  declineRateDist: { slow: 0.2, normal: 0.6, fast: 0.2 } as Record<string, number>,
  declineRateMult: { slow: 0.6, normal: 1.0, fast: 1.4 } as Record<string, number>,
  trainingDeclineDampen: 0.7,
  mechanicsDeclineOffset: 0.5,
  expGrowthPerSeason: 0.5,
  /** Retirement roll at rollover, from age 23. Guaranteed-ish by 28. */
  retirementByAge: { 23: 0.05, 24: 0.12, 25: 0.25, 26: 0.4, 27: 0.55, 28: 0.7 } as Record<number, number>,
  retirementStarMult: 0.5,
  retireCoachConvertRate: 0.6,
} as const;

export const CAREER_SCOUT = {
  bandWidthByLevel: { 0: 5, 1: 3, 2: 1, 3: 0 } as Record<number, number>,
  /** Own-squad levels auto-narrow once per completed split (max 3). */
  autoRevealPerSplit: 1,
  reportCost: 2_500,
  /** A paid report caps at L2 — exact potential is earned by playing together. */
  reportMaxLevel: 2,
} as const;

/**
 * v0.2 ECONOMY RESCALE — a brand-new org is a garage org. Start budgets drop
 * ~8×, entry salaries land in the hundreds (steeper growth curve keeps stars
 * expensive), prizes/sponsors/fees rescale in proportion. Progression is the
 * product: money pressure must be real in seasons 1-2.
 */
export const CAREER_ECONOMY = {
  roundQuantum: 50,
  startingBudget: { easy: 20_000, normal: 12_000, hard: 8_000 } as Record<string, number>,
  prizeMult: { easy: 1.15, normal: 1.0, hard: 0.9 } as Record<string, number>,
  salaryAskMult: { easy: 0.9, normal: 1.0, hard: 1.15 } as Record<string, number>,
  sponsorMult: { easy: 1.15, normal: 1.0, hard: 0.9 } as Record<string, number>,
  /** Fanbase trickle per split = reputation × this. */
  passivePerRepPoint: 40,
} as const;

export const CAREER_SALARY = {
  basePerSplit: 1_500,
  growthPerPoint: 1.2,
  anchorOverall: 70,
  minSalary: 250,
  /** Age factors (young scene: primes 19-22 cost the most). */
  ageFactor: { u18: 0.9, a19_22: 1.1, a23_24: 0.9, a25plus: 0.75 },
  potentialPerPoint: 0.02,
  potentialCap: 1.3,
  repComfortBase: 62,
  repComfortSlope: 0.35,
  repPremiumPerPoint: 0.04,
  repPremiumCap: 2.0,
  askJitterPct: 0.08,
  subRoleFactor: 0.4,
  coachFactor: 0.35,
  inflationPerSeason: 1.08,
  /** "Ambitious" renewal premium when player prestige > org rep tier 2+ splits. */
  ambitionRenewalMult: 1.25,
  /** Overall from which a player reads "ambitious" at a sub-tier-3 org. */
  ambitiousOverall: 88,
  blockbusterRefusalRenewalMult: 1.1,
  lengthDiscountPerSeason: 0.95,
} as const;

export const CAREER_CONTRACT = {
  maxSeasons: 3,
  releaseFeeFactor: 0.5,
  /** Exclusive re-sign window for the user's own expiring players: split 3. */
  resignPrioritySplit: 3,
} as const;

export const CAREER_TRANSFER = {
  feePerRemainingSplit: 1.4,
  minFee: 2_500,
  signingBonusPct: 0.15,
  /**
   * v0.3 unified market value: value = salary-curve ask (rep/jitter-neutral)
   * × valueMultiple. EVERY fee derives from it — AI↔AI fee fiction, AI bids
   * for user players, user buys — so same-OVR players stop pricing 6× apart
   * (the old ask × synthetic-splits-remaining formula).
   */
  valueMultiple: 3.2,
  /** AI↔AI fee fiction band around value (news numbers stay plausible). */
  aiFeeBand: [0.85, 1.15] as const,
  /** User buys under-contract: fee = value × (base + perSplit × remaining). */
  contractLoadBase: 0.7,
  contractLoadPerSplit: 0.15,
  /**
   * v0.3 incoming-bid pressure — bids can land on ANY window day:
   * daily chance = base + perStar × |squad OVR ≥ starOverall|
   *              + perProspect × |age ≤ prospectAgeMax && upside ≥ prospectUpside|,
   * capped; at most maxBidsPerWindow per window, bidCooldownDays apart.
   * AI GMs hunt developing prospects too, not only the best player.
   */
  poachDailyBase: 0.055,
  poachPerStar: 0.03,
  poachPerProspect: 0.02,
  poachDailyCap: 0.18,
  starOverall: 82,
  prospectAgeMax: 18,
  prospectUpside: 6,
  maxBidsPerWindow: 2,
  bidCooldownDays: 2,
  /** AI bid fee = marketValue × this band (selling should tempt). */
  aiBidRange: [1.0, 1.35] as const,
  blockbusterFeeMult: 1.5,
} as const;

export const CAREER_SPONSOR = {
  /**
   * v0.2: tiers rescaled to the garage-org economy and each carries PERKS —
   * gear discounts and free bootcamps — so a better sponsor visibly upgrades
   * the org's toolbox, not just the bank line.
   */
  tiers: [
    { tier: 1, repGate: 0, base: 1_500, bonus: 750, objective: "enterEvents", gearDiscountPct: 0, freeBootcampsPerSeason: 0 },
    { tier: 2, repGate: 25, base: 6_000, bonus: 3_000, objective: "regionalTop8", gearDiscountPct: 20, freeBootcampsPerSeason: 0 },
    { tier: 3, repGate: 50, base: 18_000, bonus: 9_000, objective: "majorQualify", gearDiscountPct: 35, freeBootcampsPerSeason: 1 },
    { tier: 4, repGate: 75, base: 45_000, bonus: 25_000, objective: "majorTop4", gearDiscountPct: 50, freeBootcampsPerSeason: 2 },
  ] as const,
  signingBonusSplits: 1,
  /** v0.3: tier base/bonus grow ×this^seasonIndex at offer time (new deals). */
  growthPerSeason: 1.1,
  /** Misses within a deal before the renewal drops one tier. Never clawbacks. */
  patienceMisses: 3,
  enterEventsTarget: 2,
  /**
   * No sponsor offers until the org has earned a little standing (v0.1
   * adjustment: no day-1 sponsorship). A couple of decent results clears this.
   */
  firstOfferRepGate: 12,
} as const;

export const CAREER_REP = {
  start: 5,
  /**
   * v0.3 early floor: modest results now pay a little rep — a swiss exit at a
   * regional and an unofficial final each grant +1 (season 1 can no longer
   * soft-lock at rep 5 with nothing unlockable). t3 gains stay capped per
   * split via t3RepCapPerSplit.
   */
  gains: {
    t3Win: 1, t3Final: 1, t2Win: 2, t2Final: 1,
    regionalSwissExit: 1, regionalTop8: 1, regionalTop4: 2, regionalWin: 4,
    majorQualify: 2, majorTop4: 4, majorWin: 7, worldsQualify: 8, worldsTop4: 10,
  },
  softCapAt: 80,
  softCapFactor: 0.5,
  /** Reputation FALLS on missed telegraphed expectations (v0.1 adjustment). */
  lossMajorMissAtRep: 40,
  lossMajorMiss: 2,
  lossWorldsMissAtRep: 60,
  lossWorldsMiss: 4,
  lossSeasonGoalMiss: 1,
  /** Floor: never below (highest sponsor gate earned − 5). */
  lossFloorSlack: 5,
} as const;

/** Non-gear unlock gates (gear/staff gates live on the CAREER_GEAR ladder). */
export const CAREER_UNLOCKS = {
  t2InvitationalRep: 30,
  relocationRep: 70,
  /** v0.3: hiring a coach is earned early (between peripherals and monitors). */
  coachRep: 10,
  /**
   * v0.3 visible signing gate (Miguel: high-OVR free agents were trivial to
   * land day 1): NEW signings accept only up to
   * cap(rep) = signableCapBase + signableCapPerRep × rep (uncapped from
   * signableCapFreeAt). Renewals and the current squad are always exempt.
   * Locked market rows stay visible with the rep they need.
   */
  signableCapBase: 74,
  signableCapPerRep: 0.3,
  signableCapFreeAt: 84,
} as const;

/**
 * v0.2 GEAR & STAFF LADDER (replaces the generic 3-level facilities). The
 * org's toolbox grows step by step — peripherals → monitors → PCs → simple
 * bootcamp → structured bootcamp → sports psychologist → performance center —
 * each unlocked by reputation and bought (in order) with career money.
 * Effects map onto existing engine channels: trainingBonus feeds the training
 * multiplier, buffLevels feed the org-buff level (cap 3), psychologist keeps
 * the flat stat bonus, bootcamps stay consumables (chemistry + Sharp rating).
 */
export const CAREER_GEAR = {
  /** Permanent installations, purchasable strictly in list order. */
  items: [
    { id: "peripherals", repGate: 8, cost: 1_500, upkeepPerSplit: 0, trainingBonus: 0.05, buffLevels: 0 },
    { id: "monitors", repGate: 14, cost: 4_000, upkeepPerSplit: 0, trainingBonus: 0.05, buffLevels: 0 },
    { id: "pcs", repGate: 20, cost: 10_000, upkeepPerSplit: 250, trainingBonus: 0.1, buffLevels: 1 },
    { id: "perfCenter", repGate: 55, cost: 60_000, upkeepPerSplit: 2_500, trainingBonus: 0.15, buffLevels: 2 },
  ] as const,
  /** Bootcamp tiers (consumable, 1/split): unlock the tier, pay per run. */
  bootcamp: [
    { tier: 1, repGate: 26, cost: 4_000, chemistryCredit: 0.25, sharpRating: 0.5 },
    { tier: 2, repGate: 38, cost: 10_000, chemistryCredit: 0.5, sharpRating: 1.0 },
  ] as const,
  /** Sports psychologist (rolling retainer, the "essa é importante" hire). */
  psychologistRep: 46,
  psychologistPerSplit: 4_000,
  psychologistStatBonus: { clutch: 1, consistency: 1 } as Record<string, number>,
  /** Σ active temporary rating mods ≤ this (stays under the coach cap 2.5). */
  tempRatingMax: 2.0,
} as const;

/** Hireable coaches (v0.2): real retired pros + generated candidates. */
export const CAREER_COACH_MARKET = {
  candidatesPerWindow: 5,
  /** Target share of REAL (retired-pro) names among candidates. */
  realShare: 0.5,
  generatedOverallRange: [62, 84] as const,
  /** Retired-pro coach quality = base + factor × final playing overall. */
  retiredCoachBase: 55,
  retiredCoachFinalOvrFactor: 0.25,
} as const;

export const CAREER_SUB = {
  standInOverall: 60,
  standInFee: 1_000,
  /** Registered subs accrue half a split of chemistry credit per split. */
  chemistryCreditFactor: 0.5,
} as const;

export const CAREER_LOAN = {
  floor: -5_000,
  rescueTo: 3_000,
  repayFactor: 1.2,
  garnishRate: { easy: 0.1, normal: 0.15, hard: 0.2 } as Record<string, number>,
  /**
   * v0.3 debt-lock fix: while the Backer loan is active, HALF of every player
   * sale amortizes the debt (was: prizes only — selling a star did nothing),
   * and the Finances screen can pay any amount down manually at any time.
   */
  saleGarnishRate: 0.5,
} as const;

export const CAREER_WORLD = {
  /** History gravity: chance each anchor move executes (top-3 orgs stronger). */
  anchorFidelity: 0.85,
  anchorFidelityTop: 0.95,
  /** v0.3: 0.25 → 0.35 — the mid-season market was too quiet. */
  midWindowMoveRate: 0.35,
  /**
   * v0.3 living market: share of needs-pass moves where the org SHOPS another
   * org's player (fee trade, one displacement level) instead of signing a
   * free agent — mid-season org↔org trades were literally 0%.
   */
  orgBuyChance: 0.4,
  /** Only lower-rated orgs get shopped; buyer must out-rate seller by this. */
  orgBuyRatingEdge: 2,
  /** Like-for-like guard: shopped player ≤ buyer roster average + this. */
  orgBuyMaxAboveAvg: 6,
  /**
   * v0.3 scavenger pass: chance per window Monday that an org picks up a
   * displaced FA clearly better than its weakest starter (good players were
   * rotting in the FA pool forever).
   */
  scavengerChance: 0.5,
  scavengerMinEdge: 3,
  walletByPrestige: [250_000, 600_000, 1_200_000, 2_500_000] as const,
  spendCapPctPerWindow: 0.6,
  /** Filler world: min AI orgs per region (user fills slot 16 at home). */
  minOrgsPerRegion: 16,
  fillerOverallRange: [64, 80] as const,
  /** v0.3: 0.05 → 0.08 — fictional players deserve real ceilings. */
  fillerWonderkidChance: 0.08,
  /**
   * v0.3 headliners: the FIRST slot of each filler org may roll a stronger
   * base overall — texture at the top of thin regions without flooding the
   * early game with superteams (one per org, chance-gated).
   */
  fillerHeadlinerChance: 0.1,
  fillerHeadlinerRange: [77, 84] as const,
  rookiesPerRegionPerSeason: 8,
  rookieAgeRange: [13, 16] as const,
  rookieOverallRange: [60, 72] as const,
  /** Potential pyramid; the "generational" top tier only rolls in the infinite era. */
  rookiePotentialPyramid: [
    { p: 0.6, range: [73, 80] },
    { p: 0.25, range: [81, 87] },
    { p: 0.12, range: [88, 93] },
    { p: 0.03, range: [94, 99] },
  ] as const,
  datasetEraPotentialCeiling: 88,
  faPoolFloorPerRegion: 10,
  /** Random events: one type in v1 ("starter unavailable"), ≤1 per split. */
  unavailabilityChancePerWeek: 0.02,
  /** The pre-event roll multiplies the weekly chance by this (≈ a month's risk). */
  unavailabilityEventMult: 4,
  unavailabilityMaxPerSplit: 1,
  /** Novice guard: no random events in Split 1 of Season 1. */
  unavailabilityGraceSplits: 1,
} as const;

export const CAREER_NEWS = {
  maxItemsPerTick: 12,
  feedRetention: 250,
  maxToastsPerTick: 2,
} as const;

/**
 * Cosmetic team stars — v0.2 recalibration: 0-5★ in HALF-STAR steps, driven
 * by the org's rating PERCENTILE across the whole live world (so the strong
 * teams always read strong, by construction) plus a small prestige component.
 */
export const CAREER_STARS = {
  maxStars: 5,
  ratingWeight: 0.8,
  prestigeWeight: 0.2,
} as const;

/**
 * Career event playback pacing (ms at 1× speed; divided by the speed factor).
 * Mirrors the classic TournamentScreen PACE table with a career tempo.
 */
export const CAREER_PLAYBACK = {
  userGoalMs: 700,
  userGameGapMs: 650,
  userSeriesLingerMs: 2_400,
  aiSwissMs: 120,
  aiPlayoffMs: 450,
  roundGapMs: 1_300,
  advanceMs: 500,
  speeds: [1, 2, 4] as const,
  /**
   * v0.3 FIFA-style autoplay: ms per auto-advanced day. The autopilot pauses
   * itself at every stop state (matchday, decision, window Monday) and on any
   * user pause — the primary control is now ▶/⏸, "skip to next stop" is the
   * secondary action.
   */
  autoAdvanceDayMs: 850,
} as const;

export const CAREER_SIM = {
  /** Per-frame world-sim budget during multi-week skips before yielding. */
  advanceBudgetMs: 80,
  teamCache: true,
} as const;

export const CAREER_SAVE = {
  maxSlots: 3,
  newsCap: 250,
  mailCap: 80,
  ledgerTailCap: 100,
  eventResultsCap: 60,
  /** v0.3 rings: scrim results + the window transfer report. */
  scrimLogCap: 12,
  transferLogCap: 150,
  maxSaveBytes: 400_000,
} as const;

/** Master pacing anchors — every career harness imports these, none restates them. */
export const CAREER_ARC = {
  firstMajorBySeason2: 0.7,
  firstWorldsBySeason4: 0.6,
  worldsTitleBy2026: { easy: [0.45, 0.7], normal: [0.2, 0.45], hard: [0.08, 0.25] } as Record<
    string,
    [number, number]
  >,
  insolvencyRateMax: { easy: 0.02, normal: 0.1, hard: 0.25 } as Record<string, number>,
} as const;

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
  /**
   * Road to Worlds career mode (v1.5, alpha). ON in dev and tests (NODE_ENV
   * !== "production"), OFF in production builds unless the build sets
   * NEXT_PUBLIC_CAREER_MODE=1 — for local preview builds only, set inline
   * (`NEXT_PUBLIC_CAREER_MODE=1 npm run build`). Never put it in .env* files or
   * in the production Worker's build variables: it would ship the alpha on
   * rocketdraft.app (docs/DEPLOY-CLOUDFLARE.md §5). NODE_ENV is
   * always inlined; NEXT_PUBLIC_CAREER_MODE is inlined when set at build time
   * and otherwise reads as undefined on the client — either way the value is
   * fixed per build.
   * Off → no home card, no nav entry, `/career` layout calls notFound(), and
   * `scripts/postexport.mjs` deletes `out/career*` so the host serves the 404
   * page. `scripts/postexport.mjs` mirrors this expression — keep them in sync.
   */
  careerMode:
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_CAREER_MODE === "1",
  /**
   * Miguel's original hard roster rule (2+ starter swaps in one window zero
   * the Season Points) instead of the shipped tiered Roster Stability. Kept
   * one flag away per the design doc §21.1.
   */
  careerHardStabilityRule: false,
} as const;

// ---------------------------------------------------------------------------
// Cloud sync pacing (accounts). Not a gameplay value — kept here so every
// tunable number lives in one place.
// ---------------------------------------------------------------------------

export const CLOUD_SYNC = {
  /** Quiet period after the last profile change before a signed-in player's
   *  progress is pushed mid-session (coalesces a run's burst of writes —
   *  results, achievements, unlocks — into one read + push). */
  pushDebounceMs: 4500,
} as const;
