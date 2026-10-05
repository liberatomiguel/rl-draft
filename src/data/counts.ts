/**
 * Lightweight dataset counts for surfaces that only need totals (the home menu
 * denominators: "x/89 unlocked"). Importing the full `@/data` barrel pulls in
 * nine datasets and lookup-map construction —
 * overkill for two integers. This reads only the two hand-maintained JSON files
 * it counts, so the numbers always match the real data with no build step.
 */
import specialCards from "./specialCards.json";
import achievements from "./achievements.json";

export const COUNTS = {
  specialCards: (specialCards as unknown[]).length,
  achievements: (achievements as unknown[]).length,
} as const;
