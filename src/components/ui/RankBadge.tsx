"use client";

/**
 * Rank emblem with two art sets (drop images into public/ranks/):
 *   menu variant    → /ranks/menu/<rankId>.png     (home screen)
 *   profile variant → /ranks/profile/<rankId>.png  (profile screen)
 * Falls back to a styled CSS emblem until the images exist.
 */

import { useEffect, useState } from "react";
import type { RankInfo } from "@/engine/progression";
import { cx } from "@/lib/util";

const SIZES = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-28 w-28",
} as const;

const RANK_TINT: Record<string, string> = {
  unranked: "from-slate-500/25 to-slate-800/40 border-slate-400/30",
  bronze: "from-amber-700/35 to-amber-950/50 border-amber-600/40",
  silver: "from-slate-300/30 to-slate-600/40 border-slate-300/40",
  gold: "from-amber-300/35 to-amber-700/45 border-amber-300/50",
  platinum: "from-cyan-200/30 to-sky-700/40 border-cyan-200/40",
  diamond: "from-sky-300/35 to-blue-700/45 border-sky-300/50",
  champion: "from-violet-300/35 to-purple-800/45 border-violet-300/50",
  "grand-champion": "from-rose-300/35 to-red-800/45 border-rose-300/50",
  "supersonic-legend": "from-fuchsia-300/40 to-orange-600/45 border-fuchsia-300/60",
};

export function RankBadge({
  rank,
  variant,
  size = "md",
  className,
}: {
  rank: Pick<RankInfo, "id" | "label">;
  variant: "menu" | "profile";
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const src = `/ranks/${variant}/${rank.id}.png`;
  const [failed, setFailed] = useState(false);

  // Re-try when the rank changes (e.g. rank up while mounted).
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <span
        aria-label={rank.label}
        title={rank.label}
        className={cx(
          "flex shrink-0 items-center justify-center rounded-full border-2 bg-gradient-to-br",
          RANK_TINT[rank.id] ?? RANK_TINT.unranked,
          SIZES[size],
          className,
        )}
      >
        <span className="display px-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-ink">
          {rank.label}
        </span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={rank.label}
      title={rank.label}
      onError={() => setFailed(true)}
      className={cx("shrink-0 object-contain", SIZES[size], className)}
    />
  );
}
