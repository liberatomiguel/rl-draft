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
export const BALANCE_VERSION = 6;

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
   * Which national team shows: uniform, except that a team the player has NOT
   * completed yet (some card not owned — never found, or found and still being
   * collected) weighs this much more, so a full album stays reachable without
   * making the next find predictable. rc.33: finding a team only reveals its
   * album page and each card is collected by drafting it, so a team stays
   * favoured until its last card is owned (same semantics, the key keeps its
   * pre-rc.33 name).
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
  /**
   * rc.34 (DEV-03 T3): a package's scrims — practice, never official points,
   * prizes, reputation or win achievements. Three levels by the opponent's
   * rating gap to the squad (picked from the region's orgs, nearest to the
   * level's band first): XP in training-week equivalents per scrim × the
   * opponent's field quality, chemistry credit (splitsTogether), wear points,
   * and the easy scrim's "confidence" (decision 4-A: the consistency offset).
   * Contract candidates, each ±50 %: easy 0.25 / 0.03 / −1 / +0.1, even
   * 0.40 / 0.06 / 0, hard 0.60 / 0.03 / +2.
   * rc.36 (front T2, Miguel: "Heavy and Hard raise the wear risk again,
   * modestly"): hard 2 → 0.5 wear a scrim and easy −1 → −0.25, so each of
   * Heavy (+1 wear a week) and Hard scrims adds about +2 points of absence
   * risk to a 28-day cycle, both together reach the +4 cap, and easy scrims
   * no longer cancel a Heavy load (rc.35: Hard alone hit the cap, Heavy +
   * Easy read no risk at all).
   */
  levels: {
    easy: { gap: [-8, -3] as const, xpWeeks: 0.25, chemistry: 0.03, wear: -0.25, consistency: 0.1 },
    even: { gap: [-3, 3] as const, xpWeeks: 0.4, chemistry: 0.06, wear: 0, consistency: 0 },
    hard: { gap: [3, 8] as const, xpWeeks: 0.6, chemistry: 0.03, wear: 0.5, consistency: 0 },
  },
  /**
   * rc.34 (T3): a package's scrims a week (0..maxPerWeek) and their weekdays
   * (2 = Tue, 3 = Wed, 4 = Thu — never a matchday); the k-th scrim of a week
   * pays weekShare[k] of its XP and chemistry (contract: 100 / 60 / 30 %).
   */
  package: {
    maxPerWeek: 3,
    days: { 1: [2], 2: [2, 4], 3: [2, 3, 4] } as Record<number, readonly number[]>,
    weekShare: [1, 0.6, 0.3] as readonly number[],
  },
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
  /**
   * rc.34 (front I; Miguel 31/10: "sometimes you just can't move anything"):
   * the zone where he signs is always at least this many wage-stepper
   * presses wide (`contract.negotiationAnswerFor`), never under the least a
   * contract pays. rc.33's zone was only (1 − flex) × his ask, its floor
   * rounded up to the $10 weekly grid: every ask under ~$170 a week, and any
   * ask under $1,000 a week with a flexibility of 0.99 or more, collapsed to
   * his ask — 85 % of the founders' renewals and 63 % of the rookies on the
   * market could not move the wage at all. 1: a firm player still gives one
   * press (2 % of his ask, or $10); the average saving moves from 3 % to
   * 3.3 %. 0 restores rc.33's zone.
   */
  minZoneSteps: 1,
  /**
   * rc.35 (front N, Miguel on rc.34: "I can offer below his zone, he is just
   * less likely to accept"): under the zone's floor his odds fall smoothly
   * (smoothstep) from 100 % at the floor to 0 % this share of his weekly ask
   * further down. Whether he signs is a seeded roll per player and window
   * (`contract.negotiationRollFor`): he signs when his odds beat it, so a
   * reload changes nothing and more money never turns a yes into a no.
   */
  oddsFallPct: 0.25,
  /**
   * rc.35 (front N): each season of contract past the first lowers what he
   * needs (the zone's floor) by this share of his weekly ask — a longer deal
   * is security, so he takes less wage, bonus and share for it.
   */
  lengthReliefPerSeason: 0.03,
  /**
   * rc.35 (front N): the signing bonus (luvas) is a lever. Each $1 of bonus
   * over his ask is worth bonusWeight / (contract weeks) a week of wage to
   * him (cash up front is worth more than the same money spread), each $1
   * under it costs the same. The slider runs from 0 to bonusMaxMult × the
   * standard bonus (`economy.signingBonusFor`) in bonusSteps steps.
   */
  bonusWeight: 1.25,
  bonusMaxMult: 2,
  bonusSteps: 8,
  /**
   * rc.36 (front S2, Miguel on rc.35: "he answers only after you send the
   * offer, and a refusal raises his requirements"; his question rc.35-(e),
   * "count attempts?"): each offer he turns down in a window raises what he
   * needs for sure (the zone's floor, in the offer's whole worth — wage,
   * share and bonus) by this share of his weekly ask, counted at most
   * `refusalsCounted` times, never above his ask (paying it always signs).
   * The count lives in the save per player and window (`negotiationTries`),
   * so a reload cannot reset it; the window's close and the rollover clear
   * it. 0.03 × 3: three refusals cost up to 9 % of his ask, about what his
   * flexibility and a longer deal take off (the zone is 2–12 % wide). His
   * roll stays fixed per window, so the same offer is never answered twice
   * differently. 0 restores rc.35 (nothing hardens).
   */
  refusalRaisePct: 0.03,
  refusalsCounted: 3,
  /**
   * rc.36 (front S2, settling rc.35-(d)): the empty seat's waiver (RTW-05,
   * `careerFlow.emptySeatPriceFor`) covers a signing no dearer than the
   * cheapest free agent the org may sign. true (rc.35, kept): its up-front
   * cost counts the signing bonus OFFERED — a bonus over that seat's price
   * is the org's own money, so a broke org offering it loses the waiver
   * (the sheet names the most the waiver pays). false: the waiver reads the
   * bonus he asks, so a broke org could pay any bonus into the overdraft.
   */
  emptySeatCountsOfferedBonus: true,
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
 * three-85 squad's wages ≤ 1.5). rc.34 (front I; Miguel 31/10: "starting
 * players and lower-overall players shouldn't get any percentage"): only a
 * player above `shareThresholdOverall` asks a share, and the founders'
 * founding deals carry none (`squadFromOffer`); a deal already signed keeps
 * its share.
 */
export const CAREER_PRIZE_SHARE = {
  /**
   * rc.34 (front I, Miguel 31/10): at or under this overall a player asks no
   * prize share (0 %, and the talk hides the share lever); above it the ask
   * starts from 0 and grows `askPerPoint` a point, so the first player who
   * asks one is an 80 — a gold card. Measured at season 0: every founder
   * (65–74), every free agent (the best is a 79, in EU) and most of the
   * orgs' starters in MENA / APAC / SSA (81–96 %) ask none; 87 % of EU's and
   * 75 % of NA's ask one. rc.33 had no threshold (a 70 asked 3 %, a 75 6 %).
   */
  shareThresholdOverall: 79,
  /**
   * ECO-10 (rc.33): share points per overall point. rc.34 (front I): from 0
   * at the threshold, 1.2 a point — an 80 asks 1 %, an 85 7 %, a 90 13 %
   * (rc.33's figure for a 90) and a 94 or more the cap. The e2 guard holds
   * at the lowest share the talk allows an 85 (7 − maxBelowAsk = 4 %): a
   * dominant season keeps 1.38 × three 85s' wages (rc.33: 1.19 at 8 %; 1.0 a
   * point would leave 1.42, 0.5 — rc.33's slope — 1.52, over the guard).
   */
  askPerPoint: 1.2,
  /** ECO-10 (rc.33): at this age or younger a player asks `youngDiscount` points less (a prospect sells his upside on the wage). */
  youngAge: 18,
  /** ECO-10 (rc.33): see youngAge. */
  youngDiscount: 1,
  /**
   * ECO-10 (rc.33): no contract keeps less than this share of a podium prize
   * (percent). rc.34 (front I): 0 — a player under the threshold asks none,
   * and the talk can take one who asks a little down to none (rc.33: 2).
   */
  minPct: 0,
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
   * the team's results. rc.33 review: priced in weekly money — this share of
   * his WEEKLY ask, whole weekly quanta, never under one
   * (`contract.sharePointWeeklyFor`), so every press moves the wage shown.
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
   * rc.35 (front T): the season cap spreads instead of stopping dead — a tick
   * may take this × (its weeks ÷ the calendar weeks left) of the room left,
   * so a fast prospect slows near the cap but never reads flat for weeks.
   */
  seasonCapSpread: 2,
  /**
   * rc.35 (front T): the season's hard ceiling on growth. The pace stays
   * capped at seasonGainCap a year (so the base never front-loads); this
   * leaves room for a package, gear and the Training Weeks to run ahead of
   * it — they only speed the road to the peak, which still bounds it.
   */
  seasonGainHardCap: 13,
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
   * rc.34 (DEV-03, decision 7-A): no longer read by a training tick — the
   * coach's training effect acts only through the package (CAREER_PLAN).
   * Kept for `coachMultFor` (rc.33's figure, quoted by old tests and tools).
   */
  coachMult: { perPoint: 0.015, min: 0.85, max: 1.3 },
  /**
   * rc.34 (DEV-03, TRAINING-CONTRACT decision 7-A — "no coach = DEV-01's
   * base", the 0.85 floor dropped as a malus): every training tick runs at
   * this share of DEV-01's pace unit, coach or not. 0.85 is rc.33's no-coach
   * floor, so the base growth DEV-01 measured (R55e: the default setup had no
   * coach; `CAREER_DEV.trainingWeeksPerYear` was calibrated on it) is
   * unchanged to the decimal — a coached squad without a package now grows
   * at that base, and the coach's effect lands through the package
   * (`training.packageEffectFor`). The per-player focus / intensity and the
   * weekly drill no longer scale the base either (they retired into the
   * package, contract §8 step 2).
   */
  baseRateMult: 0.85,
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

/**
 * rc.34 — DEV-03, training packages per period (TRAINING-CONTRACT.md, Gate 3a
 * approved 30/10: decisions 1–7 A). One training decision per period, none
 * per week: a package (objective, one squad focus, a workload, scrims,
 * optional per-player tweaks) runs Monday–Friday around the calendar, and a
 * summary is filed at the boundary. The base (no package) is DEV-01's growth
 * (CAREER_TRAINING.baseRateMult). Every value Miguel did not fix is Claude's
 * call, measured in the rc.34 report and tested at Gate 3b.
 */
export const CAREER_PLAN = {
  /**
   * Decision 1-A: a fixed 28-day grid from each season's day 1 (8 periods;
   * a season is exactly 8 × 28 days). "split" = decision 1-B, the playtest's
   * comparison: one period per split with its window (W1–12, W13–22,
   * W23–32). A period never crosses a season.
   */
  periodMode: "grid" as "grid" | "split",
  /** rc.36 (front T2, Miguel): back to a 28-day cycle (8 a season); rc.35: 14. */
  periodDays: 28,
  /** The Monday weeks that open a period in "split" mode (1-B). */
  splitStartWeeks: [1, 13, 23] as readonly number[],
  /**
   * T2 objectives (decision 2-A: a package moves speed and attributes only —
   * the peak stays DEV-01's). Each main effect is scaled by the coach effect
   * (T4's focus efficiency; CAREER_PLAN.coach) and +specialtyBoost when the
   * coach's specialty matches:
   *  - development: the session rate × (1 + boost);
   *  - preparation: the session rate × (1 + boost), scrim XP and chemistry
   *    × (1 + scrimBonus);
   *  - recovery: no boost; wear × (1 − wearCut); for a player past his peak,
   *    DEV-01's decline × (1 − declineCut) while it runs.
   * Contract candidates: 0.20 (0.10–0.30), 0.05 / ×1.5 (1.25–2.0), −50 %
   * (30–70 %), ×0.75 (0.6–0.9).
   */
  objectives: {
    development: { boost: 0.2, scrimBonus: 0, wearCut: 0, declineCut: 0 },
    preparation: { boost: 0.05, scrimBonus: 0.5, wearCut: 0, declineCut: 0 },
    recovery: { boost: 0, scrimBonus: 0, wearCut: 0.5, declineCut: 0.25 },
  },
  /**
   * T2 workload (squad, or a per-player tweak): scales the objective's boost
   * and the wear. Heavy adds `wearPerWeek` wear points a week (contract: +1).
   */
  workloads: {
    light: { boostScale: 0.5, wearCut: 0.4, wearPerWeek: 0 },
    normal: { boostScale: 1, wearCut: 0, wearPerWeek: 0 },
    heavy: { boostScale: 1.5, wearCut: 0, wearPerWeek: 1 },
  },
  /**
   * T2 the squad focus: one of the five drill themes grows its attribute
   * offset(s) for every player who follows it, at today's drill rate per
   * training-week (rc.33's drill also ran ×1.05 overall; the objective
   * carries the overall effect now, so a focus costs no overall).
   */
  focusOffsetPerWeek: 0.25,
  /**
   * T2 a per-player focus tweak (rc.33's personal focus): +offsetPerWeek on
   * his attribute instead of the squad focus, at overallShare of his package
   * rate — never below the base (×1.00).
   */
  tweakFocus: { offsetPerWeek: 0.35, overallShare: 0.9 },
  /**
   * T4 the coach's three attributes, each with one printed effect:
   *  - quality → focus efficiency, the share of a package's effect that
   *    lands: efficiencyAt60 at quality 60, + efficiencyPerPoint a point
   *    (1.0 at 90), inside efficiencyRange; no coach = coachless (contract:
   *    "a package without a coach runs at 0.5");
   *  - experience → plan quality, the share of the effect his own plan lands
   *    when he runs it alone (mode "coach"; 0.85 at 0, +0.015 a season, at
   *    most 1 — t5: ≥ 0.85 new, ≥ 0.95 from 7 seasons), and recovery: wear
   *    × (1 − wearCutPerExperience × experience), at most wearCutMax;
   *  - specialty → its objective's main effect × (1 + specialtyBoost).
   */
  coach: {
    efficiencyAt60: 0.6,
    efficiencyPerPoint: 0.4 / 30,
    efficiencyRange: [0.5, 1.1] as const,
    coachless: 0.5,
    specialtyBoost: 0.25,
    planQualityBase: 0.85,
    planQualityPerExperience: 0.015,
    wearCutPerExperience: 0.03,
    wearCutMax: 0.3,
  },
  /**
   * T3 / decision 6-A: wear feeds today's pre-event unavailability roll — no
   * new fatigue meter. The squad's projected wear for the period (shown
   * before approval) adds chancePerPoint per point, at most chanceMax (t6:
   * ≤ +4 points per event), normalised to a nominalDays period (so a split
   * period in mode 1-B reads per 28 days).
   */
  wear: { chancePerPoint: 0.005, chanceMax: 0.04, nominalDays: 28 },
  /**
   * T3: a period's package-scrim XP is capped at this share of the period's
   * gain (sessions + scrims; contract 25 %, range 15–35 %) — t4 by
   * construction.
   */
  scrimCapShare: 0.25,
  /** T6: the history ring — two seasons of grid periods. */
  historySize: 16,
  /**
   * rc.35 (front T, Miguel): the preset's training mode while no coach is
   * hired. rc.36 (front T2, Miguel: "nothing runs until you pick"): it only
   * decides the RECOMMENDED tag — Easy ("auto") and Normal ("recommend") tag
   * the best plan, Hard ("manual") tags nothing; no preset starts a plan by
   * itself any more (rc.35's Easy applied it). The ids are kept (no migration).
   */
  modeByPreset: { easy: "auto", normal: "recommend", hard: "manual" } as Record<string, "auto" | "recommend" | "manual">,
  /** "Keep my plan next cycle" — rc.36: retired (a finished cycle is started again by hand); the save field stays. */
  repeatByMode: { auto: true, recommend: true, manual: true } as Record<string, boolean>,
  /**
   * rc.35 (front T): the simplified package picks a scrim LEVEL (or none);
   * a level runs this many scrims a week (on CAREER_SCRIM.package.days).
   */
  scrimsPerWeekOnLevel: 2,
  /**
   * rc.36 (front T2, Miguel: "the promised gain is paid in full only at the
   * cycle's end — you climb to 8–9 of 10 along the way, the rest lands on
   * completion"). Each session and package scrim pays `alongShare` of the
   * plan's gain now — never less than the base rate, so a plan never slows
   * anyone below not picking — and holds the rest; the held part lands on
   * the cycle's last day (the next period's arrival, or the rollover). An
   * adjustment keeps what is held; a cycle stopped early, or a player who
   * leaves, forfeits it.
   */
  payout: { alongShare: 0.85 },
  /**
   * rc.36 (front T2): a hired coach plans and starts every cycle while this
   * is on (the manager can switch it off on Training — then he only tags his
   * plan Recommended). Without a coach a finished cycle is started by hand.
   */
  coachPlansByDefault: true,
  /**
   * rc.36 (front T2, Miguel: "an unknown phase is revealed after a few
   * training days"): a signing whose phase reads "?" (no report bought) shows
   * it after this many training days (Mon–Fri) with the squad.
   */
  phaseRevealDays: 5,
  /**
   * rc.36 (front T2): the focus the RECOMMENDED tag marks without a coach —
   * "need": the drill theme of the fielded trio's weakest stat (a focus costs
   * no overall, so "balanced" is never the best pick); "balanced": rc.35's.
   * A coach always recommends the theme of his buff stat.
   */
  recommendedFocus: "need" as "need" | "balanced",
  /**
   * rc.36 (front T2): the batched Advance stops once on the day a cycle
   * completes with nothing started after it (no coach planning it), so the
   * manager sees the report and can start the next one. Never a hold: a
   * second press goes on, and not picking is the base.
   */
  stopOnCycleEnd: true,
  /**
   * T5 the coach's proposal: development by default, preparation for a
   * period with a Major or Worlds, recovery when the last period's squad wear
   * reached recoveryWearAt. Each objective's workload and scrims (count,
   * level); the focus is the theme of his buff stat.
   */
  proposal: {
    recoveryWearAt: 8,
    development: { workload: "normal", scrimsPerWeek: 2, scrimLevel: "even" },
    preparation: { workload: "normal", scrimsPerWeek: 3, scrimLevel: "even" },
    recovery: { workload: "light", scrimsPerWeek: 1, scrimLevel: "easy" },
  } as const,
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
  /**
   * rc.34 — BAL-05 (Miguel, 31/10: "I created a career with the older team and went
   * broke in the first split"): the start budget is at least this many weeks
   * of the founding wage bill (the three founders' weekly wages at their
   * founding asks), by difficulty — `startingBudget` stays the floor
   * (economy.startingBudgetFor). The flat budget gave every roster the same
   * money while the founding payroll runs ×3 from the prospects to the
   * journeymen (Normal: $200–$320 a week for the prospects, $480–$650 the
   * balanced, $740–$1,150 the journeymen, by region), so the older team had
   * 10–16 weeks of runway on Normal (6–9 on Hard) against the balanced
   * roster's 25: with the first sponsor late in a strong region, it broke
   * inside the first split. These weeks are the balanced roster's runway in
   * a median region (Easy 44 × $450, Normal 24 × $500, Hard 13 × $590), so
   * it and the prospects keep their flat budget there, and every roster in
   * every region starts with at least that runway in weeks (the dearer
   * journeymen, and the balanced in NA and APAC, get more). null = rc.33
   * (the flat budget only).
   */
  startingBudgetWeeks: { easy: 44, normal: 24, hard: 13 } as Record<string, number | null>,
  prizeMult: { easy: 1.15, normal: 1.0, hard: 0.9 } as Record<string, number>,
  salaryAskMult: { easy: 0.9, normal: 1.0, hard: 1.15 } as Record<string, number>,
  sponsorMult: { easy: 1.15, normal: 1.0, hard: 0.9 } as Record<string, number>,
  /**
   * Fanbase trickle per split = reputation × this (season-0 money, on the
   * money index). rc.33 — M7 (decision 9-B, "after M1–M3 are measured";
   * Miguel, 30/10: Claude decides, Miguel tests): 40 → 60, the contract's
   * candidate — the guaranteed floor that grows with reputation, so a
   * newcomer without a founding partner (ECO-07) still has a base.
   */
  passivePerRepPoint: 60,
  /**
   * ECONOMY-CONTRACT M1 (rc.32, decision 1-A): ONE season money index, read
   * through `economy.moneyIndex`. "single": every stream grows
   * ×indexPerSeason^seasonIndex — wages, fees and coach asks, prizes, new
   * sponsor deals, the fanbase, the bank's limits, the minimum fee and
   * salary, the stand-in, scouting, gear (costs and upkeep), the founding
   * partner and the inserts' money. Signed contracts keep their figure. The
   * Backer is sized in weeks of payroll (M4), so it is not indexed again.
   * "rc31" restores rc.31 exactly: wages and fees
   * ×CAREER_SALARY.inflationPerSeason (1.08), prizes
   * ×CAREER_PRIZES.growthPerSeason (1.12), new sponsor deals
   * ×CAREER_SPONSOR.growthPerSeason (1.10), every other amount flat.
   */
  indexMode: "single" as "single" | "rc31",
  /**
   * rc.33 — ECO-09 (Miguel, 30/10, revisits 1-A: "the old 12 % felt
   * better"): the one index at 12 % a season (rc.32: 1.08). Every stream
   * still moves together, so no ratio drifts (b1 ±2 %); money just grows
   * faster (×2.21 by season 7 instead of ×1.71).
   */
  indexPerSeason: 1.12,
} as const;

export const CAREER_SALARY = {
  basePerSplit: 1_500,
  growthPerPoint: 1.2,
  anchorOverall: 70,
  /**
   * rc.33 — ECO-09 (Miguel, 30/10: "wages feel too low, or should grow more
   * steeply"): a steeper ask above a strong-player line. Each overall point
   * above `starCurveFrom` multiplies the ask by `starGrowthPerPoint` on top
   * of growthPerPoint, so the curve bends upward for strong players and
   * leaves every ask at or under the line untouched (the founding rosters,
   * the 60s–70s market). Market value and fees follow (value = ask ×
   * valueMultiple); coaches stay on the plain curve. 1.03: an 85 asks ×1.16,
   * a 90 ×1.34 and a 95 ×1.56 rc.32's figure, so a 90's wage is about 1.1×
   * the T4-contender income (P8; rc.32 0.85) — a star is a franchise
   * decision. 1.02 would make it ≈1.0; 1 = rc.32's curve.
   */
  starCurveFrom: 80,
  starGrowthPerPoint: 1.03,
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
   * rc.35 (front N, Miguel on rc.34: "starting wages feel too high"; on
   * Normal the veterans went broke right after hiring a coach): the
   * founders' founding deals pay this share of their market ask
   * (`careerFlow.squadFromOffer` — they sign for the project). The starting
   * budget still reads the full ask (CAREER_ECONOMY.startingBudgetWeeks), so
   * every roster starts with more weeks of runway. Renewals reprice at the
   * normal ask (the raise cap spreads it). 1 = rc.34.
   */
  foundingWageMult: 0.85,
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
  /**
   * rc.33 (2-B, Claude's call — tested at Gate 2): the most one renewal
   * multiplies his current wage, the market floor included. A breakout
   * prospect climbs to his value over two renewals, not one: rc.33's first
   * re-measure had the prospects' renewals at ×3.9 p50 / ×12 p90 (up to
   * ×25), which broke every hands-off prospects career in EU/NA on Normal.
   */
  renewalMaxJump: 2.5,
  /**
   * rc.33 (ECONOMY-CONTRACT M6 lever 3, the title raise; Claude's call —
   * tested at Gate 2): a player renews dearer for the titles the user won
   * while he was in the squad over the last `windowSeasons` seasons (this one
   * included): +perMajorOrWorlds for a Major or Worlds title, +perRegional
   * for a regional title, at most +max, on top of the renewal rule. Winning
   * carries its own costs (contract e): the brake on the snowball that
   * renewalMaxJump's development dividend would otherwise feed.
   */
  titleRenewalPremium: { perMajorOrWorlds: 0.1, perRegional: 0.05, max: 0.3, windowSeasons: 2 },
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
  // rc.33 — ECO-12 (Miguel, 30/10; withdraws decision 8-B): rc.32's "List
  // for sale" (`listingEnabled`, `listingOfferRange`, `listingOfferDays`) and
  // the late signing (`lateSigningDays`) are gone; random AI bids stay. A
  // future update rethinks selling (ECO-06).
} as const;

export const CAREER_SPONSOR = {
  /**
   * v0.2: tiers rescaled to the garage-org economy and each carries PERKS —
   * gear discounts and free bootcamps — so a better sponsor visibly upgrades
   * the org's toolbox, not just the bank line.
   */
  /**
   * rc.33 — M7 (decision 9-B, "tune after M1–M3 are measured"; Miguel,
   * 30/10: Claude decides, Miguel tests): the tier bases per split, season-0
   * money (rc.32: $1.5k / $6k / $18k / $45k). Sized so that, with no
   * founding partner (ECO-07), a newcomer playing normally pays its way and
   * payroll ÷ guaranteed income (b3) moves toward 1.0–2.0, while a spender
   * still breaks on Normal and Hard. The money goes where the newcomer is:
   * T1 at the top of the contract's range ($3–5k) carries a founding roster
   * (b3 ≈ 0.9–1.2 at the first offer), T2 doubles. The top tiers stay below
   * the contract's candidates ($30–40k / $55–65k): measured, T3 and T4
   * holders already sat at b3 1.5 / 1.1 with $26k / $50k, and the snowball
   * (e1) is the binding limit there — a reputation-90 org on a cheap squad
   * took ~6× its payroll in guaranteed money at $35k / $60k. So T3 +22 %,
   * T4 as rc.32. Bonuses, gates and perks unchanged.
   */
  tiers: [
    { tier: 1, repGate: 0, base: 5_000, bonus: 750, objective: "enterEvents", gearDiscountPct: 0, freeBootcampsPerSeason: 0 },
    { tier: 2, repGate: 25, base: 12_000, bonus: 3_000, objective: "regionalTop8", gearDiscountPct: 20, freeBootcampsPerSeason: 0 },
    { tier: 3, repGate: 50, base: 22_000, bonus: 9_000, objective: "majorQualify", gearDiscountPct: 35, freeBootcampsPerSeason: 1 },
    { tier: 4, repGate: 75, base: 45_000, bonus: 25_000, objective: "majorTop4", gearDiscountPct: 50, freeBootcampsPerSeason: 2 },
  ] as const,
  signingBonusSplits: 1,
  /**
   * v0.3: tier base/bonus grow ×this^seasonIndex at offer time (new deals).
   * Read only in CAREER_ECONOMY.indexMode "rc31" (M1: the one index).
   */
  growthPerSeason: 1.1,
  /**
   * ECONOMY-CONTRACT M3 (rc.32, decision 3-A) — the founding partner, a
   * day-one tier-0 deal. Base per split = payrollShare × the founding wage
   * bill (fixed at creation, then on the money index), objective "enter
   * events", no signing bonus. It runs until the first real deal or the end
   * of season index `throughSeasonIndex`, whichever is later — alongside a
   * real deal signed earlier.
   * rc.33 — ECO-07 (Miguel, 30/10: "no day-one founding partner"):
   * `enabled: false` grants none — not on a new career, not to an older save
   * at load. `honourRunning: true`: a deal an rc.32 career already holds is
   * paid to its own end condition (a signed deal is honoured; nothing new is
   * granted). `enabled: true` restores rc.32 (the backfill included).
   */
  founding: {
    enabled: false,
    honourRunning: true,
    payrollShare: 0.7,
    throughSeasonIndex: 1,
    /**
     * rc.34 — SPONSOR-CONTRACT S6 (decision 5-A, as Miguel adjusted it to
     * ECO-07/08: no day-one partner any more, so this only touches an rc.32
     * career still running one, `honourRunning`): the handover tapers instead
     * of a cliff. Through season index `throughSeasonIndex` the partner pays
     * in full whatever deal is held; from then, starting with the first real
     * deal (or at that season's first Monday when one is already held), it
     * pays these shares of its base, one split each (each split boundary
     * moves a step), then ends. [] restores rc.33's cliff (it ends at once).
     */
    taper: [2 / 3, 1 / 3] as readonly number[],
  },
  /**
   * Misses within a deal before the renewal drops one tier. Never clawbacks.
   * rc.34 (decision 7-A): the meter stays on Steady deals (and deals from
   * before rc.34); fines replace it on Balanced and Bold deals — one
   * consequence per miss.
   */
  patienceMisses: 3,
  /**
   * rc.34 — ECO-04, SPONSOR-CONTRACT S1 (Gate 3a, 30/10: decisions 2-A, 3-A).
   * Each decision offers three deals at the best tier the reputation allows
   * (a Steady deal that missed `patienceMisses` goals renews one tier lower),
   * one per profile. A profile shares its own ceiling between weekly pay, a
   * fixed part (paid on signing, or — Bold — the day its first goal is
   * reached) and a bonus per goal, sets every split's goal at its word, and
   * runs for `lengthSplits` splits (6 = two seasons, 3 = one season, 1 = one
   * split). Each ceiling is sized so the deal's expected value at its first
   * goal's chance equals the tier's value for the Mondays it pays (s1).
   * Claude's values (Miguel fixed the decisions, not the shares): the
   * contract's candidates for Steady and Balanced with 5 points moved from
   * the weekly pay to the signing payment (measured: at 0.8 / 0.65 the
   * weekly part outgrew rc.33's base — payroll ÷ guaranteed 0.7 at S2–S3,
   * under band b3, and fewer tight Mondays, e3), and Balanced's fine 0.15
   * of a bonus, not 0.25 (0.25 put 14–24 % of the seasons over two weeks of
   * payroll in fines, s3 ≤ 10 %); Bold's weekly share 0.35 and
   * bonus 0.45 sit outside the candidate ranges (50–85 % / 10–35 %) because
   * Bold's goals are Stretch goals — at the candidates (0.5 / 0.3), the
   * ceiling that keeps its expected value level makes Bold's weekly pay the
   * HIGHEST of the three, the opposite of the profile.
   *
   * rc.34 review (P3): the weekly pay is no longer a share of that ceiling.
   * Sized at the goal's chance, the ceiling grew as the chance fell, so a
   * Stretch goal near its floor (`wordMin.stretch`) still lifted Bold's
   * weekly pay above Balanced's, at times above Steady's (1 decision in 6
   * of the review's grid). `weeklyOfValue` is now the weekly pay as a share
   * of the tier's value a Monday — the same whatever the goal, so it reads
   * Steady ≥ Balanced ≥ Bold in every decision. The goal's chance moves only
   * the rest of the deal's value, shared between the fixed part and the
   * bonuses in the ratio `fixedShare` : `bonusShare` (unchanged) and sized so
   * the expected value still equals the tier's value (s1). Claude's values:
   * what the old shares paid at the profile's own word — Steady 0.75–0.78,
   * Balanced 0.67–0.73 — and Bold below Balanced (0.61–0.82 there, 0.72 at
   * its word's chance): 0.65, a tenth less sure money than before at its
   * word, the rest moved to its milestone and bonus.
   */
  /*
   * rc.35 — front S (Miguel, playtesting rc.34: "Steady pays more than
   * Balanced, which pays more than Bold — makes no sense"). The profiles are
   * priced by RISK now, not at equal expected value: each pays a share of
   * the tier's value for its Mondays — `ceilingOfValue`, the most it pays —
   * Bold the most, Steady the least; `weeklyOfCeiling` of that ceiling is the
   * weekly pay (so weekly pay also reads Bold ≥ Balanced ≥ Steady), the rest
   * is the fixed part and the bonuses in the `fixedShare` : `bonusShare`
   * ratio. The price of Bold's money is its goal (the hardest of the three)
   * and its fine: `fineShare` × a bonus, at most `fineCapWeeks` weeks of the
   * deal's weekly pay a miss (Steady none, Balanced 1, Bold 2), and never
   * more than `fines.seasonCapWeeks` weeks in a season. Claude's values,
   * measured on the probe's C10 / C11 (insolvency bands kept).
   */
  profiles: {
    steady: { ceilingOfValue: 0.95, weeklyOfCeiling: 0.82, fixedShare: 0.15, fixedKind: "signing", bonusShare: 0.1, fineShare: 0, fineCapWeeks: 0, word: "likely", lengthSplits: 6 },
    balanced: { ceilingOfValue: 1.2, weeklyOfCeiling: 0.72, fixedShare: 0.15, fixedKind: "signing", bonusShare: 0.25, fineShare: 0.3, fineCapWeeks: 1, word: "even", lengthSplits: 3 },
    bold: { ceilingOfValue: 1.5, weeklyOfCeiling: 0.66, fixedShare: 0.2, fixedKind: "milestone", bonusShare: 0.45, fineShare: 0.6, fineCapWeeks: 2, word: "stretch", lengthSplits: 1 },
  } as const,
  /**
   * rc.35 — front S: the sponsor side of the progression ladder
   * (`sponsorDeals.sponsorAccessFor(level)`; front P's unlock ladder calls
   * it — until then the level is the reputation tier, economy.repTierOf).
   * Each row holds from `minLevel`: how many offers a decision brings (2 =
   * Steady and Balanced, no Bold), the best tier a brand may be, and whether
   * its brands are "global" (`valueMult` more money, and `globalBootcamps`
   * free bootcamps a season, at least the tier's). Early sides see two safe
   * offers; "better sponsors" add Bold and pay more (a bootcamp's worth);
   * global sponsors pay the most.
   */
  access: {
    levels: [
      // rc.35 integration: before the "local sponsors" rung (rep 10, with the
      // generic coach) only the smallest local deals; the rung opens tier 2.
      { minLevel: 0, offers: 2, boldAllowed: false, tierCap: 1, global: false, valueMult: 1 },
      { minLevel: 1, offers: 2, boldAllowed: false, tierCap: 2, global: false, valueMult: 1 },
      { minLevel: 2, offers: 3, boldAllowed: true, tierCap: 4, global: false, valueMult: 1.05 },
      { minLevel: 3, offers: 3, boldAllowed: true, tierCap: 4, global: true, valueMult: 1.1 },
    ],
    globalBootcamps: 2,
  },
  /**
   * rc.34 — ECO-04 (s1): the tier's value per season, at season-0 money
   * before the difficulty and the index: base × (splits + the signing
   * payment's splits) + bonus × splits × this share — what a tier paid in
   * rc.33 with its objective hit one split in two (an "Even" objective, the
   * contract's S1 yardstick). M7's bases and bonuses stay the money.
   */
  valueBonusShare: 0.5,
  /**
   * rc.34 — ECO-04, "deals scaled to the team's level" (the snowball lever at
   * the top; Miguel, 30/10: not too easy, not punitive). Tier 1 pays in
   * full; a Tier 2 brand pays a regional top-8 side in full (its margin over
   * the region's 8th org), a Tier 3 brand a side that holds its own at a
   * Major (over the expected Major field's 8th), a Tier 4 brand a world
   * contender (over the field's 4th). Below it, `perPoint` less per rating
   * point, never under the tier's `floor`. T2's floor 0.7: measured, rc.33's
   * meter dropped a weak EU/NA side's T2 deal to T1 every other season (a
   * regional top 8 it never reached); without it the median Normal career
   * banked 2–2.6 seasons of payroll at S2–S3 (band b2 0.25–1.5) and a tight
   * Monday in 16 % of S3–S5 seasons (e3 ≥ 20 %).
   * Why: rc.33's patience meter demoted the top tiers every season
   * (objectives a regional king never reaches — a Major top 4 for an APAC
   * side), which kept their money near T2–T3; with fines replacing the
   * meter (7-A), a rep-90 side on a cheap squad drew full T4 money, 3–4× its
   * payroll (the harness: APAC/SSA sponsor income ×2–3 of rc.33). A
   * Major's 8th for T3 (not the region's cut, which an APAC or SSA king
   * always clears): the measured top careers bank 10–20 seasons of payroll,
   * so the brake reaches T3 too. 0.08 a point, floors 0.5 / 0.4: at 0.06 /
   * 0.6 / 0.5 the snowball p90 only fell 12.9 → 11.0 seasons of payroll.
   * Measured: the probe's C10 / C11.
   */
  levelValue: { perPoint: 0.08, floor: { 2: 0.7, 3: 0.5, 4: 0.4 } as Record<number, number> },
  /**
   * rc.34 — ECO-04, decision 4-A: the chance each word stands for. A goal is
   * picked as close as possible to its profile's `wordChance`; the ceilings
   * are sized on it. A word shows for an estimate in its band: Likely from
   * `wordMin.likely`, Even from `wordMin.even`, Stretch from
   * `wordMin.stretch` (below it a goal is never offered: never unreachable).
   * Calibrated on the harness (the probe's "deals by profile": s2 wants
   * Likely ≥ 65 %, Even 35–65 %, Stretch 15–35 %).
   */
  wordChance: { likely: 0.8, even: 0.5, stretch: 0.25 } as const,
  // rc.35 (front S): Stretch never under 0.2 (Miguel: goals must be reachable).
  wordMin: { likely: 0.66, even: 0.38, stretch: 0.2 } as const,
  /**
   * rc.34 — ECO-04 (S2): a goal comes from the team's level — its seed
   * rating (the R45 seeding's) against its region's teams — after this
   * difficulty edge in rating points (the match engine's AI shift: at an
   * equal rating the user wins 81 / 65 / 56 % of series on Easy / Normal /
   * Hard, R68), so a word means the same chance on every difficulty. Hard's
   * −1.1 is fitted on the harness (its sides reach Normal's curves about a
   * point lower); Easy's +1.5 is read off the series rates (the harness
   * does not measure Easy).
   */
  levelEdge: { easy: 1.5, normal: 0, hard: -1.1 } as Record<string, number>,
  /**
   * rc.34 — ECO-04 (S2, s2): the engine's chance model. Each curve is a
   * logistic in a rating margin (the user's rating plus `levelEdge` minus
   * the team that decides it), centred on `mid`, `scale` points wide:
   * one regional week — playing its Sunday regional at all (direct, or
   * through the Saturday qualifier) against the region's 12th org, a top 8
   * against its 8th, a top 4 against its 4th, a title against its best (K
   * of a split's three: the binomial tail); the Major against the region's
   * last Major seat; a Major top 4 or title, once qualified, against the
   * expected Major field's 4th and best. A margin reads dominance where a
   * rank cannot (a rank-1 side in a weak region). `enterEvents`: the
   * split's three regional weeks (the qualifier counts).
   * Fitted on the harness by maximum likelihood (the probe's C11 dumps:
   * about 900 splits of EU, NA, APAC and SSA, Normal and Hard, five
   * policies). No harness team reached a Major within six points of the
   * field's 4th, so the Major's top 4 and title keep a prior, steeper than
   * a regional's.
   */
  goalModel: {
    regionalReach: { mid: -4.6, scale: 2.05 },
    regionalTop8: { mid: -0.1, scale: 1.55 },
    // A top 6 sits between the top 8 and the top 4 (against the region's 6th org).
    regionalTop6: { mid: 0.1, scale: 1.55 },
    regionalTop4: { mid: 0.3, scale: 1.6 },
    regionalWin: { mid: 3.1, scale: 1.95 },
    majorQualify: { mid: 1.9, scale: 1.55 },
    majorTop4: { mid: 2, scale: 1.5 },
    majorWin: { mid: 4, scale: 1.5 },
    enterEvents: { count: 3, p: 0.95 },
  },
  /**
   * rc.34 — ECO-04, S3 (decision 1-A: fines on Balanced and Bold deals
   * only, never on Steady deals or on Easy). A missed goal's fine is the
   * profile's `fineShare` × the goal's bonus × the shortfall, at most
   * `capWeeks` weeks of the deal's weekly pay (contract range 1–4; the
   * bottom of it, for s3: a season of misses stays near two weeks of
   * payroll), booked as its own line over the next `spreadMondays` Mondays (2–6),
   * never a lump sum. `neverBreaches`: an instalment never takes the books
   * below the bank's floor — what would is waived (s4: a fine never
   * triggers a rescue). rc.34 review: the instalments book after the
   * emergency loan's deadline check, so one never decides that check.
   */
  // rc.35 (front S): capWeeks is now per profile (profiles.*.fineCapWeeks); seasonCapWeeks bounds a season's fines.
  // rc.36 (front S2, rc.34's open decision 3): `seasonCapScope` "season" carries the season's tally from the
  // deal that ended into the next decision's offers, so a run of one-split Bold deals shares one cap (rc.35
  // kept it on each deal: three Bold deals a season fined up to three caps); "deal" restores rc.35.
  fines: { capWeeks: 1, spreadMondays: 4, neverBreaches: true, seasonCapWeeks: 2, seasonCapScope: "season" as "season" | "deal" },
  /**
   * rc.36 (front S2, Miguel on rc.35: only "Decide later", no "No deal for
   * now"): what a sponsor decision's deadline does when nobody picked.
   * "hold" (Claude's pick): the deadline day holds the clock until a card is
   * signed, like every other needed decision (R71) — a Steady deal has no
   * fine, so no offer is worse than none. "signSafest": the deadline day
   * does not hold; the day after it the safest offer (the smallest fine,
   * then the most weekly pay: the Steady deal) is signed for the manager and
   * the inbox says so.
   */
  deadlineRule: "hold" as "hold" | "signSafest",
  /**
   * rc.34 — ECO-05, S7 (decision 6-B: today's money inserts stay random
   * inserts, indexed and counted against the cap). Other income — an
   * insert's fee (a showmatch, a partner's content day, a jersey shoot) —
   * at most `perSplitCap` a split (range 1–3) and `seasonShare` (5–15 %) of
   * the season's earned income (at least the season's guaranteed income, so
   * the cap is known before the prizes land). Beyond it such an insert does
   * not come. Never guaranteed: outside the statement and band b3.
   */
  otherIncome: { perSplitCap: 2, seasonShare: 0.1 },
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
    /**
     * rc.33 (RTW-02): the newcomer's path (`engine/career/reputation.ts`,
     * the rules in `newcomer` below) — a Community Cup semi-final as an
     * underdog, and a qualifier decider seeded outside the qualifying eight.
     */
    t3Semi: 1,
    qualifierDeepRun: 1,
  },
  /**
   * rc.33 (RTW-02, Miguel 30/10: "playing EU, the reputation did not rise").
   * Placements paid every point, and EU's and NA's pools out-rate a starter
   * roster: the cup seats the two closest stronger orgs (10+ up), so the
   * rating-seeded bracket ends every cup in the semi-final against seed 2,
   * and the qualifier's eight orgs end every Saturday in the Swiss — EU sat at
   * reputation 5 for two seasons (ECONOMY-CONTRACT §9). These results now pay
   * `gains.t3Semi` / `gains.qualifierDeepRun`, judged against the user's SEED:
   *  - repCeiling: only below this reputation (the org is still making its
   *    name; sponsor tier 2's gate). APAC and SSA pass it in their first
   *    season, so the easy regions gain a couple of points at most;
   *  - t3SemiMinSeed: a cup semi-final pays from this seed down (two stronger
   *    sides in the bracket); it shares CAREER_UNOFFICIAL.t3RepCapPerSplit;
   *  - deepRunWins: the qualifier's decider — this many Swiss wins, then out —
   *    pays when seeded outside CAREER_QUALIFIER.advanceSlots;
   *  - deepRunsPerSplit: at most this many deciders pay in a split (an EU
   *    starter, seed 9 over seven weaker local sides, reaches one in most
   *    qualifiers — uncapped, EU passed SAM's and NA's first season).
   * rc.32: none (repCeiling 0 turns the path off).
   */
  newcomer: { repCeiling: 25, t3SemiMinSeed: 3, deepRunWins: 2, deepRunsPerSplit: 1 },
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
 * rc.35 — THE PROGRESSION LADDER (Miguel, rc.34 feedback). One ordered
 * staircase of reputation gates mixing gear, staff, coaches and sponsor
 * access: peripherals (8) → coach hiring (CAREER_UNLOCKS.coachRep) → monitors
 * (14) → local sponsors (sponsorRep[0], rc.35 integration: 10, with the generic coach — Miguel) → tournament PCs (20) → ex-pro
 * coaches (exProCoachRep) → bootcamp (26) → challenger sponsors
 * (sponsorRep[1]) → structured bootcamp (38) → psychologist (46) → global
 * sponsors (sponsorRep[2]) → performance centre (55) → headline sponsors
 * (sponsorRep[3]). The gear/staff gates stay on CAREER_GEAR; the engine reads
 * the order in career/ladder.ts. `sponsorRep[i]` is the reputation that opens
 * sponsor ladder level i + 1 (engine/career/ladder.sponsorLadderLevelFor) —
 * the sponsor desk reads that level (front S, sponsorAccessFor).
 */
export const CAREER_LADDER = {
  /** Retired real pros on the coach shortlist are hireable from here (generic coaches from CAREER_UNLOCKS.coachRep). */
  exProCoachRep: 23,
  /** Sponsor ladder levels 1–4: local, challenger, global, headline. */
  sponsorRep: [10, 30, 50, 75] as const,
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
  /**
   * rc.34 — UX-01f, HQ-CONTRACT decision 5-A (Gate 3a, 30/10): how long a
   * bootcamp's rating edge lasts. "split": from the purchase to the next split
   * boundary (the Mondays of W11, W21 and W31, which also reset the
   * one-a-split allowance) or the season's end — every official event in
   * between plays with it, so a split's Major is its last event
   * (`FinanceState.bootcampUntil`, shown on HQ and in Finances). "event":
   * rc.33's rule, spent by the next official event. Why: Miguel asked for a
   * bootcamp that lasts a split and shows its end (ROADMAP UX-01f).
   */
  bootcampSpan: "split" as "split" | "event",
  /**
   * rc.34 — decision 5-A keeps today's edge (+0.5 / +1.0) for the whole split
   * (1). Decision 5-B, in reserve: 0.5 halves it, should the split-long camp
   * beat a coach (HQ-CONTRACT §6.5; the rc.34 measurement is in the report).
   */
  bootcampSplitEdgeShare: 1,
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
  /**
   * rc.34 (DEV-03 T4): generated coaches. The first generated candidate of a
   * window is a senior profile (t7: a good generic sits within 5 quality of
   * the best ex-pro in most windows), the rest standard. Quality is a
   * triangular draw [min, mode, max] (contract: 60–90, most around 72; rc.33
   * was a flat 62–84); experience a whole number of seasons in its range;
   * the specialty is rolled (one of the three objectives).
   */
  generated: {
    senior: { quality: [72, 80, 90] as const, experience: [3, 8] as const },
    standard: { quality: [60, 70, 84] as const, experience: [0, 5] as const },
  },
  /**
   * rc.34 (decision 5-A): an ex-pro's quality comes from his CAREER-BEST
   * club card, not the last: base + slope × (best − anchor) ± jitter,
   * clamped to range (contract: 66 + 0.8 × (peak − 75) ± 4, 64–94 — a 75
   * peak coaches near 66, a 90 near 78, a 99 near 85). He starts with
   * `experience` seasons (the playing years count), the specialty of his
   * archetype (all-rounders roll one), and costs wageMult × a generic of the
   * same quality and experience. rc.33: round(min(92, 55 + 0.25 × last card)).
   */
  exPro: {
    base: 66,
    slope: 0.8,
    anchor: 75,
    jitter: 4,
    range: [64, 94] as const,
    experience: 3,
    wageMult: 1.15,
    specialtyByArchetype: {
      mechanical: "development",
      playmaker: "preparation",
      veteranmind: "preparation",
      anchor: "recovery",
      icecold: "recovery",
    } as Record<string, "development" | "preparation" | "recovery">,
  },
  /**
   * rc.34 (T4): a coach's wage reads his quality plus wagePointsPerExperience
   * quality points per season of experience, on the coach curve
   * (economy.coachSalaryFor — CAREER_SALARY.coachFactor, the money index).
   */
  wagePointsPerExperience: 0.25,
  /**
   * rc.35 (front N, Miguel on rc.34: the veterans went broke right after
   * the first coach): the coach curve's own growth per quality point from
   * CAREER_SALARY.anchorOverall (players: growthPerPoint 1.2). On 1.2 a
   * Normal season-0 coach cost $70 a week at 72, $340 at 80 and $2,160 at
   * 90 — a senior candidate cost a third of the journeymen's whole payroll.
   * 1.12: about $65 / $165 / $520 — a good coach stays a real decision,
   * never a bankruptcy. null = rc.34 (the player curve).
   */
  wageGrowthPerPoint: 1.12 as number | null,
  /**
   * rc.34 (T4): coaches grow with relevant experience — at each rollover the
   * coach in post gains experiencePerSeason; quality +qualityPerSeason, or
   * +qualityPerSeasonMatched when most of the season's periods ran his
   * specialty, up to his personal ceiling (his quality at hire + ceilingRoom,
   * never above ceilingMax).
   */
  growth: {
    experiencePerSeason: 1,
    qualityPerSeason: 0.5,
    qualityPerSeasonMatched: 1,
    ceilingRoom: [3, 8] as const,
    ceilingMax: 95,
  },
} as const;

export const CAREER_SUB = {
  standInOverall: 60,
  standInFee: 1_000,
  /** Registered subs accrue half a split of chemistry credit per split. */
  chemistryCreditFactor: 0.5,
} as const;

/**
 * The safety net under the books. A Monday that closes below the floor is a
 * breach. rc.34 (Miguel, 31/10): a breach opens the bank's EMERGENCY LOAN
 * (`emergency`) — the identifiers still say "Backer" (backerLineFor, the
 * save's `finances.loan`), the product says "emergency loan"; rc.31–rc.33:
 * the Emergency Backer's grant.
 */
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
   * rc.34 — ECO-15 (Miguel, 31/10: "if you don't pay within X time, the career ends —
   * not too punitive"; replaces rc.33's ECO-08 breach count): the breach (a
   * Monday below the floor) that ends a career OUTRIGHT, by difficulty; null
   * = none. With null, every breach is the bank's emergency loan (the first
   * opens it, a later one while it is owed adds to it) and only the loan's
   * deadline (`emergency.deadlineWeeks`) and its caps (`emergency.maxTopUps`,
   * rc.34 review: `emergency.maxLoans`) end a career through money.
   * `hard: 1` restores "Hard ends at the first breach" (a decision for
   * Miguel); rc.33: { easy: 3, normal: 2, hard: 1 } (with deadlineWeeks null
   * everywhere: rc.33's rule exactly); rc.31: 2 everywhere.
   */
  breachesToEnd: { easy: null, normal: null, hard: null } as Record<string, number | null>,
  /**
   * rc.34 — ECO-13 (Miguel, 31/10: "when you break, you get a loan from the bank, not
   * an investor"): the emergency loan — the rescue money comes from the bank
   * (CAREER_BANK's lender; one bank, a voluntary loan and an emergency one).
   * A breach tops the balance back up to the rescue target (floorWeeks /
   * rescueToWeeks above); it is owed ×repayFactor and repaid from prizes
   * (garnishRate), sales (saleGarnishRate) and any payment from Finances.
   */
  emergency: {
    /**
     * ECO-15. Weeks from the FIRST emergency loan to the Monday it must be repaid by,
     * by difficulty; null = no deadline (rc.33). On that Monday the bank
     * takes what it is owed when the books stay at or above the floor after
     * paying it (rc.34 review: `economy.canSettleLoan`, the same test as
     * "Pay it all" — the overdraft counts); otherwise the career ends. A
     * later breach while it is owed adds to the loan and never moves the
     * deadline. The wizard's money line reads it (`economy.moneyRuleFor`).
     * Easy two seasons, Normal a season and a half, Hard three splits (a
     * season is 32 weeks, 3 splits). Measured (rc.34, 84 careers): with
     * 32 / 24 / 16 no rescued bot career ever covered its debt on the day —
     * the careers that recovered under rc.33's Backer took 1.5–2 seasons
     * (sales and cheaper renewals) to bring the debt down, so a shorter term
     * turned every rescue into a delayed end.
     */
    deadlineWeeks: { easy: 64, normal: 48, hard: 24 } as Record<string, number | null>,
    /**
     * The Mondays before the deadline the bank warns (a mail and the money
     * notice), largest first. rc.34 review: + the last week (1) — after the
     * 4-week warning nothing spoke until the deadline itself.
     */
    warnWeeks: [8, 4, 1] as readonly number[],
    /**
     * rc.34 review: inside this many weeks of the deadline the bank re-reads
     * the projection every day ("covered" = the books on the deadline Monday,
     * the weekly burn counted) and sends a notice and a mail the day it flips
     * from covered to not covered (nothing is locked while owing, so a late
     * fee or purchase can flip it). 0 = off.
     */
    slipWatchWeeks: 4,
    /**
     * rc.34 review: emergency loans the bank opens in a whole career, by
     * difficulty (a top-up is not a new loan); null = no cap. Once the last
     * one is repaid — on its deadline or before — the next Monday below the
     * floor ends the career (announced by every warning first, like the
     * top-up cap). Why: a loan paid on its deadline into the overdraft broke
     * the floor again and opened a fresh loan with a fresh term, so the
     * deadline could be rolled over forever. 3 / 2 / 1 follow rc.33's
     * breaches 3 / 2 / 1 one rescue gentler ("not too punitive").
     */
    maxLoans: { easy: 3, normal: 2, hard: 1 } as Record<string, number | null>,
    /**
     * Breaches while the loan is owed that the bank tops up (each adds to the
     * debt, the deadline stays); the next one ends the career. null = no cap.
     * 3: a burn three weeks of wages deep every week still reaches the
     * deadline on Normal; only a spiral faster than that ends earlier.
     */
    maxTopUps: 3 as number | null,
  },
  /**
   * rc.34 — ECO-13 (Miguel, 31/10: "the investor can come in with the first loan,
   * helping lightly with the monthly income — not much"): today's rescue
   * partner becomes the investor. It joins only the career's FIRST emergency
   * loan, on the difficulties with a share here (null = none; Easy only, as
   * decided 30/10 — Miguel can extend it), and from the next Monday pays
   * `payrollShare` × the weekly wage bill booked on that Monday (squad +
   * coach), fixed for its run, for `weeks` Mondays — about a split (8 event
   * weeks + the 2-week window). Its own ledger line ("rescuePartner"), in the
   * loan's notice and mail and in Finances while it runs. Never garnished.
   * rc.33: the rescue partner, 50 % for 10 Mondays at Easy's first breach.
   */
  investor: {
    payrollShare: { easy: 0.2, normal: null, hard: null } as Record<string, number | null>,
    weeks: 10,
  },
  /**
   * rc.34 — ECO-14 (Miguel, 31/10: "remove the rule that you cannot buy players while
   * you owe"): false = nothing is locked while the emergency loan is owed —
   * transfer fees, signings, gear, a coach and the psychologist are all
   * open; the floor ("funds") still applies to each. true restores rc.33's
   * lock: no transfer fees or gear, and no signing, coach hire or
   * psychologist that shortens the runway ("loanRunway"; a free agent into an
   * empty starting seat always allowed). The bank's voluntary loan stays one
   * debt at a time (CAREER_BANK.blockedWhileBacker).
   */
  lockCommitments: false,
  /** What the bank wants back for each emergency dollar (the loan's interest, on the principal). */
  repayFactor: 1.2,
  /** The slice of the org's part of every prize that repays the emergency loan, by difficulty. */
  garnishRate: { easy: 0.1, normal: 0.15, hard: 0.2 } as Record<string, number>,
  /**
   * v0.3 debt-lock fix: while the emergency loan (rc.33: the Backer) is
   * owed, HALF of every player sale repays it, and the Finances screen can
   * pay any amount down manually at any time.
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
  /**
   * rc.33 — UX-07 (the expanded balance chart; HQ-CONTRACT decision 4-A):
   * the Monday balances a save keeps, a ring of the last this-many Mondays
   * (three seasons of 32 weeks, a few KB), recorded by the Monday funnel
   * once per Monday. The Finances chart draws it; nothing is invented for
   * the weeks before a save started recording.
   */
  balanceRingWeeks: 96,
} as const;

/**
 * rc.34 — UX-01 / UX-06 (HQ-CONTRACT, Gate 3a approved 30/10: HQ 1-B, 2–7 A):
 * HQ around the next decision, the contract reminders and the HQ finance
 * tile. The queue itself is `store/careerDecisions.ts` (pendingDecisionsOf).
 */
export const CAREER_HQ = {
  /**
   * Decision 1-B: the decision kinds that offer "Later" — bids and sponsor
   * offers, up to their deadline day, when the clock stops again until they
   * are answered. Every other needed decision holds the clock until answered
   * (like the weekly insert). Why: Miguel's 30/10 answer to HQ-CONTRACT §6.1.
   */
  laterKinds: ["bid", "sponsor"] as readonly string[],
  /**
   * UX-06b: from this week of a contract's final season the HQ squad card
   * warns (the time left), the contract counts as an urgent "New" item and
   * the Squad tab carries its dot. W23 = the final split, the week the old
   * telegraph mail already went out. Why: rc.33 had one warning at week 23.
   */
  contractWarnFromWeek: 23,
  /**
   * UX-06b: the reminders before a player can leave — a news line and a mail
   * on the Monday of each week listed, naming who is still out of contract
   * and the weeks left (W23 keeps rc.33's first telegraph). W28: a month
   * before the season ends; W31: the last window, the last Monday before the
   * season review. The explicit review then holds the rollover.
   */
  contractReminderWeeks: [28, 31] as readonly number[],
  /**
   * HQ-CONTRACT H5 (decision 4-A): the Monday balances the HQ finance tile
   * draws in its small line (the last 12 Mondays the save recorded); a tap
   * opens rc.33's chart with the whole ring (CAREER_PAYROLL.balanceRingWeeks).
   */
  tileChartWeeks: 12,
} as const;

/**
 * v2.0 BANK LOAN (R21) — the voluntary loan, the player-initiated
 * alternative to the emergency one (rc.34: the same bank writes both;
 * CAREER_LOAN.emergency). One loan at a time, sized by reputation tier,
 * repaid in equal weekly instalments over `termWeeks` with a flat
 * `interestPct` on top. Taking one never ends the career; missing payments
 * just drains the balance (the floor and the emergency loan still apply).
 */
export const CAREER_BANK = {
  /** Max principal by reputation tier (repTierOf → 0..4). */
  maxByRepTier: [6_000, 12_000, 25_000, 50_000, 90_000] as const,
  minAmount: 1_000,
  interestPct: 0.12,
  termWeeks: 16,
  /**
   * No voluntary loan while the emergency loan (rc.33: the Backer's debt) is
   * open — one debt at a time, and a voluntary loan cannot refinance the
   * emergency one past its deadline.
   */
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
  /**
   * rc.33 (RTW-03, Miguel 30/10 — the answer to C-1: "a region may hold more
   * than 16 orgs, or an org without a lineup leaves; either is fine"). How a
   * real org whose first lineup is this season finds its seat at the rollover
   * (`worldSim.realOrgIntake`):
   *  - "everyOrg": the region's weakest filler org (R31); with no filler
   *    left, the weakest org whose history is over (no lineup this season or
   *    any later career season) leaves and the entrant takes its seat; with
   *    neither, the region grows past minOrgsPerRegion (its events still
   *    field 16 by the existing seeding). Every org enters its history:
   *    Karmine Corp, Gentle Mates, MIBR, Cloud9…
   *  - "fillersOnly": rc.32 — fillers only, so EU (no filler at creation)
   *    never saw its 23 later orgs, nor SAM 28 of 31 and NA 6 of 10.
   */
  orgIntake: "everyOrg" as "everyOrg" | "fillersOnly",
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
   * rc.33 (BAL-04): kept, Claude's call (30/10) — see fillerCapMargin.
   */
  fillerCapToBestReal: true,
  /**
   * rc.33 (BAL-04, the filler cap left to Claude 30/10): how far above the
   * region's best real lineup a filler org may rate. 0 = R59's cap, kept:
   * measured on APAC and SSA (Normal and Hard, three policies, three
   * seasons), a 1-point margin moved nothing (first Major by S2 in every
   * career either way, series won 66–73 % vs 61–74 %), and rc.31's uncapped
   * world was the opposite cliff (0 % first Major by S2). The soft road's
   * runaway is money and reputation (ECONOMY-CONTRACT M6 lever 3), not this.
   */
  fillerCapMargin: 0,
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
  /**
   * rc.35 (front C, Miguel on rc.34): every region's creation free-agent pool
   * holds at least `perRegion` players of potential `minPotential` or more
   * (worldSim `addCreationFaProspects`; the rookies' intake brings more from
   * the first rollover on). `scanLimit` bounds the filler ids it tries.
   */
  creationFaProspects: { perRegion: 2, minPotential: 81, scanLimit: 400 },
  /**
   * rc.35 (front C, Miguel on rc.34: "no prospect above 86"): one of the
   * three Prospects founders (a seeded pick) is the headliner, his potential
   * drawn in `potentialRange` (the other two keep 80–90). His overall stays
   * the offer's 65–67, so the gap is years of growth, not a ready star.
   */
  prospectHeadliner: { potentialRange: [91, 93] as const },
  /**
   * rc.33 (RTW-04, Miguel 30/10: "fewer known players without a team — it
   * should happen, but much less often"). The creation free-agent pool takes
   * a real player with no Season X card only if his last club card is at
   * most this many dataset seasons before Season X, or he plays again later.
   * An older career was over by 2020-21: rc.32 seeded 72 such players (44
   * rated 80+, some last seen in Season 1) at their peak, and the first
   * window's scavenger pass signed them onto active rosters, pushing about
   * 20 active Season X pros into free agency. null = rc.32 (all of them).
   */
  creationFreeAgentRecentSeasons: 1 as number | null,
  /**
   * rc.33 (RTW-04): at each rollover into a dataset season, a real free agent
   * whose history is over (no club card that season or later — the anchor
   * pass pushed him out when his real org moved on) leaves the scene with
   * this chance, like the pros who left it. Without it the pool kept every
   * one of them and grew each season (rc.32: 55 real free agents at S0, 107
   * by S5). 0 = rc.32 (they stay until the age window retires them).
   */
  historyOverFreeAgentLeaveChance: 0.5,
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
  /**
   * rc.36 — UX-03 (R87): who presents the news desk. "wire" = the game's own
   * "The Wire"; "fiftyFifty" = the 50/50 presentation (its name, logo slot
   * and credit line). It stays "wire" until the partner agrees on material,
   * naming and credit; the headlines are the game's own either way (never a
   * quote put in the partner's mouth).
   */
  brand: "wire" as "wire" | "fiftyFifty",
  /** The feed's lead story: the most important headline (newest on a tie) of at least this priority… */
  leadMinPriority: 1,
  /** …from the last this-many days (older news reads as rows only). */
  leadMaxAgeDays: 7,
  /** A beat that runs as archive (its history did not happen in this save) files at this priority. */
  archivePriority: 1,
} as const;

/**
 * rc.36 — UX-02 (R87): the board's season goal. Set once at the season's
 * start (the rollover, or the founding day) from the squad's level against
 * its region's field (sponsorDeals.teamLevelFor: the rating, the region, the
 * difficulty edge), the career's stage, its resources and last season's
 * goal; never moved by a result. A goal counts over the whole season — the
 * cups, the nine regionals, the three Majors, Worlds — and its deadline is
 * the last event that can count. Measured on CAREER_GOALS=1
 * (`careerSeasonGoals.probe.test.ts`, 252 seasons: 7 regions × 3 presets ×
 * 3 policies × 4 seasons; GOALS_FIT replays these settings): target met
 * 63 % (Easy 70, Normal 56, Hard 63), stretch 29 % (37 / 23 / 29) — rc.35's
 * any-split rule met 94 % and 88 % on the same seasons.
 */
export const CAREER_SEASON_GOAL = {
  /**
   * "season" (rc.36): a season-scope goal sized to the bands below. "anySplit"
   * (rc.35, R82 b): the target a Balanced deal sets for one split, met if
   * reached in any split — measured too easy (see R87), kept for comparison.
   */
  rule: "season" as "season" | "anySplit",
  /** The target's aimed chance by the career's stage: the founding season, a rising org, an established one. */
  targetAim: { founding: 0.6, rising: 0.56, established: 0.52 },
  /** Reputation from which a career counts as established (the sponsor ladder's level 2). */
  establishedRep: 40,
  /** Past results: last season's target met asks a little more; missed eases. */
  afterMetShift: -0.03,
  afterMissShift: 0.05,
  /** Resources: a tight runway (or an emergency loan owed) eases the aim; a long one raises it. */
  tightRunwayWeeks: 8,
  tightShift: 0.04,
  flushRunwayWeeks: 26,
  flushShift: -0.02,
  /** The aim after the shifts stays inside this range. */
  aimClamp: { min: 0.45, max: 0.68 },
  /** A target is picked inside this band of the model's chance (never trivial, never impossible). */
  targetBand: { min: 0.4, max: 0.75 },
  /**
   * The stretch: aimed here, inside its band, and at least `stretchGap` less
   * likely than the target (a target always leaves room for one). 0.17, not
   * the band's middle: the model's low chances come in high (squads grow).
   */
  stretchAim: 0.17,
  stretchBand: { min: 0.1, max: 0.35 },
  stretchGap: 0.15,
  /** The counts a goal may ask, of the season's nine regionals and three Majors. */
  regionalCounts: [1, 2, 3, 5, 7] as readonly number[],
  majorCounts: [1, 2, 3] as readonly number[],
  /** Worlds is decided on Season Points; the model reads it as this many of the three Majors qualified. */
  worldsFromMajors: 2,
  /**
   * Season form: a squad grows through the season (CAREER_GOALS: +4.3 rating
   * points p50 from the start to the review, p10 0.6, p90 8.9), so the
   * season-start level under-reads its regionals and Majors. The league
   * goals read the level this many points higher — the likelihood's optimum
   * lies at 1.5–2 on the probe's seasons; at 1.5 the model's 0.49 is reached
   * 0.55 of the time (0.75 unshifted).
   */
  seasonForm: 1.5,
  /**
   * Playing a Sunday regional, read over a season: one regional week, the
   * margin over the Saturday qualifier's line (the region's 16th org —
   * CAREER_QUALIFIER direct + advancing; seasonForm added). The sponsors'
   * per-split curve on the 12th org read EU's deep pool and the smaller
   * regions' local sides alike (EU's weak squads 0–25 % where it said 50 %).
   * Maximum likelihood on the probe's seasons.
   */
  reachCurve: { mid: -2, scale: 4.5 },
  /**
   * The newcomer's rung: Community Cup finals and titles (a squad that cannot
   * reach a Sunday regional yet still has a season to win). Offered while the
   * squad is cup-eligible (CAREER_UNOFFICIAL.t3RatingCeiling). A cup seats
   * the two closest stronger orgs (t3MaxStrongerTeams): the semi-final is
   * against the closer one, the final against the other; the quarter-final
   * against a side `cupQuarterMargin` points weaker. One series is a
   * logistic in the margin (+ CAREER_SPONSOR.levelEdge), fitted on rc.35's
   * series by rating gap (CAREER-ARC-rc35: Normal 1 / 17 / 66 / 96 % at
   * ≤ −6 / −4 / even / +4).
   */
  cupCounts: [1, 2, 3] as readonly number[],
  cupWinCounts: [1, 2] as readonly number[],
  cupsPerSeason: 6,
  cupQuarterMargin: 3,
  cupSeries: { mid: -1.2, scale: 1.8 },
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
   *
   * rc.33 (BAL-04, Miguel 30/10: "Normal felt a bit easy"; the retune left to
   * Claude). Measured on the arc harness's yardstick — Bo5 series between
   * sides of EQUAL team rating (chemistry, coach and gear included, the AI
   * shift left out) — the presets ran 84.7 / 70.5 / 56.2 %: R59's 81 / 65 %
   * for Easy and Normal had been read with the user a little below his
   * opponent, so at an even rating Normal gave a 1.55-point edge, not the
   * "fair matches" its sentence promises. Easy's shift −2 → −1.6 and
   * Normal's −1.05 → −0.6 put the ladder at R59's numbers on that yardstick:
   * 81.4 / 65.2 / 56.2 %. Hard's R59 values are confirmed (at its intent).
   */
  match: {
    easy: {
      userRollRange: [-3, 5] as const,
      aiRollRange: [-4, 4] as const,
      chemistryMaxBonus: 1.3,
      opponentChemistryMaxBonus: 1.3,
      opponentRatingShift: -1.6,
    },
    normal: {
      userRollRange: [-3, 4] as const,
      aiRollRange: [-4, 4] as const,
      chemistryMaxBonus: 2,
      opponentChemistryMaxBonus: 2,
      opponentRatingShift: -0.6,
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
