/**
 * Region color identities (v0.5) — one accent per RLCS region so a drawn
 * lineup's origin reads at a glance in the draft.
 */

import type { Region } from "@/engine/types";

/** For <Badge> className — importants beat the badge's default neutral tone. */
export const REGION_BADGE: Record<Region, string> = {
  NA: "!border-blue-400/50 !bg-blue-400/10 !text-blue-300",
  EU: "!border-amber-400/50 !bg-amber-400/10 !text-amber-300",
  SAM: "!border-emerald-400/50 !bg-emerald-400/10 !text-emerald-300",
  MENA: "!border-purple-400/50 !bg-purple-400/10 !text-purple-300",
  OCE: "!border-cyan-400/50 !bg-cyan-400/10 !text-cyan-300",
  APAC: "!border-rose-400/50 !bg-rose-400/10 !text-rose-300",
  SSA: "!border-orange-400/50 !bg-orange-400/10 !text-orange-300",
};

export const REGION_TEXT: Record<Region, string> = {
  NA: "text-blue-300",
  EU: "text-amber-300",
  SAM: "text-emerald-300",
  MENA: "text-purple-300",
  OCE: "text-cyan-300",
  APAC: "text-rose-300",
  SSA: "text-orange-300",
};
