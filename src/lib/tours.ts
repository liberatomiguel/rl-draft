/**
 * Guided tours: which one a player has already seen (rc.54).
 *
 * Every tour is shown ONCE after the Season 1 reset, to a new player and to a
 * pre-season veteran alike, and never again. The marker is `profile.tours`
 * (tour id → the `SEASON.id` it was seen in): additive, optional, absent = not
 * seen. The older one-shot flags (`flags.seenTutorial`, `seenHowToPlay`,
 * `seenDraftTour`, the career save's `flags["tour.<chapter>"]`) do NOT count:
 * a veteran who carries them still gets each tour once.
 *
 * Pure (no React, no store): the stores and the tour components call it.
 */

import { SEASON } from "@/config/season";

/** The draft's first-run tour. */
export const DRAFT_TOUR = "draft";

/** A Road to Worlds chapter's tour id. */
export const careerTourId = (chapter: string): string => `career.${chapter}`;

/**
 * The season whose reset re-armed the tours. A marker from that season or a
 * later one means "seen". To show the tours again after a future reset, set
 * this to that season's id (the markers written before it stop counting).
 */
export const TOURS_REARMED_IN = 1;

export type ToursSeen = Record<string, number>;

/** True once the player has finished or skipped this tour since the reset. */
export function tourSeen(tours: ToursSeen | undefined | null, id: string): boolean {
  const season = tours?.[id];
  return typeof season === "number" && season >= TOURS_REARMED_IN;
}

/** The marker with this tour stamped as seen in the current season. */
export function withTourSeen(tours: ToursSeen | undefined | null, id: string): ToursSeen {
  return { ...(tours ?? {}), [id]: SEASON.id };
}
