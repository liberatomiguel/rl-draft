"use client";

/**
 * Org logo with era awareness and graceful fallback (v0.5.1).
 *
 * Orgs rebrand: a card from RLCS S5 should wear the logo of THAT era, not
 * today's. Pass the card/lineup `seasonId` and, when the org declares
 * `logoEras` (see ORG_LOGO_ERAS in scripts/build-dataset.mjs), the source
 * chain becomes:
 *   /orgs/<orgId>@<era>.png  →  /orgs/<orgId>.png  →  styled monogram
 * Without a seasonId (or for single-identity orgs) it's the default logo.
 * All assets are local files under public/ — nothing is fetched from the
 * internet at runtime.
 */

import { useEffect, useState } from "react";
import { orgById, seasonById } from "@/data";
import { cx, initials } from "@/lib/util";

const SIZES = {
  xs: "h-4 w-4 text-[7px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-11 w-11 text-sm",
  lg: "h-[4.5rem] w-[4.5rem] text-xl",
  xl: "h-[5.5rem] w-[5.5rem] text-2xl",
} as const;

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

  // Source chain: era variant (if any) → default logo → monogram fallback.
  const sources: string[] = [];
  const order = seasonId ? seasonById.get(seasonId)?.order : undefined;
  const era =
    order !== undefined
      ? org?.logoEras?.find((e) => order <= e.untilOrder)
      : undefined;
  if (era) sources.push(`/orgs/${orgId}@${era.key}.png`);
  sources.push(org?.logoUrl || `/orgs/${orgId}.png`);

  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [orgId, era?.key]);

  if (sourceIndex >= sources.length) {
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
      src={sources[sourceIndex]}
      alt={name}
      title={name}
      onError={() => setSourceIndex((i) => i + 1)}
      className={cx("shrink-0 object-contain", SIZES[size], className)}
    />
  );
}
