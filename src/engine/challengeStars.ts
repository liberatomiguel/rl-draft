/**
 * Challenge stars (v2.0): the bit masks a profile stores per challenge and the
 * counts read from them. No dataset import, so the cloud-sync row builder
 * (`lib/supabase.ts`, on every page through the account store) can count stars
 * without loading the challenges engine (rc.26, #60). `./challenges` re-exports
 * all of it. rc.33: the status (locked / available / cleared) lives here too —
 * the "New" dots in the nav read it on every page (COL-02c).
 */

import { RANKS } from "@/config/balance";
import { rankForXp } from "./progression";
import type { Challenge } from "./types";

export type ChallengeStatus = "locked" | "available" | "cleared";

const rankIndex = (id: string): number => RANKS.findIndex((r) => r.id === id);

/**
 * Locked until the player reaches `rankRequired` AND clears any `prereq`.
 * Cleared once it's in the player's `challengesCompleted` map (one-and-done).
 */
export function challengeStatus(
  challenge: Pick<Challenge, "id" | "rankRequired" | "prereq">,
  xp: number,
  completed: Record<string, string>,
): ChallengeStatus {
  if (completed[challenge.id]) return "cleared";
  const haveIdx = rankIndex(rankForXp(xp).id);
  if (haveIdx < rankIndex(challenge.rankRequired)) return "locked";
  if (challenge.prereq && !completed[challenge.prereq]) return "locked";
  return "available";
}

/** Bit masks for the three stars (v2.0). */
export const STAR_CLEAR = 1;
export const STAR_2 = 2;
export const STAR_3 = 4;
export const ALL_STARS = STAR_CLEAR | STAR_2 | STAR_3;

export function countStars(mask: number): number {
  let n = 0;
  for (let m = mask | 0; m; m >>>= 1) n += m & 1;
  return n;
}

/** Total stars across a profile's `challengeStars` map. */
export function totalStars(stars: Record<string, number>): number {
  return Object.values(stars).reduce((n, m) => n + countStars(m), 0);
}
