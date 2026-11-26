/**
 * v2.2 Pro spine (PROSPINE): the one door from the spine to the player-level
 * engine of slice 2 ("pro-engine": `week.ts`, `ranked.ts`, `growth.ts`). The
 * spine calls the week's blocks on their days of the real calendar and the
 * week's close on Monday, and match XP after every series; the shapes are
 * the agreed contract. Nothing else in the spine imports those modules.
 */

import type { CareerEventDef } from "../types";
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

export function applyMatchXp(
  player: ProPlayer,
  ctx: { rating: number; opponentStrength: number; tier: CareerEventDef["tier"]; seasonIndex: number; day: number },
): { player: ProPlayer; growth: ProGrowthEntry[] } {
  return engineMatchXp(player, ctx);
}

/** Ranked's gate to the cups (Grand Champion, PRO-SPEC §7.1). */
export function rankedOpensCups(player: ProPlayer): boolean {
  return cupsUnlocked(player);
}

/** Slice 5's moments: one decision a game, its bounded effects, his final rating. */
export { buildDecision, EMPTY_LEDGER, finalProRating, resolveDecision } from "./moments";
export type { DecisionLedger, ProDecision } from "./moments";
