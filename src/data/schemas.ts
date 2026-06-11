/**
 * Zod schemas for every JSON data file.
 *
 * Purpose: the dataset is hand-edited (and later API-generated). These schemas
 * turn a typo in a JSON file into a clear error message at startup instead of
 * a silent gameplay bug. See docs/DATA-GUIDE.md.
 */

import { z } from "zod";

export const regionSchema = z.enum(["NA", "EU", "SAM", "MENA", "OCE", "APAC"]);

export const statKeySchema = z.enum([
  "offense",
  "defense",
  "mechanics",
  "consistency",
  "experience",
  "clutch",
]);

export const buffLevelSchema = z.enum(["~", "+", "++", "+++"]);

const overallSchema = z.number().int().min(60).max(99);

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
  country: z.string().length(2),
  region: regionSchema,
});

export const seasonSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  year: z.string().min(4),
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
  country: z.string().length(2),
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
  historicalStrength: z.enum(["elite", "strong", "solid", "underdog"]),
});

export const specialEffectSchema = z.object({
  type: z.enum([
    "clutch_boost",
    "swiss_consistency",
    "playoff_experience",
    "upset_boost",
    "defense_stability",
    "high_roll",
  ]),
  value: z.number().min(0).max(5),
  description: z.string().min(1),
});

export const specialCardSchema = z.object({
  id: z.string().min(1),
  playerId: z.string().min(1),
  baseCardId: z.string().min(1),
  title: z.string().min(1),
  cardType: z.enum(["moment", "major_mvp", "worlds_mvp", "mythic", "legend"]),
  rarity: z.enum(["rare", "epic", "mythic", "legendary"]),
  overall: overallSchema,
  stats: statsSchema.optional(),
  effect: specialEffectSchema,
  flavor: z.string().min(1),
  imageUrl: z.string().optional(),
});

export const achievementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  xp: z.number().int().min(0),
});

export const playersFileSchema = z.array(playerSchema);
export const seasonsFileSchema = z.array(seasonSchema);
export const playerCardsFileSchema = z.array(playerCardSchema);
export const orgsFileSchema = z.array(orgSchema);
export const coachesFileSchema = z.array(coachCardSchema);
export const subsFileSchema = z.array(subCardSchema);
export const lineupsFileSchema = z.array(lineupSchema);
export const specialCardsFileSchema = z.array(specialCardSchema);
export const achievementsFileSchema = z.array(achievementSchema);
