/**
 * BALANCE CONFIG — every tunable number in the game lives here.
 *
 * Designers: edit values, run `npm run test` (the sanity suite asserts the
 * design targets from the base document still hold), then playtest.
 * See docs/BALANCE-GUIDE.md for what each knob does and its safe range.
 */

import type { BuffLevel, Difficulty, HistoricalStrength, Placement, Region } from "@/engine/types";

/**
 * OBS-01 (DESIGN-DECISIONS #145): the tuning generation of this file, sent as
 * `balanceVersion` with every analytics event so data splits across retunes
 * inside one release. HAND-BUMPED: any commit that changes a value (or a
 * function) exported here adds 1. `balanceVersion.test.ts` holds a fingerprint
 * of every export except FEATURES and fails until the bump is made.
 */
export const BALANCE_VERSION = 3;

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
    // rc.25 (#140): -1.3 → -1.05 — the v2.0 pool made typical Normal play a little
    // easier (live-calibrated model: 36.3% vs the live 34.5%); this restores it.
    opponentRatingShift: -1.05,
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
    // rc.25 (#140): -0.7 → -0.5 restores the live rates on the v2.0 pool — typical
    // play 22% (live 22.3%) and runs reset 12+ times 54% (live 54.3%).
    opponentRatingShift: -0.5,
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
    // rc.25 (#140): 1.3 → 1.6. The v2.0 pool raised the ceiling (97-98 mythics,
    // national teams at 95-96): a run reset 12+ times won 16% (live: 12.3%) while
    // typical play stayed near the live 4.1%. Miguel's rule — Legacy must not get
    // easy for players who reset until a good run — caps grinders back at the live
    // level; typical Legacy lands ≈3%. 1.3 keeps typical ≈3.7% if he prefers.
    opponentRatingShift: 1.6,
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
  // v2.0 (#136 → #140): the boost is per REGION × difficulty — every region's pool
  // has its own ceiling, depth and Legacy field — read it through
  // regionOpponentBoost(). rc.25 calibrates on LIVE play: a reset model fitted so
  // `main` worldwide reproduces PostHog (Oct 13–26: Easy 64.6 · Normal 34.5 ·
  // Hard 22.3 · Legacy 4.1 % win rate; players reset ≈0.6× per finished run on
  // Easy, ≈2× on Normal/Hard/Legacy). Rule, the same for every pool (worldwide
  // too): typical play wins as often as live worldwide, and on Hard/Legacy a run
  // reset 12+ times never wins more often than it does live (Hard ≈54 %, Legacy
  // ≈12 %) — the stricter of the two sets the value. Fitted from a 4-point sweep
  // per cell (`difficulty.matrix.test.ts`, SIM_RESET_SET). Effects: SAM Easy and
  // Normal are no longer harder than worldwide (live SAM Easy ≈30 %), the old
  // Normal-harder-than-Hard inversion is gone (Hard zeroes the AI's chemistry),
  // and OCE/MENA Legacy no longer reward grinding (OCE grinders won ≈32 %).
  // A negative value lets the regional field play below its nominal rating.
  opponentRatingBoost: {
    SAM: { easy: -1.85, normal: -0.35, hard: 1.45, legacy: 3.95 },
    EU: { easy: -0.05, normal: 0.45, hard: 0.9, legacy: 1.5 },
    NA: { easy: 0.4, normal: 1.15, hard: 2.55, legacy: 2.15 },
    MENA: { easy: -0.55, normal: 1.45, hard: 2.9, legacy: 4.05 },
    OCE: { easy: 0.25, normal: 1.35, hard: 3.5, legacy: 5.35 },
  } as Partial<Record<Region, Record<Difficulty, number>>>,
  /**
   * Regions that offer a Region-only mode (v2.0; SAM only before). APAC and SSA
   * stay "Coming soon" — too few rosters for a 16-team regional event — and their
   * region-only rosters stay dormant until they open (#138).
   */
  regions: ["NA", "EU", "SAM", "MENA", "OCE"] as readonly Region[],
} as const;

/** Region-only opponent boost for a run (0 when the region has no mode). */
export function regionOpponentBoost(region: Region, difficulty: Difficulty): number {
  return REGION_LOCK.opponentRatingBoost[region]?.[difficulty] ?? 0;
}

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
  /**
   * National teams (v2.0, FIFAe lineups): never in the normal draw — injected
   * into one offer at this per-offer chance, classic/quick only (never the daily
   * or a challenge). 2.5% ≈ one national team every ~6 classic runs (~7-8 offers
   * a run) and ~10 quick runs: rare, but findable — 2.5× the Wings egg, which
   * stays the true secret. Worldwide runs draw from the national teams that are
   * not region-only; a Region-only run from its own region's.
   */
  nationalTeamChance: 0.025,
  /**
   * Which national team shows: uniform, except that a team whose cards the
   * player has NOT collected yet weighs this much more — a full album (32 teams)
   * stays reachable without making the next find predictable.
   */
  nationalUndiscoveredWeight: 3,
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
    // National cards are never rolled: they show only on a national lineup,
    // drawn at DRAFT.nationalTeamChance — nominal 0 here.
    national: 0,
  } as Record<string, number>,
  /** Roll order — rarest first. The first tier the person owns that procs wins. */
  rarityOrder: ["creator", "wings", "legendary", "mythic", "epic", "rare", "community"] as const,
  /**
   * National-team cards (v2.0) — derived for every card of a national lineup
   * (@/data). The card keeps the national roster's overall (+ overallDelta) and
   * carries one shared buff: +teamBoost to every team attribute (the shirt).
   * ~0.1-0.2 rating — the card's real value is its overall and its rarity.
   */
  national: {
    overallDelta: 0,
    teamBoost: 2,
  },
  /**
   * Baseline rank special chance (Bronze–Platinum). `specialChanceMult` is
   * `rewards.specialChance / this`, so the common ranks sit at mult 1.0 and the
   * top ranks ramp — v1.4: Diamond ×1.5 / Champion ×2.25 / GC ×3 / SSL ×4. The
   * mult scales every per-rarity rate together.
   */
  rankBaselineChance: 0.04,
  /**
   * Event-exclusive cards (v2.0, DESIGN-DECISIONS #113). A special card with an
   * `event` window is only ever offered between `from` and `to` (UTC dates,
   * inclusive), at its rarity's normal rate, and it BYPASSES the rank rarity gate
   * (everyone can hunt it). Special Hunt: once the player has finished
   * `huntRuns` runs inside the window (per card; `defaultHuntRuns` when the card
   * does not say), the card's chance is multiplied by `huntMultiplier`.
   */
  event: {
    huntMultiplier: 3,
    defaultHuntRuns: 6,
  },
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
  /**
   * v2.0 (DESIGN-DECISIONS #117 / career R28): offense and defense now weigh
   * on EVERY game (they were cosmetic): score += w × norm(stat). Capped by
   * norm's ±1.2 so overall stays dominant (balance anchors re-verified).
   */
  offenseWeight: 0.5,
  defenseWeight: 0.5,
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
  /**
   * Momentum (v2.0, DESIGN-DECISIONS #114): the side that LOST the previous game
   * of the series gets this bounce in the next game. Series between similar teams
   * alternate more (fewer 4–0 sweeps, real comebacks); a clear favourite still
   * sweeps often because the bounce is small next to a 3+ rating edge. The §25
   * anchors (+2 → 62–72 %, +6 ≥ 90 %, +12 ≥ 98 %) still hold (balance.test.ts).
   */
  momentumBounce: 1.5,
  /** A win after trailing by this many games is flagged `comeback` (narration). */
  comebackDeficit: 2,
  /**
   * Scoreline flavour (v2.0). Goals are narrative only (series logic uses game
   * winners). v1 produced 7–0s whenever the rating gap was big, and the same
   * score four games running; the re-tune keeps blowouts possible but rare and
   * spreads the totals.
   */
  goals: {
    winnerBase: 1.3,
    winnerPerMargin: 0.35,
    winnerSpread: 2.2,
    loserPerMargin: 0.3,
    loserSpread: 1.3,
    max: 7,
  },
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
 * SEASON RATING (v2.0, DESIGN-DECISIONS #111) — the competitive number behind the
 * Season leaderboard. It REPLACES the title-only MMR economy above for live play
 * (`MMR` stays for the pre-season backfill in old-save migrations). The profile
 * field is still called `mmr` so every reader keeps working; the season reset puts
 * everyone at `start`.
 *
 * PHILOSOPHY: results, not volume. Every finished tournament run moves the rating by
 * a placement × difficulty delta: titles pay well, a deep run pays a little, and an
 * early exit at the higher difficulties COSTS a few points (floor `floor`), so spamming
 * runs with bad results does not climb. The first `placementRuns` runs of a season
 * never lose rating (a soft landing after the reset). Daily and Quick scale by
 * `modeMultiplier`; hidden overalls add `hiddenOverallBonus` to GAINS only.
 * Challenge runs and Road to Worlds never touch it (Season XP only).
 */
export const SEASON_RATING = {
  /** Everyone starts each season here (the reset value). */
  start: 400,
  /** Rating never drops below this. */
  floor: 0,
  /** Runs of a season during which a negative delta is clamped to 0. */
  placementRuns: 5,
  /** Placement deltas per difficulty. `playoffs` = top 8/6/4 exits (made the bracket). */
  delta: {
    easy: { champion: 6, runner_up: 3, third: 2, fourth: 1, playoffs: 0, swiss_exit: -2 },
    normal: { champion: 10, runner_up: 5, third: 3, fourth: 2, playoffs: 0, swiss_exit: -3 },
    hard: { champion: 16, runner_up: 9, third: 5, fourth: 3, playoffs: 1, swiss_exit: -4 },
    legacy: { champion: 26, runner_up: 14, third: 8, fourth: 5, playoffs: 2, swiss_exit: -5 },
  } as Record<
    Difficulty,
    Record<"champion" | "runner_up" | "third" | "fourth" | "playoffs" | "swiss_exit", number>
  >,
  /** Per game mode. Quick is a short single-elim; Daily is the shared puzzle. */
  modeMultiplier: { classic: 1, quick: 0.5, daily: 1.25 } as Record<string, number>,
  /** Added to positive deltas when the run was played with hidden overalls. */
  hiddenOverallBonus: 0.15,
  /** Entries kept in `season.ratingHistory` (profile rating graph). */
  historyLimit: 40,
} as const;

/** Season Rating delta for one finished run (signed). Pure; see `SEASON_RATING`. */
export function seasonRatingDelta(input: {
  difficulty: Difficulty;
  placement: Placement;
  mode: string;
  hiddenOverall: boolean;
  /** Runs finished in this season BEFORE this one (placement protection). */
  seasonRunsBefore: number;
}): number {
  const row = SEASON_RATING.delta[input.difficulty];
  const bucket =
    input.placement === "champion" ||
    input.placement === "runner_up" ||
    input.placement === "third" ||
    input.placement === "fourth" ||
    input.placement === "swiss_exit"
      ? input.placement
      : "playoffs";
  let delta = row[bucket] * (SEASON_RATING.modeMultiplier[input.mode] ?? 1);
  if (delta > 0 && input.hiddenOverall) delta *= 1 + SEASON_RATING.hiddenOverallBonus;
  if (delta < 0 && input.seasonRunsBefore < SEASON_RATING.placementRuns) delta = 0;
  return Math.round(delta);
}

/** Rating after one run: the signed delta applied with the floor. */
export function seasonRatingAfter(mmr: number, delta: number): number {
  return Math.max(SEASON_RATING.floor, mmr + delta);
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
  /**
   * v2.0 stars. Star 1 (the clear) pays `reward.xp` once; stars 2 and 3 each pay
   * `starXp[tier]` the first time they are earned. Repeating a challenge never
   * re-pays — it is for the missing stars (DESIGN-DECISIONS #116).
   */
  starXp: { common: 40, rare: 70, epic: 110, legend: 160 } as Record<string, number>,
  /** Star-track milestones (cosmetics in src/data/cosmetics.ts read the same counts). */
  starMilestones: [10, 25, 45],
} as const;

/**
 * Missions (v2.0, DESIGN-DECISIONS #112): three daily + three weekly objectives,
 * one per tier, picked deterministically from the date among the missions the
 * player can actually do (rank / unlock gated). Rewards auto-grant on completion;
 * finishing all three of a period pays the bonus. Reference: a run is ~150–300 XP.
 */
export const MISSIONS = {
  daily: {
    xp: { easy: 40, mid: 80, hard: 150 } as Record<"easy" | "mid" | "hard", number>,
    allBonus: 120,
  },
  weekly: {
    xp: { easy: 150, mid: 300, hard: 500 } as Record<"easy" | "mid" | "hard", number>,
    allBonus: 400,
  },
} as const;

/**
 * Daily Quiz — "Guess the Player" (v2.0). One player per UTC day, three attempts,
 * a new clue after every miss. XP by the attempt that solved it; a miss on all
 * three reveals the answer and pays nothing (the mission "play the quiz" still
 * counts). Players need at least `minLineups` lineups to be a fair answer.
 */
export const QUIZ = {
  attempts: 3,
  xpByAttempt: { 1: 120, 2: 80, 3: 50 } as Record<number, number>,
  minLineups: 2,
  /** Daily results kept on the profile (older days are pruned). */
  historyDays: 90,
} as const;

/**
 * Login streak (v2.0; rc.20: the 30-day calendar). The first open of a UTC day
 * counts (no run needed). XP per day grows with the streak up to `perDayMax`;
 * past day 30 the calendar shows complete and the day pays the flat max. A gap
 * resets the streak to 1 but never removes earned rewards: on a new cycle a
 * milestone whose cosmetic is already owned pays its XP bonus instead. The eight
 * milestone days (3 / 5 / 7 / 10 / 14 / 21 / 25 / 30) pay a flat bonus and
 * unlock the cosmetics in `src/data/cosmetics.ts` (login-streak sources); the
 * other 22 days are XP only.
 */
export const LOGIN_STREAK = {
  perDayBase: 25,
  perDayStep: 5,
  perDayMax: 75,
  /** Days in one calendar cycle (the modal's grid). */
  cycleDays: 30,
  milestoneBonus: { 3: 50, 5: 75, 7: 100, 10: 125, 14: 200, 21: 250, 25: 300, 30: 400 } as Record<number, number>,
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
 * Mon-Fri, and the weekend is matchday.
 *
 * v2.0 (R40) THE WEEKEND: Saturday (`eventDayOfWeek`) hosts the unofficial
 * cups, the regional week's qualifier (CAREER_QUALIFIER.dayOfWeek) and the
 * Major/Worlds Swiss stage; Sunday hosts the regional (`regionalDayOfWeek`)
 * and the Major/Worlds playoffs (`playoffsDayOfWeek`, "Championship Sunday").
 * Open weeks keep Sunday as the rest day. Invariants (calendar.test.ts):
 * training days < qualifier day < regional day ≤ 7 and Swiss day <
 * playoffs day ≤ 7.
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
  /** Day grid: 7-day weeks starting Monday (dow 1 = Mon .. 7 = Sun). */
  daysPerWeek: 7,
  /**
   * Saturday — the default matchday: unofficial cups, and the day a Major or
   * Worlds opens (lobby + Swiss stage). `CareerEventDef.day` of those events.
   */
  eventDayOfWeek: 6,
  /** v2.0 (R40): Sunday — the regional (direct 8 + Saturday's qualified 8). */
  regionalDayOfWeek: 7,
  /** v2.0 (R40): Sunday — the Major/Worlds playoffs ("Championship Sunday"). */
  playoffsDayOfWeek: 7,
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
/**
 * v2.0 REGIONAL QUALIFIER (R30, re-timed by R40): every regional week opens
 * with a 16-team Swiss on SATURDAY for everyone outside the split's direct
 * top 8 — the eight non-direct orgs, the user when not direct, and local
 * amateur sides (R23) filling the rest. It is a Swiss stage ONLY (no
 * playoffs, no champion): the eight that reach 3 wins qualify and join the
 * direct 8 at Sunday's regional.
 */
export const CAREER_QUALIFIER = {
  directSlots: 8,
  advanceSlots: 8,
  /** v2.0 (R40): the qualifier's matchday — Saturday of the regional week (the regional is Sunday). */
  dayOfWeek: 6,
} as const;

/**
 * v2.0 WEEKLY INSERTS (R33): a mid-week decision card (Tue–Thu) with two
 * clear options — the rhythm breaker between tournaments.
 */
export const CAREER_INSERTS = {
  /** rc.2: ~1.5 inserts per split (10–11 weeks), not one every third week. */
  chancePerWeek: 0.14,
  /** Weekdays an insert can land on (1 = Monday). */
  days: [2, 3, 4] as const,
  /** Ids seen in the last N inserts are not re-rolled. */
  recentWindow: 4,
} as const;

export const CAREER_PRIZES = {
  pools: { t3: 2_000, t2: 10_000, qualifier: 6_000, regional: 40_000, major: 150_000, worlds: 600_000 },
  /**
   * v0.3: pools grow ×this^seasonIndex (esports money arrives as the scene
   * matures) — the income-side counterweight to salary inflation 1.08^N.
   * Read only in CAREER_ECONOMY.indexMode "rc31" (M1 puts prizes on the one
   * season index).
   */
  growthPerSeason: 1.12,
  /**
   * PROVISIONAL (30/10) — ECONOMY-CONTRACT §6 decision 6, option B (M5):
   * tables that pay exactly the pool. "contract": Swiss-16 28 / 18 / 12 / 9 /
   * 6.5 each 5–6th / 5 each 7–8th / 1.25 each 9–16th and single-elimination
   * 40 / 20 / 10 each 3–4th / 5 each 5–8th — both 100 %, round season-0
   * values ($11.2k … $500 at a regional). The qualifier's swissOnlyPct and
   * every pool are unchanged; lobbies keep showing the paid total (R44).
   * "rc31" restores rc.31's tables (swiss16PctRc31 paid 102 %).
   */
  tables: "contract" as "contract" | "rc31",
  /** Percent per placement for swiss16 events (champion → swiss_exit-flat ×8). */
  swiss16Pct: {
    champion: 28, runner_up: 18, third: 12, fourth: 9,
    top6: 6.5, top8: 5, swiss_exit: 1.25,
  } as Record<string, number>,
  single8Pct: { champion: 40, runner_up: 20, top4: 10, top8: 5 } as Record<string, number>,
  /** rc.31's tables, read when `tables` is "rc31". */
  swiss16PctRc31: {
    champion: 30, runner_up: 20, third: 13, fourth: 10,
    top6: 6.5, top8: 4, swiss_exit: 1,
  } as Record<string, number>,
  single8PctRc31: { champion: 40, runner_up: 22, top4: 11, top8: 4 } as Record<string, number>,
  /**
   * PROVISIONAL (30/10) — ECONOMY-CONTRACT §6 decision 5, option B (M6 lever
   * 2): the players' share of a podium prize — 1st to 4th of a regional, a
   * Major or Worlds (never a qualifier or an unofficial cup) — booked as its
   * own ledger line ("playerShare") right after the prize; the Backer's
   * garnish reads the org's part. rc.31: no share (`enabled: false`).
   */
  playerShare: { enabled: true, regional: 0.2, major: 0.35, worlds: 0.5 },
  /**
   * v2.0 (R40): Swiss-only events (the regional qualifier) pay flat by
   * outcome. rc.29 (CAR-08): the 8 qualified 10% each, the 8 eliminated 2.5%
   * each — exactly the advertised pool at season 0 ($600 / $150 of $6k; the
   * 9% / 3% split paid $5.2k after the $50 rounding). Lobbies show the real
   * paid total (economy.prizePoolPaidFor). Provisional: ECO-01 recalibrates.
   */
  swissOnlyPct: { qualified: 10, eliminated: 2.5 },
} as const;

/** Unofficial tournaments (t3 Community Cup · t2 Invitational; t1 LAN = v1.1). */
export const CAREER_UNOFFICIAL = {
  t3RatingBand: 4,
  /** t3 offers stop above this team rating ("outgrown the community circuit"). */
  t3RatingCeiling: 85,
  t3MaxEntriesPerSplit: 2,
  t3RepCapPerSplit: 2,
  /**
   * v2.0 (R23): a Community Cup fields at most this many orgs rated ABOVE the
   * user team (closest-first); the rest are the closest weaker orgs. Early
   * cups stop being a wall of stronger locals.
   */
  t3MaxStrongerTeams: 2,
  /**
   * v2.0 (R23) local amateur scene: when the region has fewer weaker orgs
   * than the cup needs (every season-0 org out-rates a starter roster), the
   * remaining slots are procedurally generated local teams rated within
   * `localSceneBand` of the user team — the "garage scene" a new org actually
   * plays against. `localScenePool` teams exist per region per season.
   */
  localSceneBand: [-7, 1] as const,
  localScenePool: 8,
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
 * rc.33 (ECO-11, ROAD-TO-WORLDS-DECISIONS — the wage talk): ONE model for a
 * signing and a renewal, two levers — the weekly wage and the prize share
 * (ECO-10, CAREER_PRIZE_SHARE) — with the contract length repricing the ask
 * as before. The player signs any offer worth at least his flexibility × his
 * ask (`contract.negotiationAnswerFor`): the zone is shown, the answer is
 * deterministic (seeded per player and window, so a reload changes nothing),
 * and below the zone his counter is the nearest deal he signs — it only ever
 * moves toward agreement. Replaces v0.3's hidden reserve (0.88–1), the +4 %
 * hardening per refusal and the 0.85 stepper floor: the stepper offered 0 %
 * deals, the odds shown ignored what a refusal had revealed, and a $50
 * per-split step often left the weekly wage shown unchanged.
 */
export const CAREER_NEGOTIATION = {
  /**
   * ECO-11 (rc.33): the lowest share of his ask (in wage value) a player ever
   * signs for; his own flexibility is a seeded draw in [flexFloor, 1], fixed
   * per window and shown as the zone. 0.94: a 3 % saving on average, 6 % at
   * best (rc.32's hidden reserve ran 0.88–1, but a refusal hardened it).
   */
  flexFloor: 0.94,
  /**
   * ECO-11 (rc.33): one press of the wage stepper moves this share of his
   * weekly ask, rounded to the weekly quantum and never under it ($10), so
   * every press moves the wage shown.
   */
  wageStepPct: 0.02,
} as const;

/**
 * rc.33 (ECO-10): the share of a podium prize each contract lets its player
 * keep — asked by the player, shown and negotiable in the offer, the renewal
 * and the contract, booked out of a regional / Major / Worlds top-four prize
 * for each player who played the event (`contract.prizeShareOfPodium`).
 * Replaces M6's fixed team share (20 / 35 / 50 % by tier, rc.32). The master
 * switch stays `CAREER_PRIZES.playerShare.enabled` (false = rc.31, no share
 * at all), and its tier rates are now only the default of a contract signed
 * before rc.33 (÷ `legacySeats`). A star asks a bigger share, so the share
 * stays a snowball brake (contract e2: a dominant season's kept prizes ÷ a
 * three-85 squad's wages ≤ 1.5).
 */
export const CAREER_PRIZE_SHARE = {
  /** ECO-10 (rc.33): the share (percent of a podium prize) a player of `pivotOverall` asks. */
  askAtPivot: 8,
  /** ECO-10 (rc.33): the overall the share ask is anchored at. */
  pivotOverall: 80,
  /** ECO-10 (rc.33): points more (less) per overall point above (below) the pivot — a 70 asks 3 %, an 85 11 %, a 90 13 %. */
  askPerPoint: 0.5,
  /** ECO-10 (rc.33): at this age or younger a player asks `youngDiscount` points less (a prospect sells his upside on the wage). */
  youngAge: 18,
  /** ECO-10 (rc.33): see youngAge. */
  youngDiscount: 1,
  /** ECO-10 (rc.33): no contract keeps less than this share of a podium prize (percent). */
  minPct: 2,
  /** ECO-10 (rc.33): no contract keeps more than this share (percent). */
  maxPct: 18,
  /** ECO-10 (rc.33): the talk can raise the share this many points over his ask… */
  maxAboveAsk: 4,
  /** ECO-10 (rc.33): …and lower it this many points under it (the bound that keeps e2 ≤ 1.5 for a dominant squad). */
  maxBelowAsk: 3,
  /**
   * ECO-10 (rc.33): the exchange rate between the two levers — each share
   * point over his ask lowers the wage he signs for by this share of his
   * asking wage, each point under it raises it (−8 % … +6 % at the bounds).
   * About neutral for a contender's podium money, so the choice is a bet on
   * the team's results.
   */
  wagePerPoint: 0.02,
  /**
   * ECO-10 (rc.33): a contract signed before rc.33 carries no share; it keeps
   * the rc.32 rule — CAREER_PRIZES.playerShare by tier ÷ this many seats for
   * each player who played, so three old deals pay exactly the old team share.
   */
  legacySeats: 3,
} as const;

/** Player derivation (ages are RL-realistic: debut 13-15; careers end 24-29, DEV-02 R48). */
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
  /**
   * DEV-01 (rc.32, R55–R57): the growth contract. The development model a NEW
   * career starts on (stored once on its world, `world.growthModel`): 2 =
   * DEV-01 (individual peaks, potential as the expected peak, no split cap,
   * nested scouting bands, the world growing week by week); 1 = rc.31's
   * model. A save keeps the model it was created with — an rc.31 save stays
   * on 1 for life. Set 1 to start new careers on rc.31's model again.
   */
  growthModel: 2,
  /**
   * DEV-01b: the maturation profile of a generated player — when he reaches
   * his top (`peakAgeOf`). Weighted pick, then an age inside the range.
   */
  maturity: {
    early: { weight: 0.3, peakAge: [18, 20] },
    standard: { weight: 0.45, peakAge: [20, 22] },
    late: { weight: 0.25, peakAge: [22, 24] },
  },
  /**
   * DEV-01b: a REAL player peaks at the age of his best moment (the club card
   * or eligible special his potential comes from), held inside this range —
   * signing him never moves his real peak.
   */
  realPeakAgeRange: [17, 26] as const,
  /** DEV-01b: the maintenance phase — whole years at the top before the decline (weights). */
  plateauYearsWeights: { 1: 0.2, 2: 0.35, 3: 0.3, 4: 0.15 } as Record<number, number>,
  /**
   * DEV-01b: the gradual decline — overall lost per year after the plateau, by
   * whole years past it (last value repeats), × CAREER_AGE.declineRateMult;
   * the user's squad also × CAREER_AGE.trainingDeclineDampen. Applied day by
   * day (no step at the rollover).
   */
  declinePerYear: [0.5, 1.5, 2, 2.5, 3] as const,
  /**
   * DEV-01b: potential is the EXPECTED peak, not a wall — the real peak sits
   * `peakTolerance` points under or over it at most, rolled once per player
   * and career (offset → weight).
   */
  peakTolerance: 2,
  peakOffsetWeights: [
    { offset: -2, weight: 0.1 },
    { offset: -1, weight: 0.2 },
    { offset: 0, weight: 0.4 },
    { offset: 1, weight: 0.2 },
    { offset: 2, weight: 0.1 },
  ] as const,
  /**
   * DEV-01d: the growth pace (points per year) toward the real peak:
   * `paceCurvature` × gap ÷ years left to the peak age (never under
   * `paceMinYears`), never below `paceFloorPerYear` while a gap remains — so
   * it is steep when young, slows near the peak and never stops short of it.
   * Training multipliers (coach, gear, focus, intensity, drill) scale it.
   */
  paceCurvature: 2,
  paceMinYears: 0.5,
  paceFloorPerYear: 0.6,
  /**
   * DEV-01d: training-week equivalents a starter banks in a season (his
   * training days plus the series he plays, ≈ 25 + 20, at the no-coach 0.85)
   * — the unit that turns the yearly pace into a day's or a series' gain, so
   * the default setup runs the base pace (a coach and gear run ahead of it).
   */
  trainingWeeksPerYear: 40,
  /**
   * DEV-01b: a generated player is never promised a peak sooner than his gap
   * needs — peak age ≥ his age + ceil(gap ÷ seasonGainCap) + this slack.
   */
  peakRoomSlackYears: 1,
  /** DEV-01d: the season cap on growth (model 2 has no split cap; rc.31: 3 a split, 7 a season). */
  seasonGainCap: 7,
  /**
   * DEV-01 base growth: match XP per series a player actually plays, in
   * training-week equivalents × field quality. A reserve who does not play
   * keeps his training days (no starter XP; rc.31 paid the registered sub
   * 0.7 of a starter's event XP).
   */
  xpWeeksPerSeries: 0.4,
  /** DEV-01: the AI world's training multiplier for its weekly growth (1 = a default setup). */
  worldTrainingMult: 1,
  /**
   * DEV-01e: a non-wonderkid filler's FIXED potential = his base overall +
   * years to his peak × a rate in this range (rc.31: the current overall + 2,
   * which moved with him every season).
   */
  fillerHeadroomPerYear: [0.8, 2.2] as const,
  /**
   * DEV-01c: the special cards that set a real player's potential — his own
   * (by playerId), at the card's printed overall (no effect, boost or
   * chemistry): real RLCS moments only. National-team cards (a derived boost),
   * the community vote, the Creator and the Wings tributes never count, nor
   * do coach cards. Potential = max(best club card + jitter, best such special).
   */
  potentialSpecialTypes: ["legend", "moment", "worlds_mvp", "season_mvp", "major_mvp"] as readonly string[],
  potentialSpecialRarities: ["rare", "epic", "legendary", "mythic"] as readonly string[],
  /**
   * DEV-01c: only a moment inside the career's own seasons (RLCS X on) counts —
   * a legend card of an earlier era is a peak the career never replays (a
   * 2016 legend still in the 2020 free-agent pool would read 95+ forever).
   */
  potentialSpecialCareerEraOnly: true,
} as const;

export const CAREER_TRAINING = {
  /** v0.3 pacing pass: 0.1 → 0.13 (players read as stagnant at 0.1). */
  weeklyBase: 0.13,
  /**
   * v0.3: 4 → 2.5 — the h/(h+K) collapse near potential was the visible
   * "stagnation": at K=4 a player 2 pts short trained at 1/3 speed forever.
   */
  headroomSoftK: 2.5,
  /**
   * coachMult = clamp(1 + (coachOVR - 75) × perPoint, min, max); no coach = min.
   * v2.0 (R22): 0.01/1.2 → 0.015/1.3 — an 85 coach now reads +15% and a 92
   * coach +25%, so "better coaches, better benefits" is visible on the card.
   */
  coachMult: { perPoint: 0.015, min: 0.85, max: 1.3 },
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
  /**
   * v2.0 WEEKLY DRILL (R27): the one training decision per week. A drill is
   * team-wide — every squad player grows the drill's attribute(s) by
   * drillOffsetPerWeek (on top of any personal focus, inside the offset cap)
   * and overall training runs ×drillOverallMult that week. "Delegate to
   * coach" auto-picks the drill that matches the coach's buff (or rotates).
   */
  drills: [
    { id: "mechanics-lab", attrs: ["mechanics"] },
    { id: "rotations", attrs: ["defense"] },
    { id: "set-plays", attrs: ["offense"] },
    { id: "film-room", attrs: ["consistency", "experience"] },
    { id: "clutch-sets", attrs: ["clutch"] },
  ] as const,
  drillOffsetPerWeek: 0.25,
  drillOverallMult: 1.05,
} as const;

/** Age curve (young scene): growth to ~20, decline lands at season rollover. */
export const CAREER_AGE = {
  /**
   * v0.3: 21-24 lifted (0.6/0.3 → 0.7/0.35) — veterans trained at ~zero.
   * v2.0 (R29): 21+ lifted again (0.8/0.45/0.2) — "sometimes impossible to
   * raise a player" was the journeyman roster at 23-24.
   */
  growthMult: { u16: 1.5, a17_18: 1.25, a19_20: 1.0, a21_22: 0.8, a23_24: 0.45, a25plus: 0.2 },
  declineByAge: { a22: 0.5, a23_24: 1.5, a25_26: 2.0, a27plus: 3.0 },
  declineRateDist: { slow: 0.2, normal: 0.6, fast: 0.2 } as Record<string, number>,
  declineRateMult: { slow: 0.6, normal: 1.0, fast: 1.4 } as Record<string, number>,
  trainingDeclineDampen: 0.7,
  mechanicsDeclineOffset: 0.5,
  expGrowthPerSeason: 0.5,
  /**
   * DEV-02 (ROADMAP Etapa 2, decided 29/10 — R48): the competitive window.
   * Signable and playable from `minCompetitiveAge` (the RLCS minimum). Nobody
   * retires before `retireMinAge` (nor before his peak, `peakAgeOf`), and
   * everyone has retired by the end of `retireMaxAge`.
   */
  minCompetitiveAge: 13,
  retireMinAge: 24,
  retireMaxAge: 29,
  /**
   * DEV-02 (R48): the chance that the season a player plays at this age is
   * his LAST — the user's squad announces it at the rollover into that
   * season (one season ahead, never an abrupt exit); the world retires him at
   * the rollover after it. 29 always ends it (a season at 30 is never
   * played). rc.32: the age clock steps exactly +1 a season
   * (`development.seasonYear` reads the year a season ends: 2020-21 → 2021,
   * 2022-23 → 2023, then 2024 …), so no calendar gap forces it early any
   * more (rc.31's clock jumped 2022 → 2024 and made 28 the last).
   * Was (rc.30): 23 → 5 % … 28+ → 70 % per rollover, with no cap.
   */
  retirementByAge: { 24: 0.1, 25: 0.2, 26: 0.3, 27: 0.45, 28: 0.6, 29: 1 } as Record<number, number>,
  /** Stars linger: their chance is multiplied by this — inside the window only. */
  retirementStarMult: 0.5,
  /**
   * DEV-02 (R48): who counts as a star for retirementStarMult — the bar
   * differs by caller. The user's squad: overall 85 (design §8,
   * contract-pinned). The world: overall 90 (the blue-card bar today, kept as
   * a career number so a Draft rarity retune cannot move the career).
   */
  retirementStarOverallSquad: 85,
  retirementStarOverallWorld: 90,
  /**
   * DEV-02 (R48): share of retiring REAL ex-pros who move into coaching (they
   * feed the coach market); the rest leave the game. Decided per (career,
   * player) from the seed — no save state. Generic players always leave.
   */
  retireCoachConvertRate: 0.6,
} as const;

export const CAREER_SCOUT = {
  /** rc.31's half-widths (the band is twice as wide); rc.32's model-2 band reads them too, and DEV-04 nests inside it. */
  bandWidthByLevel: { 0: 5, 1: 3, 2: 1, 3: 0 } as Record<number, number>,
  /**
   * DEV-04 (rc.33): model 2's band width (max − min) at each report level —
   * at most 5 points wide (Miguel 30/10: 5–6); rc.32 showed 10 / 6 / 2.
   */
  honestWidthByLevel: { 0: 5, 1: 3, 2: 1, 3: 0 } as Record<number, number>,
  /**
   * DEV-04 (rc.33): the band's top sits 0 to this many points above the true
   * potential (a seeded draw per player and level) — never a "99" for a 91
   * (rc.32: up to 10 above).
   */
  bandMaxAbove: 2,
  /**
   * DEV-04 (rc.33): the report level that reveals a player's phase
   * (developing / at his peak / declining); below it the tag reads "?". A
   * founder starts at 1, a signing at the level bought, the squad gains one a
   * split.
   */
  phaseRevealLevel: 1,
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
  /**
   * PROVISIONAL (30/10) — ECONOMY-CONTRACT §6 decision 1, option A (M1): ONE
   * season money index, read through `economy.moneyIndex`. "single": every
   * stream grows ×indexPerSeason^seasonIndex — wages, fees and coach asks,
   * prizes, new sponsor deals, the fanbase, the bank's limits, the minimum
   * fee and salary, the stand-in, scouting, gear (costs and upkeep), the
   * founding partner and the inserts' money. Signed contracts keep their
   * figure. The Backer is sized in weeks of payroll (M4), so it is not
   * indexed again. "rc31" restores rc.31 exactly: wages and fees
   * ×CAREER_SALARY.inflationPerSeason (1.08), prizes
   * ×CAREER_PRIZES.growthPerSeason (1.12), new sponsor deals
   * ×CAREER_SPONSOR.growthPerSeason (1.10), every other amount flat.
   */
  indexMode: "single" as "single" | "rc31",
  indexPerSeason: 1.08,
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
  /**
   * PROVISIONAL (30/10) — ECONOMY-CONTRACT §6 decision 5, option B (M6 lever
   * 1): the comfort level (repComfortBase + repComfortSlope × rep) stops
   * here, so a star always carries a premium — at rep 100 a 90 pays ×1.16
   * and a 95 ×1.36 (P2b). rc.31: no cap (`null`; comfort reached 97 at rep
   * 100, so nobody below 97 paid a premium there).
   */
  repComfortMax: 86 as number | null,
  repPremiumPerPoint: 0.04,
  repPremiumCap: 2.0,
  askJitterPct: 0.08,
  // ECO-03 (R47): `subRoleFactor` 0.4 (the "signed as a sub" discount) is
  // gone — the lineup slot never prices a contract.
  coachFactor: 0.35,
  /** Wage and fee inflation — read only in CAREER_ECONOMY.indexMode "rc31" (M1: the one index). */
  inflationPerSeason: 1.08,
  /** "Ambitious" renewal premium when player prestige > org rep tier 2+ splits. */
  ambitionRenewalMult: 1.25,
  /** Overall from which a player reads "ambitious" at a sub-tier-3 org. */
  ambitiousOverall: 88,
  blockbusterRefusalRenewalMult: 1.1,
  lengthDiscountPerSeason: 0.95,
  /**
   * PROVISIONAL (30/10) — ECONOMY-CONTRACT §6 decision 2, option B (M2,
   * ROAD-TO-WORLDS-DECISIONS R58): renewing a player you already have.
   * "capFloor": ask = min(fresh ask, max(current wage × renewalRaiseCap,
   * fresh ask × renewalMarketFloor)), then the ambition premium and the
   * Blockbuster-refusal surcharge on top; a declining veteran renews at his
   * lower fresh ask. rc.31 priced the plain fresh ask (renewalAskFor):
   * switch back with "fresh" (a refused Blockbuster's surcharge stays — the
   * rc.32 fix of a surcharge that was never applied, R54/R58).
   */
  renewalRule: "capFloor" as "capFloor" | "fresh",
  /** M2, PROVISIONAL (30/10, decision 2-B): the raise cap — a renewal asks at most this × his current wage (contract range 1.3–2.0). */
  renewalRaiseCap: 1.5,
  /** M2, PROVISIONAL (30/10, decision 2-B): the market floor — never under this share of his fresh ask (contract range 0.4–0.65). */
  renewalMarketFloor: 0.5,
} as const;

export const CAREER_CONTRACT = {
  /**
   * ECO-03 (R47): squad slots (R3: three starters + one reserve). A signing
   * that would exceed it names who leaves, in the same operation.
   */
  squadCap: 4,
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
  /**
   * ECO-03b (ROADMAP Etapa 2, decided 29/10 — R47): the career's FIRST
   * transfer window (season 0's preseason window, windowIdx 0 = weeks 1–2 of
   * "Season 1" in the UI) is bid-free for the user's players: no AI bid
   * (`incomingBidForDay`) and no scripted Blockbuster bid (the beat degrade in
   * `processDayArrival`). From the next window on, bids arrive as before. The
   * guard is `market.userBidsBlocked`.
   */
  firstWindowBidFree: true,
  /** AI bid fee = marketValue × this band (selling should tempt). */
  aiBidRange: [1.0, 1.35] as const,
  blockbusterFeeMult: 1.5,
  /**
   * PROVISIONAL (30/10) — ECONOMY-CONTRACT §6 decision 8, option B (M8):
   * "List for sale". A listed player under contract draws one offer from an
   * AI org of his region that would field him, after `listingOfferDays`
   * eligible window days (the window rules apply, the bid-free first window
   * included), at market value × listingOfferRange; accept or decline
   * (declining keeps him), or withdraw the listing. rc.31: no listing
   * (`listingEnabled: false`).
   */
  listingEnabled: true,
  listingOfferRange: [0.9, 1.15] as const,
  listingOfferDays: [1, 3] as const,
  /**
   * PROVISIONAL (30/10) — decision 8-B's replacement signing: a seat sold
   * in a window can be refilled with a free agent for this many days after
   * the window closes (one such late signing per window, so one per split).
   * 0 = none (option C; rc.31 had no late signing).
   */
  lateSigningDays: 7,
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
  /**
   * v0.3: tier base/bonus grow ×this^seasonIndex at offer time (new deals).
   * Read only in CAREER_ECONOMY.indexMode "rc31" (M1: the one index).
   */
  growthPerSeason: 1.1,
  /**
   * PROVISIONAL (30/10) — ECONOMY-CONTRACT §6 decision 3, option A (M3): the
   * founding partner, a day-one tier-0 deal. Base per split = payrollShare ×
   * the founding wage bill (fixed at creation, then on the money index),
   * objective "enter events", no signing bonus. It runs until the first real
   * deal or the end of season index `throughSeasonIndex`, whichever is
   * later — alongside a real deal signed earlier. A save from before rc.32
   * gets it only while still in season index ≤ throughSeasonIndex with no
   * sponsor ever signed, sized on its wage bill at that load. rc.31: none
   * (`enabled: false`).
   */
  founding: { enabled: true, payrollShare: 0.7, throughSeasonIndex: 1 },
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
    /**
     * v2.0 (R30): getting through the qualifier is standing too. R40: the
     * qualifier is Swiss-only (no champion), so `qualifierWin` is gone.
     */
    qualifierAdvance: 1,
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
  /** rc.31's flat Backer line, read when `sizing` is "flat" (×the M1 index there). */
  floor: -5_000,
  rescueTo: 3_000,
  /**
   * PROVISIONAL (30/10) — ECONOMY-CONTRACT §6 decision 4, option B (M4): the
   * Backer in weeks of payroll (`economy.backerLineFor`). The floor is
   * −floorWeeks and the rescue target +rescueToWeeks × the weekly wage bill
   * (squad + coach, never below `weeksBasisMin` × the money index), so the
   * rescue buys the same weeks at season 0 (≈ −$4k / +$3k on a $500 week) and
   * at season 6. "flat" restores rc.31 (−$5k / +$3k, flat in rc.31's index).
   */
  sizing: "weeks" as "weeks" | "flat",
  floorWeeks: 8,
  rescueToWeeks: 6,
  /** Guard for a squad with (almost) no wages: the weekly bill the weeks count, season-0 money. */
  weeksBasisMin: 100,
  /**
   * PROVISIONAL (30/10) — decision 4-B: the breach (Monday below the floor)
   * that ends the career, by difficulty; null = never. The first breach is
   * the Backer's rescue; every breach strictly between the first and that
   * one is a RESTRUCTURING (the highest-paid player sold at market value,
   * rep −restructureRepLoss, and the Backer's rescue tops the books back up).
   * Easy: every later breach restructures; Hard: the second ends it. rc.31:
   * 2 on every difficulty (no restructuring).
   */
  breachesToEnd: { easy: null, normal: 3, hard: 2 } as Record<string, number | null>,
  restructureRepLoss: 5,
  /**
   * PROVISIONAL (30/10) — M4: while the Backer is owed, a signing, a coach
   * hire or the psychologist that would shorten the runway is refused
   * ("loanRunway"), on top of rc.31's lock (transfer fees, gear, the bank).
   * A free agent into an empty starting seat (squad under three — after a
   * restructuring) is always allowed: the org can field its three again.
   * rc.31: false.
   */
  lockCommitments: true,
  repayFactor: 1.2,
  garnishRate: { easy: 0.1, normal: 0.15, hard: 0.2 } as Record<string, number>,
  /**
   * v0.3 debt-lock fix: while the Backer loan is active, HALF of every player
   * sale amortizes the debt (was: prizes only — selling a star did nothing),
   * and the Finances screen can pay any amount down manually at any time.
   */
  saleGarnishRate: 0.5,
} as const;

/**
 * v2.0 WEEKLY PAYROLL (R20). Contracts are still negotiated and stored per
 * split (no save migration), but money now moves every Monday: a split's
 * wage is spread over the season's 32 weeks (3 splits → ×3/32 per week), so a
 * season still costs exactly 3 × salaryPerSplit. Sponsor base, fanbase and
 * upkeep spread the same way. Weekly lines are quantized to `weeklyQuantum`.
 */
export const CAREER_PAYROLL = {
  weeksPerSeason: 32,
  splitsPerSeason: 3,
  weeklyQuantum: 10,
  /** Runway warning (weeks of negative net the balance still covers). */
  runwayWarnWeeks: 4,
  /**
   * PROVISIONAL (30/10) — ECONOMY-CONTRACT §6 decision 4, option B (M4): the
   * warnings. "weekly": the accountant's mail every Monday the runway is at
   * or under runwayWarnWeeks (the overdraft included) and once, when it
   * first drops to runwayNoticeWeeks, each with the projected breach (the
   * Monday the books would cross the Backer's floor) and a recovery
   * checklist. "rc31": one mail on the Monday the runway is exactly
   * runwayWarnWeeks with a positive balance, no notice.
   */
  runwayWarnMode: "weekly" as "weekly" | "rc31",
  runwayNoticeWeeks: 8,
} as const;

/**
 * v2.0 BANK LOAN (R21) — the player-initiated alternative to the Emergency
 * Backer. One loan at a time, sized by reputation tier, repaid in equal
 * weekly instalments over `termWeeks` with a flat `interestPct` on top.
 * Taking one never ends the career; missing payments just drains the balance
 * (the floor/Backer rules still apply).
 */
export const CAREER_BANK = {
  /** Max principal by reputation tier (repTierOf → 0..4). */
  maxByRepTier: [6_000, 12_000, 25_000, 50_000, 90_000] as const,
  minAmount: 1_000,
  interestPct: 0.12,
  termWeeks: 16,
  /** Loan offers are blocked while the Backer debt is open (one debt at a time). */
  blockedWhileBacker: true,
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
  /**
   * PROVISIONAL (30/10) — ROADMAP "Waiting on Miguel", the 30/10 note:
   * "filler orgs capped at the region's best real lineup (with BAL-02)"
   * (R59). A filler org's team rating never passes the strongest real org of
   * its region at that moment (a region with no real org yet is uncapped);
   * its players keep their overalls. rc.31: uncapped — switch back with false.
   */
  fillerCapToBestReal: true,
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
  /**
   * DEV-01a (rc.32, model 2): rare generic elite prospects in the historical
   * eras too. A dataset-era rookie aged ≤ `maxAge` whose pyramid tier reaches
   * past the ceiling becomes an elite prospect with `chance`, his potential
   * drawn from `weights` (93–98, 97/98 the rarest); the other capped kids keep
   * the ceiling, so the wonderkid share (88+) does not grow. ≈ 0.9 % of all
   * dataset-era rookies (0.75 aged 13–15 × 0.15 top tiers × chance). The
   * infinite era keeps its pyramid.
   */
  eliteProspect: {
    chance: 0.08,
    maxAge: 15,
    weights: { 93: 0.25, 94: 0.22, 95: 0.19, 96: 0.15, 97: 0.11, 98: 0.08 } as Record<number, number>,
  },
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
 * GAME-04 (R41) — the Match Center goal timeline: the broadcast clock model
 * (game seconds) and how fast it plays (ms at 1×, ÷ the speed toggle).
 * Presentation only: `engine/career/matchTimeline.ts` draws these from a local
 * stream seeded by each game's persisted result, never the competitive RNG.
 */
export const CAREER_MATCH_CLOCK = {
  /** RL regulation: a 5:00 countdown. */
  regulationSeconds: 300,
  /**
   * Regulation goals land with this many seconds LEFT (inclusive): never at
   * 5:00 (no goal inside the first 5 s of kickoff) and never at 0:00.
   */
  goalMaxLeft: 295,
  goalMinLeft: 1,
  /** Fewest game seconds between two goals (replay + kickoff restart). */
  minGoalGapSeconds: 4,
  /**
   * Overtime length in seconds: weighted buckets, uniform inside one
   * (inclusive). Median ≈ 1:52 · over 5:00 = 15 % · over 10:00 = 3 %.
   */
  overtime: {
    minSeconds: 30,
    maxSeconds: 1_200,
    buckets: [
      { fromS: 30, toS: 120, weight: 55 },
      { fromS: 121, toS: 300, weight: 30 },
      { fromS: 301, toS: 600, weight: 12 },
      { fromS: 601, toS: 1_200, weight: 3 },
    ],
  },
  /** Playback pacing — ms at 1× (÷ the speed toggle). */
  pacing: {
    /** Regulation clock speed: an empty 5:00 runs in 1.2 s. */
    regulationMsPerSecond: 4,
    /** The new game on the board (0 : 0, 5:00) before the clock starts. */
    kickoffHoldMs: 350,
    /** The clock stops after every goal (replay + kickoff). */
    goalHoldMs: 420,
    /** Tied at 0:00: the breath before the OVERTIME beat lands. */
    regulationBuzzerMs: 300,
    /** The OVERTIME beat on screen before the OT clock starts. */
    overtimeIntroMs: 800,
    /** The OT clock run, log-scaled by OT length: 0:30 → min, 20:00 → max. */
    overtimeRunMinMs: 1_600,
    overtimeRunMaxMs: 3_500,
    /** The golden goal holds the board before the game gap. */
    goldenGoalLingerMs: 600,
    /**
     * Absolute ms (not ÷ speed) the clock settles BEFORE its beat lands,
     * covering a few frames of render latency: the clock stops on the goal's
     * time, then the goal pops.
     */
    clockLeadMs: 60,
    /**
     * Repaint cap of a running clock (broadcast frame rate). It runs at up to
     * 250 game seconds a second, so 60 fps buys nothing visible and costs
     * twice the main-thread frames (measured on the export).
     */
    clockMaxFps: 30,
  },
} as const;

/**
 * Career event playback pacing (ms at 1× speed; divided by the speed factor).
 * Mirrors the classic TournamentScreen PACE table with a career tempo. The
 * user series' in-game beats (goals, OT) follow CAREER_MATCH_CLOCK.pacing.
 */
export const CAREER_PLAYBACK = {
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
  /**
   * v2.0 (R40) Championship Sunday title card (watch mode): ms before it
   * hands over to the playoffs on its own (× the animation-speed scale;
   * skippable; never under OS reduced motion), the delay before its bracket
   * preview starts and the stagger between the opening matchups.
   */
  sundayIntroMs: 4_200,
  sundayIntroBracketDelayMs: 450,
  sundayIntroStaggerMs: 110,
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
  /** v2.0: weekly payroll books ~5 lines/week → 160 keeps a full split visible. */
  ledgerTailCap: 160,
  /** v2.0: + 7 qualifier results per regional week → 90 keeps a full split. */
  eventResultsCap: 90,
  /** v0.3 rings: scrim results + the window transfer report. */
  scrimLogCap: 12,
  transferLogCap: 150,
  maxSaveBytes: 400_000,
} as const;

/**
 * BAL-02 (rc.32, ROAD-TO-WORLDS-DECISIONS R59): the career's OWN difficulty
 * presets — Easy / Normal / Hard, Normal the default. Road to Worlds reads
 * these instead of the Draft's DIFFICULTY (worldSim → teams → match), so a
 * Draft retune can no longer move the career. They replace the wizard's
 * Management Style step: one sentence each plus their real effects, read
 * from here and from the money keys (CAREER_ECONOMY.startingBudget /
 * prizeMult / salaryAskMult / sponsorMult — not moved). Overall stays the
 * match engine's main signal: every shift here is a couple of points.
 */
export const CAREER_DIFFICULTY = {
  /** The preset a new career starts on. */
  defaultPreset: "normal" as "easy" | "normal" | "hard",
  /**
   * The match profile per preset. rc.31's values (the Draft's easy / normal /
   * hard at rc.31) were copied first, then tuned on purpose (R59):
   *  - user / ai roll ranges: the per-game form roll of each side;
   *  - chemistry / opponentChemistry: the rating a side's full chemistry is
   *    worth (an AI org's standing roster runs near full chemistry);
   *  - opponentRatingShift: a flat add to every AI side's rating.
   * Easy and Normal are rc.31's exactly. Hard was rc.31's Draft Hard
   * (opponentChemistryMaxBonus 0, opponentRatingShift −0.5), which in the
   * career played as easy as Easy — the Draft's "chemistry is the player's
   * edge" stripped every AI org of the chemistry its standing roster earns:
   * at equal player strength the user won 81 % of Bo5 series on Easy, 65 % on
   * Normal and 81 % on Hard. Now AI chemistry counts (2) and the shift is
   * −0.2: 81 / 65 / 55 % (the user keeps Hard's 2.4 chemistry reward).
   */
  match: {
    easy: {
      userRollRange: [-3, 5] as const,
      aiRollRange: [-4, 4] as const,
      chemistryMaxBonus: 1.3,
      opponentChemistryMaxBonus: 1.3,
      opponentRatingShift: -2,
    },
    normal: {
      userRollRange: [-3, 4] as const,
      aiRollRange: [-4, 4] as const,
      chemistryMaxBonus: 2,
      opponentChemistryMaxBonus: 2,
      opponentRatingShift: -1.05,
    },
    hard: {
      userRollRange: [-3.5, 4] as const,
      aiRollRange: [-4, 4] as const,
      chemistryMaxBonus: 2.4,
      opponentChemistryMaxBonus: 2,
      opponentRatingShift: -0.2,
    },
  },
  /**
   * How much of the running is guided — the preset's starting prefs (the
   * Training screen's "delegate to coach" toggle stays). Easy: staff plan the
   * week, cups are entered for you, events resolve instantly by default;
   * Normal: rc.31's default ("balanced"); Hard: you plan every week and choose
   * every cup ("hands-on").
   */
  prefs: {
    easy: { managementStyle: "delegate", autoTrain: true, autoEnterUnofficials: true, playbackDefault: "instant", newsDigest: true },
    normal: { managementStyle: "balanced", autoTrain: true, autoEnterUnofficials: true, playbackDefault: "full", newsDigest: true },
    hard: { managementStyle: "handsOn", autoTrain: false, autoEnterUnofficials: false, playbackDefault: "full", newsDigest: false },
  },
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
  /**
   * rc.2: preview tools (the "unlock everything" cosmetics switch, the fake
   * leaderboard when accounts are disabled). On in dev/tests and on the
   * staging build (NEXT_PUBLIC_NOINDEX=1); never in the production deploy or
   * the external playtest build.
   */
  previewTools:
    process.env.NEXT_PUBLIC_PLAYTEST !== "1" &&
    (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_NOINDEX === "1"),
  /**
   * v2.0 external playtest build (playtest.rocketdraft.app). Set only by the
   * playtest Worker's build (NEXT_PUBLIC_PLAYTEST=1, together with
   * NEXT_PUBLIC_CAREER_MODE=1 and NEXT_PUBLIC_NOINDEX=1). On → the build ships
   * just the new dataset + Classic / Quick Draft, Challenges and Road to
   * Worlds: no Daily Challenge, Daily Quiz, missions, login streak, profile
   * cosmetics (locker, badges, titles, banners) or season extras (recap,
   * season panel). Off everywhere else, dev included.
   * `scripts/postexport.mjs` deletes the cut routes — keep them in sync.
   */
  playtest: process.env.NEXT_PUBLIC_PLAYTEST === "1",
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
