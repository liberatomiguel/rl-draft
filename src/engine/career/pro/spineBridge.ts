/**
 * v2.2 Pro spine (PROSPINE): the one door from the spine to the player-level
 * engine of slice 2 ("pro-engine": `week.ts`, `ranked.ts`, `growth.ts`). The
 * spine calls the week's blocks on their days of the real calendar and the
 * week's close on Monday, and match XP after every series; the shapes are
 * the agreed contract. Nothing else in the spine imports those modules.
 */

import type { CareerEventDef } from "../types";
import { PRO_STAT_KEYS } from "./attrs";
import { applyMatchXp as engineMatchXp } from "./growth";
import { cupsUnlocked } from "./ranked";
import type { ProGrowthEntry, ProPlayer, ProStage, ProWeekNote, ProWeekPlan } from "./types";
import { applyBlock as engineBlock, closeWeek as engineCloseWeek, coachPlanFor as engineCoachPlan, type ProActivity } from "./week";

export type { ProActivity, ProWeekPlan };

export interface BlockCtx {
  seasonIndex: number;
  day: number;
  coachOverall: number | null;
  /** He has a team (a scrim needs one). */
  hasTeam: boolean;
  careerSeed: number;
}

export function applyBlock(player: ProPlayer, activity: ProActivity, ctx: BlockCtx): { player: ProPlayer; growth: ProGrowthEntry[]; notes: ProWeekNote[] } {
  return engineBlock(player, activity, { ...ctx, coachOverall: ctx.coachOverall ?? undefined });
}

export function closeWeek(player: ProPlayer, ctx: { seasonIndex: number; day: number; careerSeed: number }): { player: ProPlayer; notes: ProWeekNote[] } {
  return engineCloseWeek(player, ctx);
}

export function coachPlanFor(
  player: ProPlayer,
  ctx: { seasonIndex: number; careerSeed: number; hasTeam: boolean; coachOverall: number | null; stage: ProStage; daysToNextEvent?: number; nextEventIsLan?: boolean },
): ProWeekPlan {
  return engineCoachPlan(player, { ...ctx, coachOverall: ctx.coachOverall ?? undefined });
}

/**
 * Match XP of one series. `scale` (0-1, the spine's diminishing return over a
 * season) shrinks what the series adds; the form side effect stays whole.
 */
export function applyMatchXp(
  player: ProPlayer,
  ctx: { rating: number; opponentStrength: number; tier: CareerEventDef["tier"]; seasonIndex: number; day: number },
  scale = 1,
): { player: ProPlayer; growth: ProGrowthEntry[] } {
  const r = engineMatchXp(player, ctx);
  if (scale >= 1) return r;
  const attrs = { ...r.player.attrs };
  for (const k of PRO_STAT_KEYS) attrs[k] = Math.round((player.attrs[k] + (r.player.attrs[k] - player.attrs[k]) * scale) * 100) / 100;
  const growth = r.growth.map((g) => ({ ...g, delta: Math.round(g.delta * scale * 100) / 100 })).filter((g) => g.delta > 0);
  return { player: { ...r.player, attrs }, growth };
}

/** Ranked's gate to the cups (Grand Champion, PRO-SPEC §7.1). */
export function rankedOpensCups(player: ProPlayer): boolean {
  return cupsUnlocked(player);
}

/** Slice 5's moments: one decision a game, its bounded effects, his final rating. */
export { buildDecision, EMPTY_LEDGER, finalProRating, resolveDecision } from "./moments";
export type { DecisionLedger, ProDecision } from "./moments";
