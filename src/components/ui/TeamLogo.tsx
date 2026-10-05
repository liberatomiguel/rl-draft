"use client";

/**
 * Org logo with era awareness and graceful fallback (v0.5.1).
 *
 * Orgs rebrand: a card from RLCS S5 should wear the logo of THAT era, not
 * today's. Pass the card/lineup `seasonId` and, when the org declares
 * `logoEras` (see ORG_LOGO_ERAS in scripts/build-dataset.mjs), the source
 * chain becomes:
 *   era variant ("<orgId>@<era>")  →  default logo  →  styled monogram
 * Without a seasonId (or for single-identity orgs) it's the default logo.
 * URLs come from the asset manifest (src/lib/assets.ts): in production they
 * are small WebP variants sized for the display box, and a logo that has no
 * file is skipped up front — an org without any logo renders the monogram
 * immediately, with zero requests. onError still walks the chain as a
 * safety net. All assets are local files under public/ — nothing is fetched
 * from the internet at runtime.
 */

import { useState } from "react";
import { orgById, seasonById } from "@/data";
import { orgLogoSrc } from "@/lib/assets";
import { cx, initials } from "@/lib/util";

const SIZES = {
  xs: "h-4 w-4 text-[7px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-11 w-11 text-sm",
  lg: "h-[4.5rem] w-[4.5rem] text-xl",
  xl: "h-[5.5rem] w-[5.5rem] text-2xl",
} as const;

/** CSS px of each SIZES box — picks the logo variant and sets the <img>
 *  width/height attributes (equal to the CSS box, so no layout change). */
const SIZE_PX: Record<keyof typeof SIZES, number> = {
  xs: 16,
  sm: 24,
  md: 44,
  lg: 72,
  xl: 88,
};

export function TeamLogo({
  orgId,
  seasonId,
  size = "md",
  className,
}: {
  orgId: string;
  /** Season the card/lineup belongs to — selects the era logo variant. */
  seasonId?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const org = orgById.get(orgId);
  const name = org?.name ?? orgId;
  const px = SIZE_PX[size];

  // Source chain: era variant (if any) → default logo → monogram fallback.
  // Entries with no file are skipped (orgLogoSrc → null), so they cost nothing.
  const order = seasonId ? seasonById.get(seasonId)?.order : undefined;
  const era =
    order !== undefined
      ? org?.logoEras?.find((e) => order <= e.untilOrder)
      : undefined;
  const sources = [
    era ? orgLogoSrc(`${orgId}@${era.key}`, px) : null,
    org?.logoUrl || orgLogoSrc(orgId, px),
  ].filter((s): s is string => Boolean(s));

  // URLs that failed to load on this mount. Derived, not reset by an effect:
  // when the org/era/size changes, the new chain's URLs aren't in the list, so
  // it starts again from its first entry.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const src = sources.find((s) => !failed.includes(s));

  if (!src) {
    return (
      <span
        aria-label={name}
        title={name}
        className={cx(
          "flex shrink-0 items-center justify-center rounded-lg border border-line-strong",
          "bg-gradient-to-br from-slate-500/30 to-slate-800/50",
          "display font-bold uppercase text-white/80",
          SIZES[size],
          className,
        )}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      title={name}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      onError={() => setFailed((f) => (f.includes(src) ? f : [...f, src]))}
      className={cx("shrink-0 object-contain", SIZES[size], className)}
    />
  );
}
