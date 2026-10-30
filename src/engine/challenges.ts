/**
 * Challenges (v1.4) — rank-unlocked authored puzzles.
 *
 * A challenge is a dedicated mini-run: a CONSTRAINED draft (a "twist" like an
 * overall cap, a nationality lock or a region pool) followed by a single Bo7
 * against a FIXED historical boss lineup. Win the series → the challenge is
 * cleared (one-and-done, like an achievement). This module is pure/deterministic
 * and reuses the existing draft + series engine — it adds no new game math.
 */

import { CHALLENGE } from "@/config/balance";
import { specialCardById } from "@/data";
import { lineupById, lineupPoolForRegion, lineups, playerById, playerCardById } from "@/data";
import type { Rng } from "@/lib/rng";
import { STAR_2, STAR_3, STAR_CLEAR } from "./challengeStars";
import { createDraft, drawNextOffer, playerEligibleUnderConstraint } from "./draft";
import { simulateSeries } from "./match";
import { buildLineupTeam } from "./teams";
import type {
  PlayerCard,
  Challenge,
  ChallengeConstraint,
  ChallengeStar,
  DraftState,
  Roster,
  RosterSlotId,
  SeriesResult,
  TournamentTeam,
} from "./types";
import { displayTeamOverall } from "./rating";

// The star masks and the status live in ./challengeStars (no dataset: the cloud
// sync counts stars and the "New" dots read the status on every page, #60);
// re-exported so this stays the challenges API.
export {
  ALL_STARS,
  challengeStatus,
  countStars,
  STAR_2,
  STAR_3,
  STAR_CLEAR,
  totalStars,
  type ChallengeStatus,
} from "./challengeStars";

/** Number of stars a challenge can award (3 with `stars`, 1 without). */
export function starsAvailable(challenge: Challenge): number {
  return challenge.stars ? 3 : 1;
}

/** Everything the star evaluation reads from one finished attempt. */
export interface StarContext {
  user: TournamentTeam;
  /** The boss series (the last one for a gauntlet). */
  boss: SeriesResult;
  /** Every series of the attempt (gauntlet stages first, boss last). */
  all: SeriesResult[];
  bossOverall: number;
  rerollsUsed: number;
  /** rc.20: the drafted roster (sameRegion / sameSeason stars). Optional so
   *  the sim harness can evaluate outcome stars without one. */
  roster?: Roster;
}

/** The player cards drafted into the three starter slots. */
function rosterPlayers(roster: Roster | undefined): PlayerCard[] {
  if (!roster) return [];
  const out: PlayerCard[] = [];
  for (const slot of ["player1", "player2", "player3"] as const) {
    const pick = roster[slot];
    const card = pick ? playerCardById.get(pick.refId) : undefined;
    if (card) out.push(card);
  }
  return out;
}

function userGoals(series: SeriesResult[], userId: string): { scored: number; conceded: number } {
  let scored = 0;
  let conceded = 0;
  for (const s of series) {
    for (const g of s.games) {
      // game.score is [winner goals, loser goals]
      if (g.winnerTeamId === userId) {
        scored += g.score[0];
        conceded += g.score[1];
      } else {
        scored += g.score[1];
        conceded += g.score[0];
      }
    }
  }
  return { scored, conceded };
}

/** One star condition against a CLEARED attempt. Pure. */
export function starSatisfied(star: ChallengeStar, ctx: StarContext): boolean {
  const userId = ctx.user.id;
  switch (star.kind) {
    case "noSpecials":
      return ctx.user.specialIds.filter((id) => specialCardById.has(id)).length === 0;
    case "sweep": {
      const lost = ctx.boss.winnerTeamId === ctx.boss.teamAId ? ctx.boss.score[1] : ctx.boss.score[0];
      return lost <= star.maxLosses;
    }
    case "maxOverall":
      return displayTeamOverall(ctx.user.rating) <= star.max;
    case "chemistry": {
      const order = ["Poor", "Okay", "Good", "Great", "Perfect"];
      return order.indexOf(ctx.user.chemistry.tier) >= order.indexOf(star.tier);
    }
    case "underdog":
      return displayTeamOverall(ctx.user.rating) < ctx.bossOverall;
    case "maxRerolls":
      return ctx.rerollsUsed <= star.max;
    case "goals":
      return userGoals(ctx.all, userId).scored >= star.min;
    case "concede":
      return userGoals(ctx.all, userId).conceded <= star.max;
    case "noLosses":
      return ctx.all.every((s) => s.winnerTeamId === userId);
    case "sameRegion": {
      const cards = rosterPlayers(ctx.roster);
      if (cards.length < 3) return false;
      const regions = new Set(cards.map((c) => playerById.get(c.playerId)?.region ?? "?"));
      return regions.size === 1 && !regions.has("?");
    }
    case "sameSeason": {
      const cards = rosterPlayers(ctx.roster);
      return cards.length >= 3 && new Set(cards.map((c) => c.seasonId)).size === 1;
    }
  }
}

/** Star mask earned by a finished attempt (0 when the boss was not beaten). */
export function evaluateStars(challenge: Challenge, ctx: StarContext): number {
  if (ctx.boss.winnerTeamId !== ctx.user.id) return 0;
  let mask = STAR_CLEAR;
  if (challenge.stars) {
    if (starSatisfied(challenge.stars[0], ctx)) mask |= STAR_2;
    if (starSatisfied(challenge.stars[1], ctx)) mask |= STAR_3;
  }
  return mask;
}

/** XP for the stars in `newMask` that the profile did not have (`had`). */
export function starRewardXp(challenge: Challenge, had: number, newMask: number): number {
  const fresh = newMask & ~had;
  let xp = 0;
  if (fresh & STAR_CLEAR) xp += challenge.reward.xp;
  const per = CHALLENGE.starXp[challenge.tier] ?? 0;
  if (fresh & STAR_2) xp += per;
  if (fresh & STAR_3) xp += per;
  return xp;
}

/** The gauntlet opponents (before the boss), built like the boss (same shift). */
export function buildGauntletOpponents(challenge: Challenge): TournamentTeam[] {
  if (challenge.kind !== "gauntlet" || !challenge.gauntlet) return [];
  return challenge.gauntlet.lineupIds.map((lineupId) =>
    buildLineupTeam(lineupId, challenge.sim.difficulty, { extraShift: challenge.sim.opponentShift ?? 0 }),
  );
}

/** Play one gauntlet stage (Bo`gauntlet.bestOf`). */
export function playGauntletStage(
  user: TournamentTeam,
  opponent: TournamentTeam,
  challenge: Challenge,
  rng: Rng,
): SeriesResult {
  return simulateSeries(
    user,
    opponent,
    { bestOf: challenge.gauntlet?.bestOf ?? 5, stage: "playoff", difficulty: challenge.sim.difficulty },
    rng,
  );
}

/**
 * The lineup pool a challenge draft draws from. Region / season twists restrict
 * it (reusing the region-lock machinery); other twists draft from the full
 * worldwide pool and gate per-card instead (overall cap / nationality).
 */
export function challengePool(constraint: ChallengeConstraint | undefined): string[] | undefined {
  if (!constraint) return undefined;
  // National teams (v2.0) are never part of a challenge draft.
  if (constraint.region) {
    return lineupPoolForRegion(constraint.region).filter((id) => !lineupById.get(id)?.national);
  }
  if (constraint.seasonId) {
    return lineups
      .filter((l) => l.seasonId === constraint.seasonId && !l.rareSpawn && !l.national)
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
          !l.national &&
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
    rerollsOverride: CHALLENGE.rerollsByDifficulty[challenge.sim.difficulty],
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
