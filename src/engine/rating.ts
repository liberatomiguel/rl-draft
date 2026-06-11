/**
 * Team rating (base doc §18).
 *
 * rating = avg player overall + coach + sub + org + chemistry + specials.
 * Player overall stays the dominant factor by construction: all modifiers
 * together are bounded to roughly ±9 while player averages span ~82-96.
 */

import { BUFF_LEVEL_VALUE, TEAM_RATING } from "@/config/balance";
import { clamp, round1 } from "@/lib/util";
import type { BuffLevel, TeamRatingBreakdown } from "./types";

export interface RatingInput {
  /** Final overalls of the 3 players (special overall when special active). */
  playerOveralls: number[];
  coach?: { overall: number; bonusLevel: BuffLevel };
  /** Sub card overall, or the overall of a player card occupying the sub slot. */
  sub?: { overall: number };
  orgBuffLevel?: BuffLevel;
  /** Chemistry percent 0..100. */
  chemistryPercent: number;
  /** Max chemistry rating bonus for the current difficulty. */
  chemistryMaxBonus: number;
  specialCount: number;
  /** Flat shift for AI opponents (difficulty). 0 for the user. */
  difficultyShift?: number;
}

export function computeTeamRating(input: RatingInput): TeamRatingBreakdown {
  const avg =
    input.playerOveralls.reduce((sum, o) => sum + o, 0) /
    Math.max(1, input.playerOveralls.length);

  const c = TEAM_RATING.coach;
  const coachMod = input.coach
    ? clamp(
        Math.max(0, (input.coach.overall - c.baseline) * c.scale) +
          BUFF_LEVEL_VALUE[input.coach.bonusLevel] * c.perBonusLevel,
        0,
        c.max,
      )
    : 0;

  const s = TEAM_RATING.sub;
  const subMod = input.sub
    ? clamp(Math.max(0, (input.sub.overall - s.baseline) * s.scale), 0, s.max)
    : 0;

  const orgMod = input.orgBuffLevel
    ? BUFF_LEVEL_VALUE[input.orgBuffLevel] * TEAM_RATING.org.perBuffLevel
    : 0;

  const chemMod =
    (clamp(input.chemistryPercent, 0, 100) / 100) * input.chemistryMaxBonus;

  const specialMod = Math.min(
    input.specialCount * TEAM_RATING.special.perCard,
    TEAM_RATING.special.max,
  );

  const difficultyShift = input.difficultyShift ?? 0;

  const total =
    avg + coachMod + subMod + orgMod + chemMod + specialMod + difficultyShift;

  return {
    avgPlayerOverall: round1(avg),
    coachMod: round1(coachMod),
    subMod: round1(subMod),
    orgMod: round1(orgMod),
    chemMod: round1(chemMod),
    specialMod: round1(specialMod),
    difficultyShift: round1(difficultyShift),
    total: round1(total),
  };
}

/** Display value: the number users see as "Team Overall". */
export function displayTeamOverall(rating: TeamRatingBreakdown): number {
  return Math.min(99, Math.round(rating.total - rating.difficultyShift));
}
