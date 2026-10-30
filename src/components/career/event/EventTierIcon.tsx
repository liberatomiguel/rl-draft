"use client";

/**
 * Road to Worlds rc.36 (CAL-01, R88) — one icon per event tier, in its tier
 * colour: the calendar's cells, legend and day detail, and the follow view.
 * Worlds a trophy (gold), a Major a star, a regional a flag, Saturday's
 * qualifier crossed swords (blue: the way in), the cups a shield.
 */

import type { EventTier } from "@/engine/career/types";
import { FlagIcon, ShieldIcon, StarIcon, SwordsIcon, TrophyIcon } from "@/components/ui/icons";

export const TIER_ICON_TONE: Record<EventTier, string> = {
  worlds: "text-amber-300",
  major: "text-orange-bright",
  regional: "text-orange-bright",
  qualifier: "text-cyan",
  t2: "text-orange",
  t3: "text-orange",
};

export function EventTierIcon({ tier, className }: { tier: EventTier; className?: string }) {
  if (tier === "worlds") return <TrophyIcon className={className} />;
  if (tier === "major") return <StarIcon className={className} />;
  if (tier === "regional") return <FlagIcon className={className} />;
  if (tier === "qualifier") return <SwordsIcon className={className} />;
  return <ShieldIcon className={className} />;
}
