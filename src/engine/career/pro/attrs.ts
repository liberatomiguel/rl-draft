/** v2.2 Pro (R148): the attribute basics shared by growth and the world snapshot. */

import type { StatKey, Stats } from "../../types";

export const PRO_STAT_KEYS: readonly StatKey[] = [
  "offense",
  "defense",
  "mechanics",
  "consistency",
  "experience",
  "clutch",
];

/**
 * Two decimals, the way attributes are stored (screens show whole numbers or
 * one decimal). A late block can add a few hundredths; one decimal would
 * round it away and stop him short of the ceiling.
 */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Overall = the mean of the six attributes. */
export function proOverall(attrs: Stats): number {
  let sum = 0;
  for (const k of PRO_STAT_KEYS) sum += attrs[k];
  return round2(sum / PRO_STAT_KEYS.length);
}

