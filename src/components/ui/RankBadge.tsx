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

/** Intrinsic px per size — set as width/height so the slot is reserved
 *  before the PNG loads (no layout shift / late paint). v1.0 perf fix. */
const SIZE_PX = { sm: 48, md: 80, lg: 112 } as const;

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

/**
 * Per-rank visual-size normalisation for the **menu** art set (v1.4.4). Those PNGs
 * are all 160×160 but fill the canvas by wildly different amounts — gold's solid
 * triangle covers ~47% of pixels while Supersonic Legend's airy winged emblem covers
 * ~25% — so under `object-contain` the heavier ones rendered visibly oversized in the
 * header. Supersonic Legend is the reference "right" size (matches the live profile
 * art set, which is already uniform at ~0.30 coverage). Each factor = √(SSL coverage /
 * this rank's coverage), clamped to ≤1 (only shrink), measured from the opaque-pixel
 * area. Tweak a single value by eye to taste; ranks not listed render at 1.0. The
 * profile variant is already uniform, so this applies to `variant: "menu"` only.
 */
const MENU_GLYPH_SCALE: Record<string, number> = {
  gold: 0.73,
  silver: 0.76,
  bronze: 0.78,
  diamond: 0.79,
  "grand-champion": 0.81,
  platinum: 0.89,
  champion: 0.9,
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
  // Normalise the menu art's wildly-varying canvas fill so no rank looks oversized
  // next to another (v1.4.4). Reserved layout box is unchanged (transform doesn't
  // reflow), so there's no layout shift — only the painted glyph shrinks.
  const glyphScale = variant === "menu" ? MENU_GLYPH_SCALE[rank.id] ?? 1 : 1;

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
      width={SIZE_PX[size]}
      height={SIZE_PX[size]}
      loading="eager"
      // NOT high priority: the rank emblem is decorative and mounted-gated
      // (it paints after hydration), so it is never the LCP. High priority here
      // only stole bandwidth from the real LCP (the hero paragraph) on mobile.
      decoding="async"
      onError={() => setFailed(true)}
      style={glyphScale !== 1 ? { transform: `scale(${glyphScale})` } : undefined}
      className={cx("shrink-0 object-contain", SIZES[size], className)}
    />
  );
}
