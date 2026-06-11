/**
 * Rank progression — XP thresholds → Rocket League inspired ranks.
 */

import { RANKS } from "@/config/balance";

export interface RankInfo {
  id: string;
  label: string;
  minXp: number;
  index: number;
  next: { label: string; minXp: number } | null;
  /** 0..1 progress toward the next rank (1 at top rank). */
  progress: number;
  xpToNext: number;
}

export function rankForXp(xp: number): RankInfo {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXp) index = i;
  }
  const rank = RANKS[index];
  const next = index + 1 < RANKS.length ? RANKS[index + 1] : null;
  const progress = next
    ? Math.min(1, (xp - rank.minXp) / (next.minXp - rank.minXp))
    : 1;
  return {
    id: rank.id,
    label: rank.label,
    minXp: rank.minXp,
    index,
    next: next ? { label: next.label, minXp: next.minXp } : null,
    progress,
    xpToNext: next ? Math.max(0, next.minXp - xp) : 0,
  };
}
