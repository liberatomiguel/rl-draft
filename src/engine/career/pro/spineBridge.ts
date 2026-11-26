/**
 * v2.2 Pro spine (PROSPINE): the ADAPTER to the player-level engine of slice 2.
 *
 * The "pro-engine" front owns the week (`week.ts`: applyBlock, coachPlanFor,
 * applyMatchXp, energy, burnout, confidence) and ranked (`ranked.ts`:
 * rankOf). When this branch was built that work had not landed, so the spine
 * codes against its agreed contract through this one file, with plain
 * stand-ins built on slice 1's growth. When slice 2 merges, re-export its
 * functions here and delete the stand-ins: nothing else in the spine
 * imports the player-level engine directly.
 */

import { CAREER_PRO, CAREER_PRO_TEAM } from "@/config/balance";
import { clamp } from "@/lib/util";
import type { StatKey } from "../../types";
import type { CareerEventDef } from "../types";
import { PRO_STAT_KEYS, round2 } from "./attrs";
import { ageFactorFor, applyGains, gapFactorFor, proAgeOf, trainBlock, weakestStat } from "./growth";
import type { ProGrowthEntry, ProPlayer, ProTrainingFocus } from "./types";

export type ProActivity =
  | { kind: "train"; focus: ProTrainingFocus }
  | { kind: "ranked" }
  | { kind: "scrim" }
  | { kind: "content" }
  | { kind: "rest" };

export interface BlockCtx {
  seasonIndex: number;
  day: number;
  coachOverall: number | null;
  /** He has a team (a scrim needs one). */
  hasTeam: boolean;
}

const ENERGY: Record<ProActivity["kind"], number> = { train: -20, ranked: -15, scrim: -15, content: -10, rest: 35 };

function diffEntries(before: ProPlayer, after: ProPlayer, ctx: { seasonIndex: number; day: number }, source: ProGrowthEntry["source"]): ProGrowthEntry[] {
  const out: ProGrowthEntry[] = [];
  for (const k of PRO_STAT_KEYS) {
    const delta = round2(after.attrs[k] - before.attrs[k]);
    if (delta > 0) out.push({ seasonIndex: ctx.seasonIndex, day: ctx.day, source, stat: k, delta });
  }
  return out;
}

/** One block of the week (stand-in for week.applyBlock). */
export function applyBlock(player: ProPlayer, activity: ProActivity, ctx: BlockCtx): { player: ProPlayer; growth: ProGrowthEntry[]; notes: string[] } {
  let next: ProPlayer = player;
  if (activity.kind === "train") {
    next = trainBlock(player, activity.focus, { seasonIndex: ctx.seasonIndex, coachOverall: ctx.coachOverall });
  } else if (activity.kind === "scrim" && ctx.hasTeam) {
    next = { ...player, attrs: applyGains(player.attrs, { experience: 0.3 * gapFactorFor(player.attrs.experience) }) };
  } else if (activity.kind === "ranked") {
    next = { ...player, mmr: Math.round(player.mmr + 6 + (player.attrs.mechanics - 50) * 0.1) };
  } else if (activity.kind === "content") {
    next = { ...player, fame: player.fame + 20, money: player.money + 150 };
  }
  const energy = clamp(next.energy + ENERGY[activity.kind], 0, 100);
  next = { ...next, energy };
  return { player: next, growth: diffEntries(player, next, ctx, "training"), notes: [] };
}

/** The coach's week (stand-in for week.coachPlanFor): two blocks on the weakest attribute, then rest. */
export function coachPlanFor(player: ProPlayer): [ProActivity, ProActivity, ProActivity] {
  const focus = weakestStat(player.attrs);
  if (player.energy < 40) return [{ kind: "rest" }, { kind: "train", focus }, { kind: "rest" }];
  return [{ kind: "train", focus }, { kind: "train", focus }, { kind: "rest" }];
}

const MATCH_SPLIT: Partial<Record<StatKey, number>> = { experience: 0.4, clutch: 0.2, consistency: 0.2, offense: 0.1, defense: 0.1 };

/** Match XP for one series (stand-in for week.applyMatchXp): bigger at bigger events and for better ratings. */
export function applyMatchXp(
  player: ProPlayer,
  ctx: { rating: number; opponentStrength: number; tier: CareerEventDef["tier"]; seasonIndex: number; day: number },
): { player: ProPlayer; growth: ProGrowthEntry[] } {
  const T = CAREER_PRO_TEAM;
  const age = proAgeOf(player, ctx.seasonIndex);
  const base = (T.matchXpByTier[ctx.tier] ?? 0.25) * Math.max(0.25, 1 + T.matchXpPerRatingPoint * (ctx.rating - 6)) * player.talent * ageFactorFor(age, player.peakAge);
  const gains: Partial<Record<StatKey, number>> = {};
  for (const k of PRO_STAT_KEYS) {
    const share = MATCH_SPLIT[k] ?? 0;
    if (share > 0) gains[k] = base * share * gapFactorFor(player.attrs[k]);
  }
  const next = { ...player, attrs: applyGains(player.attrs, gains) };
  void CAREER_PRO;
  return { player: next, growth: diffEntries(player, next, ctx, "match") };
}
