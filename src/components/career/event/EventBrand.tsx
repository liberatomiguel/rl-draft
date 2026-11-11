"use client";

import { useState } from "react";
import { partnerLogoSrc } from "@/lib/assets";
import { cx } from "@/lib/util";

/** The partner whose art an event or insert carries, by its name (null: none). */
export function eventBrandIdOf(name: string): "rocketstreet" | "fiftyfifty" | "duds" | null {
  return /rocket street/i.test(name) ? "rocketstreet" : /50\/50|5050/i.test(name) ? "fiftyfifty" : /duds/i.test(name) ? "duds" : null;
}

const SIZE = { sm: "h-10 w-10", md: "h-14 w-14", lg: "h-20 w-20 sm:h-24 sm:w-24" } as const;

/**
 * Same supplied partner art everywhere an invitation or tournament is shown.
 * rc.49: one logo per card, sized by the caller ("lg" only on the insert
 * cards, the Duds reference); the caller owns the spacing.
 */
export function EventBrand({ name, size = "md", className }: { name: string; size?: keyof typeof SIZE; className?: string }) {
  const id = eventBrandIdOf(name);
  const src = id ? partnerLogoSrc(id) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- static art served through the asset manifest
  return <img src={src} alt={id === "rocketstreet" ? "Rocket Street" : id === "duds" ? "DudsMelow" : "50/50"} width={96} height={96} onError={() => setFailedSrc(src)} className={cx("shrink-0 rounded-lg object-contain", SIZE[size], className)} />;
}
