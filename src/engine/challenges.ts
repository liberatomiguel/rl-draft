/**
 * Challenges (v1.4) — rank-unlocked authored puzzles.
 *
 * A challenge is a dedicated mini-run: a CONSTRAINED draft (a "twist" like an
 * overall cap, a nationality lock or a region pool) followed by a single Bo7
 * against a FIXED historical boss lineup. Win the series → the challenge is
 * cleared (one-and-done, like an achievement). This module is pure/deterministic
 * and reuses the existing draft + series engine — it adds no new game math.
 */

import { CHALLENGE, RANKS } from "@/config/balance";
import { lineupPoolForRegion, lineups, playerCardById } from "@/data";
import type { Rng } from "@/lib/rng";
import { createDraft, drawNextOffer } from "./draft";
import { simulateSeries } from "./match";
import { rankForXp } from "./progression";
import { buildLineupTeam } from "./teams";
import type {
  Challenge,
  ChallengeConstraint,
  DraftState,
  SeriesResult,
  TournamentTeam,
} from "./types";

export type ChallengeStatus = "locked" | "available" | "cleared";

const rankIndex = (id: string): number => RANKS.findIndex((r) => r.id === id);

/**
 * Locked until the player reaches `rankRequired` AND clears any `prereq`.
 * Cleared once it's in the player's `challengesCompleted` map (one-and-done).
 */
export function challengeStatus(
  challenge: Challenge,
  xp: number,
  completed: Record<string, string>,
): ChallengeStatus {
  if (completed[challenge.id]) return "cleared";
  const haveIdx = rankIndex(rankForXp(xp).id);
  if (haveIdx < rankIndex(challenge.rankRequired)) return "locked";
  if (challenge.prereq && !completed[challenge.prereq]) return "locked";
  return "available";
}

/**
 * The lineup pool a challenge draft draws from. Region / season twists restrict
 * it (reusing the region-lock machinery); other twists draft from the full
 * worldwide pool and gate per-card instead (overall cap / nationality).
 */
export function challengePool(constraint: ChallengeConstraint | undefined): string[] | undefined {
  if (!constraint) return undefined;
  if (constraint.region) return lineupPoolForRegion(constraint.region);
  if (constraint.seasonId) {
    return lineups
      .filter((l) => l.seasonId === constraint.seasonId && !l.rareSpawn)
      .map((l) => l.id);
  }
  return undefined;
}

/**
 * Build the constrained challenge draft. The boss is fixed (not drafted), so the
 * draft only assembles the user's team. A `fixedPlayerCardId` is pre-placed in
 * the first player slot (and excluded from being drafted again) — the
 * "build around this player" twist. Seeded by the challenge for a repeatable,
 * solvable puzzle.
 */
export function createChallengeDraft(challenge: Challenge, rng: Rng): DraftState {
  let draft = createDraft(challenge.sim.difficulty, {
    mode: "challenge",
    poolLineupIds: challengePool(challenge.constraint),
    constraint: challenge.constraint,
    rerollsOverride: CHALLENGE.rerolls,
  });

  if (challenge.fixedPlayerCardId) {
    const card = playerCardById.get(challenge.fixedPlayerCardId);
    if (card) {
      draft = {
        ...draft,
        roster: {
          ...draft.roster,
          player1: {
            slot: "player1",
            kind: "player",
            refId: card.id,
            fromLineupId: card.lineupId,
          },
        },
        takenPersonIds: [...draft.takenPersonIds, card.playerId],
      };
    }
  }

  return drawNextOffer(draft, rng);
}

/** The fixed boss team — a clean historical lineup (no special upgrades). */
export function buildChallengeOpponent(challenge: Challenge): TournamentTeam {
  return buildLineupTeam(challenge.opponentLineupId, challenge.sim.difficulty);
}

/** Play the single Bo7 (or the challenge's bestOf) — one series, win or lose. */
export function playChallengeSeries(
  user: TournamentTeam,
  opponent: TournamentTeam,
  challenge: Challenge,
  rng: Rng,
): SeriesResult {
  return simulateSeries(
    user,
    opponent,
    {
      bestOf: challenge.sim.bestOf,
      stage: "playoff",
      difficulty: challenge.sim.difficulty,
    },
    rng,
  );
}
