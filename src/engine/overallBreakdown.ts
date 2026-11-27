/**
 * rc9 LEGACY: the team overall as labelled parts that add up to the number the
 * screens show (DESIGN-DECISIONS #222).
 *
 * The shown overall is `displayTeamOverall(rating)` = min(99, round(total -
 * difficultyShift)), where `total` already carries the superteam curve (every
 * point above TEAM_RATING.superteamPivot counts at superteamSlope). The
 * Review and Results screens list players + coach + sub + org + chemistry +
 * specials, which sum to MORE than the big number whenever the curve bites
 * (three 99 cards and nothing else read 97). This adds the missing lines:
 * the curve, the 99 cap and the rounding, so the column reconciles.
 *
 * Pure and display-only: it reads a TeamRatingBreakdown (the one the team
 * already carries, so every screen gets the same figures) and draws nothing.
 * All arithmetic is in integer tenths, so the parts sum exactly.
 */

import { TEAM_RATING } from "@/config/balance";
import { displayTeamOverall } from "./rating";
import type { TeamRatingBreakdown } from "./types";

export type OverallPartKey =
  | "players"
  | "coach"
  | "sub"
  | "org"
  | "chemistry"
  | "specials"
  | "curve"
  | "cap"
  | "rounding";

export interface OverallPart {
  key: OverallPartKey;
  /** One decimal; the parts' values sum exactly to `shown`. */
  value: number;
}

export interface OverallBreakdown {
  /** The number every screen shows (displayTeamOverall). */
  shown: number;
  /** Players' average plus every bonus, before the curve (one decimal). */
  beforeCurve: number;
  /** In order: players, the bonuses, then curve / cap / rounding when not zero. */
  parts: OverallPart[];
  /** The curve's pivot, for the label ("above 94 counts at 55%"). */
  pivot: number;
  /** The curve's slope as a percentage (55). */
  slopePercent: number;
}

const tenths = (x: number) => Math.round(x * 10);
const fromTenths = (t: number) => t / 10;

export function overallBreakdown(
  rating: TeamRatingBreakdown,
  options: { quick?: boolean } = {},
): OverallBreakdown {
  const shown = displayTeamOverall(rating);
  const lines: [OverallPartKey, number][] = [
    ["players", tenths(rating.avgPlayerOverall)],
    ["coach", tenths(rating.coachMod)],
    ["sub", tenths(rating.subMod)],
    ["org", tenths(rating.orgMod)],
    ["chemistry", tenths(rating.chemMod)],
    ["specials", tenths(rating.specialMod)],
  ];
  // Quick Draft has no staff or org: those lines never show (they are 0 anyway).
  const kept = lines.filter(([k, v]) => k === "players" || v !== 0 || (!options.quick && (k === "coach" || k === "sub" || k === "org" || k === "chemistry")));
  const before = lines.reduce((s, [, v]) => s + v, 0);
  const rated = tenths(rating.total - rating.difficultyShift);
  // Each stored part is rounded to 0.1 on its own, so without the curve the
  // sum can differ from `rated` by a tenth: that is rounding, not a curve.
  const curved = before > TEAM_RATING.superteamPivot * 10;
  const curve = curved ? rated - before : 0;
  const afterCurve = before + curve; // === rated when curved
  const roundedUp = tenths(Math.round(fromTenths(rated)));
  const cap = roundedUp > 990 ? 990 - afterCurve : 0;
  const rounding = shown * 10 - afterCurve - cap;

  const parts: OverallPart[] = kept.map(([key, v]) => ({ key, value: fromTenths(v) }));
  if (curve !== 0) parts.push({ key: "curve", value: fromTenths(curve) });
  if (cap !== 0) parts.push({ key: "cap", value: fromTenths(cap) });
  if (rounding !== 0) parts.push({ key: "rounding", value: fromTenths(rounding) });
  return {
    shown,
    beforeCurve: fromTenths(before),
    parts,
    pivot: TEAM_RATING.superteamPivot,
    slopePercent: Math.round(TEAM_RATING.superteamSlope * 100),
  };
}

/** Sum of the parts in tenths (tests and the screen's own check). */
export function sumOfParts(b: OverallBreakdown): number {
  return fromTenths(b.parts.reduce((s, p) => s + tenths(p.value), 0));
}
