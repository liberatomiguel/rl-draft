/**
 * v2.2 Pro (PRO-SPEC §4.1, R150): the peak and the slow decline, at the season
 * rollover. After his hidden peak age and a plateau year, he loses 0.5 to 1.5
 * overall a season (growing with the years and with his hidden decline rate),
 * carried mostly by the physical attributes; experience and clutch hold longer.
 * Never a big single drop, never a hidden one: every change is a growth-log
 * entry with a reason key the card reads ("the reflexes start to go").
 *
 * Pure and deterministic (a stream of the career seed per season).
 */

import { CAREER_PRO, CAREER_PRO_AGING as A } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { StatKey, Stats } from "../../types";
import { derivedFloat } from "../seeds";
import { PRO_STAT_KEYS, proOverall, round2 } from "./attrs";
import { proAgeOf, diffGrowth } from "./growth";
import type { ProGrowthEntry, ProPlayer } from "./types";

export type ProPhase = "rising" | "peak" | "declining";

/** Seasons of decline he has behind him once `seasonIndex` starts (0 = none yet). */
export function declineYears(player: ProPlayer, seasonIndex: number): number {
  return Math.max(0, proAgeOf(player, seasonIndex) - player.peakAge - A.graceYears);
}

export function phaseOf(player: ProPlayer, seasonIndex: number): ProPhase {
  const age = proAgeOf(player, seasonIndex);
  if (age < player.peakAge) return "rising";
  return declineYears(player, seasonIndex) > 0 ? "declining" : "peak";
}

/** The overall points this season's rollover takes (0 before the decline), in A.min..A.max. */
export function seasonDecline(player: ProPlayer, seasonIndex: number, careerSeed: number): number {
  const years = declineYears(player, seasonIndex);
  if (years <= 0) return 0;
  const base = A.declineBase[player.declineRate] ?? A.declineBase.normal;
  const wobble = (derivedFloat(careerSeed, `pro:aging:${seasonIndex}`) * 2 - 1) * A.jitter;
  return round2(clamp(base * (1 + A.perYear * (years - 1)) + wobble, A.min, A.max));
}

/** The player with his peak overall brought up to date (a new object when it moved). */
export function withPeak(player: ProPlayer): ProPlayer {
  const overall = proOverall(player.attrs);
  return overall > (player.peakOverall ?? 0) ? { ...player, peakOverall: overall } : player;
}

/**
 * The season rollover's pass: `seasonIndex` is the season that is starting.
 * Returns the player and the explained entries (reason keys), none while he
 * is still rising or on the plateau.
 */
export function applyAging(player: ProPlayer, ctx: { seasonIndex: number; careerSeed: number }): { player: ProPlayer; growth: ProGrowthEntry[] } {
  const peaked = withPeak(player);
  const d = seasonDecline(peaked, ctx.seasonIndex, ctx.careerSeed);
  if (d <= 0) return { player: peaked, growth: [] };
  const years = declineYears(peaked, ctx.seasonIndex);
  const weight = (k: StatKey) => ((years - (A.holdYears[k] ?? 0)) > 0 ? (A.weights[k] ?? 1) : 0);
  const sum = PRO_STAT_KEYS.reduce((a, k) => a + weight(k), 0);
  const attrs = { ...peaked.attrs } as Stats;
  if (sum > 0) {
    for (const k of PRO_STAT_KEYS) {
      const loss = Math.min(A.maxPerStat, (PRO_STAT_KEYS.length * d * weight(k)) / sum);
      attrs[k] = round2(clamp(peaked.attrs[k] - loss, CAREER_PRO.attrMin, CAREER_PRO.attrMax));
    }
  }
  const growth = PRO_STAT_KEYS.flatMap((k) =>
    diffGrowth(peaked.attrs, attrs, "age", { seasonIndex: ctx.seasonIndex, day: 1 }, A.reasons[k]).filter((e) => e.stat === k),
  );
  return { player: { ...peaked, attrs }, growth };
}
