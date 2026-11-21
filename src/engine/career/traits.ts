/**
 * Matchday traits (v2.1 slice 2, docs/MATCHDAY-SPEC.md §5).
 *
 * Each player gets 0–2 traits, derived from a hash of the player's key (plus a
 * salt), weighted by archetype and overall. Never stored in the save: the same
 * key, overall and archetype always give the same traits.
 *
 * Form traits act on the game (match.ts reads `traitGameEffects`):
 *   decisive     bonus in the deciding game and in overtime
 *   streaky      wider per-game roll, consistent narrower
 *   slowStarter  worse in game 1, better from game 3
 *   lan          bonus at a LAN event (Major / Worlds)
 * Behaviour traits act on the existing bounce for now (fatia 3 moves them onto
 * the momentum meter): leader, hotHeaded, iceCold.
 */

import { CAREER_MATCHDAY as MD } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { TraitId, TournamentTeam } from "../types";
import { deriveSeed } from "./seeds";

export const TRAIT_IDS: readonly TraitId[] = [
  "decisive",
  "streaky",
  "consistent",
  "slowStarter",
  "lan",
  "leader",
  "hotHeaded",
  "iceCold",
];

/** Pairs that never sit on the same player. */
const EXCLUSIVE: ReadonlyArray<readonly [TraitId, TraitId]> = [
  ["streaky", "consistent"],
  ["hotHeaded", "iceCold"],
];

function excludes(a: TraitId, b: TraitId): boolean {
  return a === b || EXCLUSIVE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function unit(key: string, what: string): number {
  return deriveSeed(MD.traitSalt, `trait:${what}:${key}`) / 4294967296;
}

/** The trait weights for one player, before any pick. */
export function traitWeightsFor(overall: number, archetype?: string): Record<TraitId, number> {
  const tilt = (archetype && MD.traitArchetypeTilt[archetype]) || {};
  const out = {} as Record<TraitId, number>;
  for (const id of TRAIT_IDS) {
    let w = (MD.traitWeights[id] ?? 0) * (tilt[id] ?? 1);
    if (overall >= MD.traitOverallHigh) w *= MD.traitHighTilt[id] ?? 1;
    else if (overall < MD.traitOverallLow) w *= MD.traitLowTilt[id] ?? 1;
    out[id] = w;
  }
  return out;
}

/** How many traits (0–2): a higher overall moves chance from 0 to 2. */
export function traitCountFor(key: string, overall: number): number {
  const [p0, p1] = MD.traitCountChance;
  const shift = clamp((overall - MD.traitCountOverallPivot) * MD.traitCountOverallShift, -p0 + 0.05, p0 - 0.05);
  const zero = p0 - shift;
  const one = p1;
  const u = unit(key, "count");
  if (u < zero) return 0;
  if (u < zero + one) return 1;
  return 2;
}

/**
 * The player's traits, in pick order. `key` is the player's stable identity
 * (the career passes the player's name through the team builder).
 */
export function playerTraits(key: string, overall: number, archetype?: string): TraitId[] {
  const count = traitCountFor(key, overall);
  const weights = traitWeightsFor(overall, archetype);
  const picked: TraitId[] = [];
  for (let n = 0; n < count; n++) {
    const pool = TRAIT_IDS.filter((id) => weights[id] > 0 && !picked.some((p) => excludes(p, id)));
    const total = pool.reduce((s, id) => s + weights[id], 0);
    if (total <= 0) break;
    let u = unit(key, `pick${n}`) * total;
    let choice = pool[pool.length - 1];
    for (const id of pool) {
      u -= weights[id];
      if (u < 0) {
        choice = id;
        break;
      }
    }
    picked.push(choice);
  }
  return picked;
}

function countOf(team: TournamentTeam, id: TraitId): number {
  let n = 0;
  for (const list of team.traits ?? []) for (const t of list) if (t === id) n++;
  return n;
}

/** How many of the side's players carry `id` (slice 3's momentum meter reads the behaviour traits). */
export function traitCount(team: TournamentTeam, id: TraitId): number {
  return countOf(team, id);
}

export interface TraitGameEffects {
  /** Flat shift to the game score, within ±traitCap. */
  shift: number;
  /** Extra score in the overtime roll (decisive). */
  overtime: number;
  /** Multiplier on the per-game roll's spread around its centre (1 = unchanged). */
  rollScale: number;
}

/** A side's trait effects in one game. `gameIndex` is 1-based. */
export function traitGameEffects(
  team: TournamentTeam,
  ctx: { gameIndex: number; deciding: boolean },
): TraitGameEffects {
  if (!team.traits) return { shift: 0, overtime: 0, rollScale: 1 };
  const decisive = countOf(team, "decisive");
  const slow = countOf(team, "slowStarter");
  let shift = 0;
  if (ctx.deciding) shift += MD.decisiveBonus * decisive;
  if (ctx.gameIndex === 1) shift += MD.slowStarterGame1 * slow;
  else if (ctx.gameIndex >= 3) shift += MD.slowStarterFromGame3 * slow;
  if (team.lanEvent) shift += MD.lanBonus * countOf(team, "lan");
  const [lo, hi] = MD.rollScaleRange;
  const rollScale = clamp(
    1 + MD.streakyRollScale * countOf(team, "streaky") - MD.consistentRollScale * countOf(team, "consistent"),
    lo,
    hi,
  );
  return {
    shift: clamp(shift, -MD.traitCap, MD.traitCap),
    overtime: MD.decisiveBonus * decisive,
    rollScale,
  };
}

/**
 * The bounce the previous game's loser gets (SIMULATION.momentumBounce), after
 * the behaviour traits: the loser's leaders add, its hot-heads take after an
 * overtime loss, the winner's ice-cold players take. Within base ± bounceTraitCap.
 */
export function traitBounce(base: number, loser: TournamentTeam, winner: TournamentTeam, overtimeLoss: boolean): number {
  if (!loser.traits && !winner.traits) return base;
  let delta = MD.leaderBounce * countOf(loser, "leader") + MD.iceColdOpponentBounce * countOf(winner, "iceCold");
  if (overtimeLoss) delta += MD.hotHeadedOvertimeBounce * countOf(loser, "hotHeaded");
  return base + clamp(delta, -MD.bounceTraitCap, MD.bounceTraitCap);
}
