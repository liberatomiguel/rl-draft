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
import type { Challenge, ChallengeUnlockCondition } from "./types";

/** Existing durable profile facts; no career-store or dataset dependency. */
export interface ChallengeUnlockFacts {
  challengeStars?: Record<string, number>;
  careerMarks?: readonly string[];
  quizSolved?: number;
  /** v2.0 (C2): the player had Challenges before the Season reset, so the rank
   *  gate never reads below Bronze (`selectChallengesUnlocked`). */
  veteran?: boolean;
}

export function challengeUnlockProgress(condition: ChallengeUnlockCondition, completed: Record<string, string>, facts: ChallengeUnlockFacts = {}): { current: number; target: number; met: boolean } {
  const target = condition.kind === "career" ? 1 : condition.count;
  let current = 0;
  switch (condition.kind) {
    case "clears": current = Object.keys(completed).length; break;
    case "stars": current = totalStars(facts.challengeStars ?? {}); break;
    case "perfects": current = Object.values(facts.challengeStars ?? {}).filter(m => (m & ALL_STARS) === ALL_STARS).length; break;
    case "quiz": current = facts.quizSolved ?? 0; break;
    case "career": current = facts.careerMarks?.includes(condition.mark) ? 1 : 0; break;
  }
  return { current, target, met: current >= target };
}

export type ChallengeStatus = "locked" | "available" | "cleared";

const rankIndex = (id: string): number => RANKS.findIndex((r) => r.id === id);

/**
 * Locked until the player reaches `rankRequired` AND clears any `prereq`.
 * Cleared once it's in the player's `challengesCompleted` map (one-and-done).
 */
export function challengeStatus(
  challenge: Pick<Challenge, "id" | "rankRequired" | "prereq" | "unlock">,
  xp: number,
  completed: Record<string, string>,
  facts: ChallengeUnlockFacts = {},
): ChallengeStatus {
  if (completed[challenge.id]) return "cleared";
  const haveIdx = Math.max(rankIndex(rankForXp(xp).id), facts.veteran ? rankIndex("bronze") : 0);
  if (haveIdx < rankIndex(challenge.rankRequired)) return "locked";
  if (challenge.prereq && !completed[challenge.prereq]) return "locked";
  if (challenge.unlock && !challenge.unlock.anyOf.some(c => challengeUnlockProgress(c, completed, facts).met)) return "locked";
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
