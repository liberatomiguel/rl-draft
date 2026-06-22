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
    // v1.3.3 → v1.4 ease (#79). Anchored on faithful blended sims (REAL drafted
    // teams over every lineup, WW + SAM — the methodology matches PostHog: the
    // live total WW-Legacy win rate was ~2-3%, and the sim baseline reproduced it).
    // Miguel's v1.4 target: nudge BOTH the WW and SAM Legacy total win rate toward
    // ~5%. shift 1.65 → 1.35 lifts the elite end most (a 97 dream ~25% → ~29%, the
    // all-time-best 99 higher still) while a 92 stays near zero — the base of the
    // curve stays low. UNLIKE #75 (which PINNED SAM at +4.6 so a WW ease left SAM
    // untouched), v1.4 eases SAM TOO: REGION_LOCK.legacy drops in lockstep so the
    // SAM effective shift falls 4.60 → 3.40. The Bo7 gauntlet is still the hardest
    // mode. See DESIGN-DECISIONS #79.
    opponentRatingShift: 1.35,
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
  //  · legacy 2.05 (v1.4, #79): the SAM effective shift = legacy.opponentRatingShift
  //    (1.35) + this boost = 3.40 (was 4.60). v1.3 PINNED SAM at +4.6 so a WW ease
  //    wouldn't touch it (#75); v1.4 REVERSES that on purpose — Miguel wants SAM
  //    Legacy eased toward ~5% too. Faithful blended sim (real SAM drafts over the
  //    whole SAM pool, avg overall ~83): SAM Legacy total ~1.9% → ~2.9% in-sim at
  //    3.40, projecting higher in live play (the sim weights weak historical teams a
  //    real drafter would pass). Re-check PostHog after deploy. See #79.
  opponentRatingBoost: { easy: 2, normal: 2, hard: 2, legacy: 2.05 } as Record<
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
  rarityChance: { rare: 0.045, epic: 0.036, mythic: 0.03, legendary: 0.01, creator: 0.006 } as Record<
    string,
    number
  >,
  /** Roll order — rarest first. The first tier the person owns that procs wins. */
  rarityOrder: ["creator", "legendary", "mythic", "epic", "rare"] as const,
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
 *     regional bonus. Easy/Normal titles are a token +1; the prestige sits in Hard (+3),
 *     the Legacy grand final (+5) and the Legacy title (+9).
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
  /** Flat MMR per QUALIFYING outcome. Everything not listed here is worth 0. */
  award: {
    easyTitle: 1,
    normalTitle: 1,
    hardTitle: 3,
    legacyFinalist: 5, // Legacy grand finalist (runner-up)
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
  unranked: { rarities: [], specialChance: 0, collection: false, hardMode: true },
  bronze: { rarities: ["rare", "creator"], specialChance: 0.04, collection: true, hardMode: true },
  silver: { rarities: ["rare", "epic", "creator"], specialChance: 0.04, collection: true, hardMode: true },
  gold: { rarities: ["rare", "epic", "mythic", "creator"], specialChance: 0.04, collection: true, hardMode: true },
  platinum: { rarities: ["rare", "epic", "mythic", "legendary", "creator"], specialChance: 0.04, collection: true, hardMode: true },
  diamond: { rarities: ["rare", "epic", "mythic", "legendary", "creator"], specialChance: 0.06, collection: true, hardMode: true },
  champion: { rarities: ["rare", "epic", "mythic", "legendary", "creator"], specialChance: 0.09, collection: true, hardMode: true },
  "grand-champion": { rarities: ["rare", "epic", "mythic", "legendary", "creator"], specialChance: 0.12, collection: true, hardMode: true },
  "supersonic-legend": { rarities: ["rare", "epic", "mythic", "legendary", "creator"], specialChance: 0.16, collection: true, hardMode: true },
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
