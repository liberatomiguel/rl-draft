"use client";

/**
 * Org logo with graceful fallback.
 * Looks for /orgs/<orgId>.png (drop real logos into public/orgs/) and falls
 * back to a styled monogram while the image is missing.
 */

import { useState } from "react";
import { orgById } from "@/data";
import { cx, initials } from "@/lib/util";

const SIZES = {
  xs: "h-4 w-4 text-[7px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-20 w-20 text-2xl",
} as const;

export function TeamLogo({
  orgId,
  size = "md",
  className,
}: {
  orgId: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const org = orgById.get(orgId);
  const name = org?.name ?? orgId;
  const src = org?.logoUrl || `/orgs/${orgId}.png`;

  if (failed) {
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
      onError={() => setFailed(true)}
      className={cx("shrink-0 object-contain", SIZES[size], className)}
    />
  );
}
