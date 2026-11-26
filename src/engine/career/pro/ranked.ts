/**
 * v2.2 Pro (PRO-SPEC §7.1, R150): the ranked prologue. Bronze to Supersonic
 * Legend on the Draft's own rank ids (`rankSrc` art, `RANKS` names). A ranked
 * block is a session of CAREER_PRO_RANKED.gamesPerSession games, each decided
 * by the gap between the MMR the player's overall deserves and the MMR he
 * holds, so the ladder settles where his level is and moves when he grows.
 *
 * Deterministic: the RNG is a stream of the career seed keyed by the season,
 * day and the player's session count.
 */

import { CAREER_PRO_RANKED as R, CAREER_PRO_WEEK as W, RANKS } from "@/config/balance";
import { clamp } from "@/lib/util";
import { createRng } from "@/lib/rng";
import { deriveSeed } from "../seeds";
import { diffGrowth, blockGains, applyGains, PRO_STAT_KEYS } from "./growth";
import { proOverall } from "./attrs";
import type { ProGrowthEntry, ProPlayer } from "./types";

export interface RankOf {
  /** A Draft rank id (RANKS / rankSrc). */
  id: string;
  /** The Draft's rank name (a proper noun, the same in every language). */
  label: string;
  /** 1 (lowest) to 3 inside a tier; 0 for the top tier, which has none. */
  division: number;
  /** Position in the tier list, 0 = Bronze. */
  index: number;
}

export interface RankedCtx {
  seasonIndex: number;
  day: number;
  careerSeed: number;
}

/** The MMR an overall deserves (CAREER_PRO_RANKED.skillTable, linear between rows, flat beyond). */
export function skillMmrFor(overall: number): number {
  const t = R.skillTable;
  if (overall <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (overall <= t[i][0]) {
      const [x0, y0] = t[i - 1];
      const [x1, y1] = t[i];
      return y0 + ((overall - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return t[t.length - 1][1];
}

export function rankOf(mmr: number): RankOf {
  const m = clamp(mmr, R.mmrMin, R.mmrMax);
  let index = 0;
  for (let i = 0; i < R.tiers.length; i++) if (m >= R.tiers[i].min) index = i;
  const tier = R.tiers[index];
  const next = R.tiers[index + 1];
  const label = RANKS.find((r) => r.id === tier.id)?.label ?? tier.id;
  if (!next) return { id: tier.id, label, division: 0, index };
  const width = (next.min - tier.min) / R.divisions;
  return { id: tier.id, label, division: 1 + Math.min(R.divisions - 1, Math.floor((m - tier.min) / width)), index };
}

/** Grand Champion and above open the cup invitations. */
export function cupsUnlocked(player: Pick<ProPlayer, "mmr">): boolean {
  const need = R.tiers.findIndex((t) => t.id === R.cupsRankId);
  return rankOf(player.mmr).index >= need;
}

/** The overall a ranked game is played at: his own, plus his form, minus tiredness. */
export function effectiveOverall(player: ProPlayer): number {
  const tired = Math.max(0, W.lowEnergy - player.energy) * W.tiredFormPerPoint;
  return proOverall(player.attrs) + player.confidence * R.confidenceSkill - tired;
}

/** The chance to win one ranked game now. */
export function winChance(player: ProPlayer): number {
  const gap = skillMmrFor(effectiveOverall(player)) - player.mmr;
  return 1 / (1 + Math.exp(-gap / R.spread));
}

/** Expected MMR change of one session (the planner's projection; no RNG). */
export function expectedSessionDelta(player: ProPlayer): number {
  return Math.round(R.gamesPerSession * R.step * (2 * winChance(player) - 1));
}

/** The small XP a ranked block gives: a share of a balanced training block, at the energy he queues with. */
export function rankedXp(player: ProPlayer, ctx: RankedCtx) {
  const gains = blockGains(player, "balanced", { seasonIndex: ctx.seasonIndex, coachOverall: null });
  const scaled: Partial<Record<(typeof PRO_STAT_KEYS)[number], number>> = {};
  for (const k of PRO_STAT_KEYS) scaled[k] = (gains[k] ?? 0) * W.rankedXpShare;
  return applyGains(player.attrs, scaled);
}

/**
 * One ranked block. Spends the block's energy, moves the MMR, gives a little
 * XP and logs the session. `won` = more wins than losses.
 */
export function playRankedSession(
  player: ProPlayer,
  ctx: RankedCtx,
): { player: ProPlayer; mmrDelta: number; won: boolean; wins: number; games: number; growth: ProGrowthEntry[] } {
  const sessions = player.rankedSessions ?? 0;
  const rng = createRng(deriveSeed(ctx.careerSeed, `pro:ranked:${ctx.seasonIndex}:${ctx.day}:${sessions}`));
  const p = winChance(player);
  let wins = 0;
  let mmr = player.mmr;
  const before = mmr;
  for (let g = 0; g < R.gamesPerSession; g++) {
    const win = rng.next() < p;
    if (win) wins++;
    mmr = clamp(mmr + (win ? R.step : -R.step), R.mmrMin, R.mmrMax);
  }
  const attrs = rankedXp(player, ctx);
  const growth = diffGrowth(player.attrs, attrs, "ranked", ctx);
  const mmrDelta = mmr - before;
  const entry = { seasonIndex: ctx.seasonIndex, day: ctx.day, mmrDelta, wins, games: R.gamesPerSession, mmr };
  const next: ProPlayer = {
    ...player,
    attrs,
    mmr,
    energy: Math.max(0, player.energy - W.cost.ranked),
    rankedSessions: sessions + 1,
    rankedLog: [...(player.rankedLog ?? []), entry].slice(-R.logCap),
  };
  return { player: next, mmrDelta, won: wins * 2 > R.gamesPerSession, wins, games: R.gamesPerSession, growth };
}
