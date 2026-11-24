/**
 * v2.2 Pro (PRO-SPEC §4.1, R148): the player's attributes and how training
 * moves them. Pure and deterministic: no RNG at all here — a block's gain is
 * a formula of the player, his age and his setting.
 *
 *   gain = perBlock × talent × age × gap × coach × energy
 *
 * There is no potential: every Pro's ceiling is CAREER_PRO.attrMax (99). The
 * gap factor slows him near it and never stops him (`gapFloor`), so 99 is
 * reachable for a good seed run well, which is Miguel's rule (P7).
 */

import { CAREER_PRO } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { StatKey, Stats } from "../../types";
import { ageOf } from "../development";
import { PRO_STAT_KEYS, round2 } from "./attrs";
import type { ProGrowthEntry, ProPlayer, ProSave, ProTrainingFocus } from "./types";
import { withProInWorld } from "./world";

export { PRO_STAT_KEYS, proOverall, round2 } from "./attrs";

const G = CAREER_PRO.growth;

export function proAgeOf(player: Pick<ProPlayer, "birthYear">, seasonIndex: number): number {
  return ageOf(player.birthYear, seasonIndex);
}

/** The age multiplier (CAREER_PRO.growth.ageBands, then before / after the peak). */
export function ageFactorFor(age: number, peakAge: number): number {
  if (age > peakAge) return G.afterPeak;
  for (const band of G.ageBands) if (age <= band.maxAge) return band.mult;
  return G.beforePeak;
}

/** Distance to the ceiling: slower near 99, never zero below it. */
export function gapFactorFor(attr: number): number {
  const room = CAREER_PRO.attrMax - attr;
  if (room <= 0) return 0;
  return Math.max(G.gapFloor, Math.pow(room / G.gapRef, G.gapExponent));
}

/** The coach's multiplier: 1 without one (amateur), up to 1 + coachMax. */
export function coachFactorFor(coachOverall: number | null): number {
  if (coachOverall === null) return 1;
  const t = clamp((coachOverall - G.coachZero) / (G.coachFull - G.coachZero), 0, 1);
  return 1 + t * G.coachMax;
}

/** Training tired: full from energyFull up, linear down to energyFloorMult at 0. */
export function energyFactorFor(energy: number): number {
  if (energy >= G.energyFull) return 1;
  const t = clamp(energy / G.energyFull, 0, 1);
  return G.energyFloorMult + (1 - G.energyFloorMult) * t;
}

export interface TrainCtx {
  seasonIndex: number;
  /** The team's coach overall; null = none (ranked, amateur). */
  coachOverall: number | null;
}

/**
 * The points one training block adds to each attribute, before rounding.
 * A focus puts the whole block on one attribute; "balanced" spreads
 * `balancedShare` of it over the six.
 */
export function blockGains(player: ProPlayer, focus: ProTrainingFocus, ctx: TrainCtx): Partial<Record<StatKey, number>> {
  const age = proAgeOf(player, ctx.seasonIndex);
  const base =
    G.perBlock *
    player.talent *
    ageFactorFor(age, player.peakAge) *
    coachFactorFor(ctx.coachOverall) *
    energyFactorFor(player.energy);
  const out: Partial<Record<StatKey, number>> = {};
  if (focus === "balanced") {
    const share = (base * G.balancedShare) / PRO_STAT_KEYS.length;
    for (const k of PRO_STAT_KEYS) out[k] = share * gapFactorFor(player.attrs[k]);
  } else {
    out[focus] = base * gapFactorFor(player.attrs[focus]);
  }
  return out;
}

/**
 * Apply gains to the attributes, never past attrMax. A positive gain is worth
 * at least one hundredth (the minimum gain: training below the ceiling always
 * shows).
 */
export function applyGains(attrs: Stats, gains: Partial<Record<StatKey, number>>): Stats {
  const next = { ...attrs };
  for (const k of PRO_STAT_KEYS) {
    const g = gains[k];
    if (!g || g <= 0) continue;
    next[k] = round2(clamp(attrs[k] + Math.max(G.minGain, g), CAREER_PRO.attrMin, CAREER_PRO.attrMax));
  }
  return next;
}

/** One training block on a player (a new object; the input is untouched). */
export function trainBlock(player: ProPlayer, focus: ProTrainingFocus, ctx: TrainCtx): ProPlayer {
  return { ...player, attrs: applyGains(player.attrs, blockGains(player, focus, ctx)) };
}

/**
 * One training block on a save, with its explained change in the growth log.
 * The world's snapshot follows. Slice 2's week calls this; slice 1 exposes
 * it for the projection tests.
 */
export function trainSaveBlock(save: ProSave, focus: ProTrainingFocus, coachOverall: number | null = null): ProSave {
  const before = save.player.attrs;
  const player = trainBlock(save.player, focus, { seasonIndex: save.clock.seasonIndex, coachOverall });
  const entries: ProGrowthEntry[] = [];
  for (const k of PRO_STAT_KEYS) {
    const delta = round2(player.attrs[k] - before[k]);
    if (delta > 0) entries.push({ seasonIndex: save.clock.seasonIndex, day: save.clock.day, source: "training", stat: k, delta });
  }
  const growthLog = [...save.growthLog, ...entries].slice(-CAREER_PRO.growthLogCap);
  return withProInWorld({ ...save, player, growthLog });
}

/** The attribute a "work on the weakest" policy trains next (ties: stat order). */
export function weakestStat(attrs: Stats): StatKey {
  let best: StatKey = PRO_STAT_KEYS[0];
  for (const k of PRO_STAT_KEYS) if (attrs[k] < attrs[best]) best = k;
  return best;
}
