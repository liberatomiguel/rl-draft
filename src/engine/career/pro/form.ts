/**
 * v2.2 Pro (PRO-SPEC §4.3, R150): form. Confidence is the mean of the last
 * official match ratings, centred and clamped to ±2; it enters the Pro's own
 * match rating, the ranked game and the key decision (slice 5). Pure.
 */

import { CAREER_PRO_WEEK } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { ProPlayer } from "./types";

const C = CAREER_PRO_WEEK.confidence;

/** −2..+2 in tenths from a list of 0-10 ratings; 0 with none yet. */
export function confidenceOf(ratings: readonly number[]): number {
  if (ratings.length === 0) return 0;
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return Math.round(clamp((mean - C.center) / C.perPoint, -C.max, C.max) * 10) / 10;
}

/** The player with one more match rating on record (a new object), confidence updated. */
export function withRating(player: ProPlayer, rating: number): ProPlayer {
  const recentRatings = [...(player.recentRatings ?? []), clamp(rating, 0, 10)].slice(-C.window);
  return { ...player, recentRatings, confidence: confidenceOf(recentRatings) };
}

/** What confidence adds to (or takes from) the Pro's own match rating. */
export function ratingBonusOf(confidence: number): number {
  return Math.round(confidence * CAREER_PRO_WEEK.ratingBonusPerConfidence * 100) / 100;
}

/** Energy at or under the tired line. */
export function isTired(energy: number): boolean {
  return energy < CAREER_PRO_WEEK.lowEnergy;
}
