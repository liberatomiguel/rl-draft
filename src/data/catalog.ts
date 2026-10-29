/**
 * Light catalog (rc.26, #60): the lookups the SHARED path needs — the root
 * layout (profile store, achievement toasts, cosmetic unlock pop-up) and the
 * light pages — without the `@/data` barrel, whose dataset chunk (~62 KB gz)
 * only the game pages load.
 *
 * It reads the small hand-maintained JSONs plus `nationalSpecialIds.json`, the
 * national-card ids that `@/data` derives at load time, written next to the
 * dataset by `npm run build:data` (integrity.test.ts asserts the two agree).
 * `@/data` re-exports the achievement and challenge exports from here, so a
 * page that loads both holds one copy of each.
 */

import achievementsJson from "./achievements.json";
import challengesJson from "./challenges.json";
import specialCardsJson from "./specialCards.json";
import nationalSpecialIdsJson from "./nationalSpecialIds.json";
import type { AchievementDef, Challenge } from "@/engine/types";

/** Id → record. Duplicate ids are rejected by `validateDataset()` in CI; the
 *  throw here is a free last-resort guard (we iterate to build the map anyway). */
export function toMap<T extends { id: string }>(label: string, items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) {
      throw new Error(`[data] Duplicate id "${item.id}" in ${label}.json`);
    }
    map.set(item.id, item);
  }
  return map;
}

export const achievements = achievementsJson as AchievementDef[];

export const challenges = challengesJson as Challenge[];

export const achievementById = toMap("achievements", achievements);
export const challengeById = toMap("challenges", challenges);

/**
 * Every special id that exists: the curated catalogue plus the derived
 * national-team cards — the keys of `specialCardById` in `@/data`, without
 * building the cards. The profile store prunes saved specials against it.
 */
export const specialCardIds: ReadonlySet<string> = new Set([
  ...(specialCardsJson as { id: string }[]).map((sp) => sp.id),
  ...(nationalSpecialIdsJson as string[]),
]);

const specialRarities = new Map(
  (specialCardsJson as { id: string; rarity: string }[]).map((sp) => [sp.id, sp.rarity]),
);

/**
 * A special's rarity without the barrel (OBS-01 `special_discovered`): the
 * curated catalogue's own, "national" for the derived national-team cards
 * (the `nt-` ids `@/data` builds with that rarity), null for an unknown id.
 */
export function specialRarityOf(id: string): string | null {
  return specialRarities.get(id) ?? (specialCardIds.has(id) ? "national" : null);
}
