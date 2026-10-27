/**
 * Lightweight dataset counts for surfaces that only need totals (the home menu
 * denominators: "x/89 unlocked"). Importing the full `@/data` barrel pulls in
 * nine datasets and lookup-map construction —
 * overkill for two integers. This reads only the two hand-maintained JSON files
 * it counts, so the numbers always match the real data with no build step.
 */
import specialCards from "./specialCards.json";
import achievements from "./achievements.json";

/**
 * National-team cards (v2.0) are DERIVED in @/data with this id prefix. They
 * form their own album, so the special-card counters (home, profile,
 * achievements, cosmetics) skip them — checkable from an id alone.
 */
export const NATIONAL_SPECIAL_PREFIX = "nt-";
export const isNationalSpecialId = (id: string): boolean => id.startsWith(NATIONAL_SPECIAL_PREFIX);

export const COUNTS = {
  specialCards: (specialCards as unknown[]).length,
  achievements: (achievements as unknown[]).length,
} as const;
