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
import { lineupById, lineupPoolForRegion, lineups, playerCardById } from "@/data";
import type { Rng } from "@/lib/rng";
import { createDraft, drawNextOffer, playerEligibleUnderConstraint } from "./draft";
import { simulateSeries } from "./match";
import { rankForXp } from "./progression";
import { buildLineupTeam } from "./teams";
import type {
  Challenge,
  ChallengeConstraint,
  DraftState,
  Roster,
  RosterSlotId,
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
  // Nationality twist (v1.4): restrict the pool to lineups that actually CONTAIN
  // an eligible player, so every offer surfaces a pickable national and the draft
  // always completes within the reroll budget (a rare nationality used to be
  // un-draftable on an unlucky fixed seed — the boss is the test, not draft luck).
  if (constraint.country) {
    return lineups
      .filter(
        (l) =>
          !l.rareSpawn &&
          l.playerCardIds.some((cid) => playerEligibleUnderConstraint(cid, constraint)),
      )
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

/** The fixed boss team — a clean historical lineup (no special upgrades). The
 *  per-challenge `sim.opponentShift` (v1.4) is a flat balance handicap so a famous
 *  superteam stays the headline opponent yet is beatable by a good constrained draft. */
export function buildChallengeOpponent(challenge: Challenge): TournamentTeam {
  return buildLineupTeam(challenge.opponentLineupId, challenge.sim.difficulty, {
    extraShift: challenge.sim.opponentShift ?? 0,
  });
}

/**
 * A `Roster` shaped from a historical lineup (its 3 player cards + coach / sub /
 * org), so the briefing can render the boss on a `FieldView` exactly like the
 * player's own team. Pure data mapping — no rating math. (v1.4)
 */
export function rosterFromLineup(lineupId: string): Roster {
  const l = lineupById.get(lineupId);
  if (!l) return {};
  const roster: Roster = {};
  const slots: RosterSlotId[] = ["player1", "player2", "player3"];
  l.playerCardIds.slice(0, 3).forEach((cid, i) => {
    roster[slots[i]] = { slot: slots[i], kind: "player", refId: cid, fromLineupId: lineupId };
  });
  // Coach/sub are optional in the data — fall back to the "vacant" picks the game
  // already understands (rendered as an empty bench slot, zero rating) so the
  // roster is always a complete, buildable classic roster.
  roster.coach = l.coachId
    ? { slot: "coach", kind: "coach", refId: l.coachId, fromLineupId: lineupId }
    : { slot: "coach", kind: "coach", refId: "vacant-coach", fromLineupId: lineupId };
  roster.sub = l.subId
    ? { slot: "sub", kind: "sub", refId: l.subId, fromLineupId: lineupId }
    : { slot: "sub", kind: "sub", refId: "vacant-sub", fromLineupId: lineupId };
  roster.org = { slot: "org", kind: "org", refId: l.orgId, fromLineupId: lineupId };
  return roster;
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
