/**
 * Zod schemas for every JSON data file.
 *
 * Purpose: the dataset is hand-edited (and later API-generated). These schemas
 * turn a typo in a JSON file into a clear error message in CI
 * (`npm run validate:data` → `validateDataset()` in ./validate.ts) instead of
 * a silent gameplay bug. See docs/DATA-GUIDE.md.
 *
 * BUILD/TEST-TIME ONLY: never import this from app/client code (that would
 * ship zod to the browser again) — integrity.test.ts enforces it. A key the
 * JSON carries but a schema doesn't declare is STRIPPED by zod, and the same
 * test fails until it is declared here (+ engine/types.ts) or stripped in
 * ./index.ts, so runtime data and validated data never drift apart.
 */

import { z } from "zod";

export const regionSchema = z.enum(["NA", "EU", "SAM", "MENA", "OCE", "APAC", "SSA"]);

export const statKeySchema = z.enum([
  "offense",
  "defense",
  "mechanics",
  "consistency",
  "experience",
  "clutch",
]);

export const buffLevelSchema = z.enum(["~", "+", "++", "+++"]);

// Floor 50: the imported dataset rates bench/staff players down to 50
// (which is also the "vacant slot" value).
const overallSchema = z.number().int().min(50).max(99);

export const statsSchema = z
  .object({
    offense: overallSchema,
    defense: overallSchema,
    mechanics: overallSchema,
    consistency: overallSchema,
    experience: overallSchema,
    clutch: overallSchema,
  })
  .partial();

export const playerSchema = z.object({
  id: z.string().min(1),
  nickname: z.string().min(1),
  realName: z.string().optional(),
  country: z.string().length(2).optional(),
  /** v2.0: real birth date (YYYY-MM-DD) — the career's real age. */
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  region: regionSchema,
});

export const seasonSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  year: z.string().min(4),
  /** Chronological position (1 = RLCS S1) — drives era-logo resolution. */
  order: z.number().int().min(1),
});

export const playerCardSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().min(1),
  orgId: z.string().min(1),
  lineupId: z.string().min(1),
  seasonId: z.string().min(1),
  overall: overallSchema,
  manualAdjustment: z.number().int().min(-5).max(5),
  stats: statsSchema.optional(),
  imageUrl: z.string().optional(),
});

export const orgSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: regionSchema,
  buffType: statKeySchema,
  buffLevel: buffLevelSchema,
  logoUrl: z.string().optional(),
  /**
   * Era logos: cards/lineups from a season with order <= untilOrder use
   * public/orgs/<orgId>@<key>.png (e.g. NRG's classic shield). Entries are
   * checked in array order; no match → the default <orgId>.png.
   */
  logoEras: z
    .array(z.object({ key: z.string().min(1), untilOrder: z.number().int().min(1) }))
    .optional(),
});

export const coachCardSchema = z.object({
  id: z.string().min(1),
  personId: z.string().min(1),
  name: z.string().min(1),
  country: z.string().length(2).optional(),
  region: regionSchema.optional(),
  orgId: z.string().min(1),
  lineupId: z.string().min(1),
  seasonId: z.string().min(1),
  overall: overallSchema,
  bonusType: statKeySchema,
  bonusLevel: buffLevelSchema,
  generic: z.boolean().optional(),
});

export const subCardSchema = z.object({
  id: z.string().min(1),
  personId: z.string().min(1),
  name: z.string().min(1),
  country: z.string().length(2).optional(),
  region: regionSchema,
  orgId: z.string().min(1),
  lineupId: z.string().min(1),
  seasonId: z.string().min(1),
  overall: overallSchema,
  stats: statsSchema.optional(),
});

export const lineupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  seasonId: z.string().min(1),
  orgId: z.string().min(1),
  region: regionSchema,
  playerCardIds: z.tuple([z.string(), z.string(), z.string()]),
  coachId: z.string().optional(),
  subId: z.string().optional(),
  orgBuffLevel: buffLevelSchema.optional(),
  /** Region-only roster (any region since v2.0) — the general draft hides it. */
  samOnly: z.boolean().optional(),
  /** Easter-egg lineup drawn far less often (DRAFT.easterEggChance). */
  rareSpawn: z.boolean().optional(),
  /** National team (v2.0, FIFAe season): special draw, all-special cards. */
  national: z.boolean().optional(),
  historicalStrength: z.enum(["elite", "strong", "solid", "underdog"]),
});

export const specialEffectSchema = z.object({
  type: z.enum([
    "attribute_boost",
    "team_attribute_boost",
    "clutch_boost",
    "swiss_consistency",
    "playoff_experience",
    "upset_boost",
    "defense_stability",
    "high_roll",
  ]),
  attributes: z.array(statKeySchema).optional(),
  // Cap 7 (v1.4): the secret Creator card sits at the ceiling; normal specials stay ≤5.
  value: z.number().min(0).max(7),
  /** Flat team-overall bonus (Creator card); separate from the attribute boost. */
  overallBonus: z.number().min(0).max(7).optional(),
  description: z.string().min(1),
});

export const specialCardSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["player", "coach"]).optional(),
  playerId: z.string().min(1),
  baseCardId: z.string().min(1),
  title: z.string().min(1),
  // "national" is DERIVED at load time from the national lineups (@/data), never
  // hand-written in specialCards.json — the file schema below rejects it.
  cardType: z.enum(["moment", "major_mvp", "worlds_mvp", "season_mvp", "mythic", "legend", "coach", "national"]),
  rarity: z.enum(["rare", "epic", "mythic", "legendary", "creator", "wings", "community", "national"]),
  overall: overallSchema,
  stats: statsSchema.optional(),
  effect: specialEffectSchema,
  flavor: z.string().min(1),
  imageUrl: z.string().optional(),
  /** Event-exclusive window (v2.0): UTC dates, inclusive, from <= to. */
  event: z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      huntRuns: z.number().int().min(0).max(100).optional(),
    })
    .refine((e) => e.from <= e.to, { message: "event.from must be <= event.to" })
    .optional(),
});

export const achievementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  xp: z.number().int().min(0),
  /** Rarity tier — drives the visual style (achievementStyle). */
  category: z.enum(["common", "rare", "epic", "legend"]),
  /** Grouping bucket on the achievements screen (v1.4). */
  group: z.enum([
    "milestone",
    "mode",
    "performance",
    "chemistry",
    "roster",
    "collection",
    "progression",
  ]),
  secret: z.boolean().optional(),
});

// Challenges (v1.4) — hand-authored rank-unlocked puzzles. Like specialCards.json
// and achievements.json, this file is curated by hand (not generated). Cross-refs
// (opponentLineupId, rankRequired, prereq, fixedPlayerCardId, reward.specialId)
// are checked against the dataset by assertReferentialIntegrity in ./validate.ts.
export const challengeConstraintSchema = z
  .object({
    maxPlayerOverall: overallSchema.optional(),
    region: regionSchema.optional(),
    seasonId: z.string().min(1).optional(),
    country: z.string().length(2).optional(),
    noSpecials: z.boolean().optional(),
  })
  .strict();

export const challengeStarSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("noSpecials") }).strict(),
  z.object({ kind: z.literal("sweep"), maxLosses: z.number().int().min(0).max(3) }).strict(),
  z.object({ kind: z.literal("maxOverall"), max: overallSchema }).strict(),
  z.object({ kind: z.literal("chemistry"), tier: z.enum(["Good", "Great", "Perfect"]) }).strict(),
  z.object({ kind: z.literal("underdog") }).strict(),
  z.object({ kind: z.literal("maxRerolls"), max: z.number().int().min(0).max(10) }).strict(),
  z.object({ kind: z.literal("goals"), min: z.number().int().min(1).max(80) }).strict(),
  z.object({ kind: z.literal("concede"), max: z.number().int().min(0).max(30) }).strict(),
  z.object({ kind: z.literal("noLosses") }).strict(),
  z.object({ kind: z.literal("sameRegion") }).strict(),
  z.object({ kind: z.literal("sameSeason") }).strict(),
]);

export const challengeSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    brief: z.string().min(1),
    /** Unlocks at this rank id (see RANKS in balance.ts). */
    rankRequired: z.string().min(1),
    /** Optional: a challenge id that must be cleared first (difficulty chain). */
    prereq: z.string().min(1).optional(),
    /** The FIXED boss lineup the player drafts against (from lineups.json). */
    opponentLineupId: z.string().min(1),
    /** Optional: a player card pre-placed in the roster to build around. */
    fixedPlayerCardId: z.string().min(1).optional(),
    /** Visual family (reuses the achievement style tiers). */
    tier: z.enum(["common", "rare", "epic", "legend"]),
    /** Deterministic per-challenge seed → a solvable, repeatable puzzle. */
    seed: z.number().int().nonnegative(),
    sim: z.object({
      difficulty: z.enum(["easy", "normal", "hard", "legacy"]),
      // v1.4: every challenge series is a Best-of-7 (enforced so authors can't regress).
      bestOf: z.literal(7),
      /** Per-challenge boss balance knob (v1.4): flat rating delta on the boss,
       *  on top of the difficulty shift. Negative = handicap. */
      opponentShift: z.number().optional(),
    }),
    constraint: challengeConstraintSchema.optional(),
    reward: z.object({
      xp: z.number().int().min(0),
      /** Optional cosmetic "cleared" badge id (free-form, for future use). */
      badge: z.string().min(1).optional(),
      /** Optional hand-authored special granted on clear (bypasses the rank gate). */
      specialId: z.string().min(1).optional(),
    }),
    /** v2.0: "boss" (default) or "gauntlet" (stages before the boss). */
    kind: z.enum(["boss", "gauntlet"]).optional(),
    gauntlet: z
      .object({
        lineupIds: z.array(z.string().min(1)).min(1).max(4),
        bestOf: z.union([z.literal(5), z.literal(7)]),
      })
      .strict()
      .optional(),
    /** v2.0: the two extra stars (star 1 = the clear). */
    stars: z.tuple([challengeStarSchema, challengeStarSchema]).optional(),
  })
  .strict()
  .refine((c) => (c.kind === "gauntlet") === Boolean(c.gauntlet), {
    message: "kind \"gauntlet\" needs `gauntlet`, and vice-versa",
  });

export const playersFileSchema = z.array(playerSchema);
export const seasonsFileSchema = z.array(seasonSchema);
export const playerCardsFileSchema = z.array(playerCardSchema);
export const orgsFileSchema = z.array(orgSchema);
export const coachesFileSchema = z.array(coachCardSchema);
export const subsFileSchema = z.array(subCardSchema);
export const lineupsFileSchema = z.array(lineupSchema);
export const specialCardsFileSchema = z.array(
  specialCardSchema.refine((sp) => sp.rarity !== "national" && sp.cardType !== "national", {
    message: "national cards are derived from the national lineups (@/data) — don't hand-write them",
  }),
);
export const achievementsFileSchema = z.array(achievementSchema);
export const challengesFileSchema = z.array(challengeSchema);
