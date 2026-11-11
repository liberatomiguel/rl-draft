"use client";

import { useState } from "react";
import { partnerLogoSrc } from "@/lib/assets";

/** Same supplied partner art everywhere an invitation or tournament is shown. */
export function EventBrand({ name }: { name: string }) {
  const id = /50\/50|5050/i.test(name) ? "fiftyfifty" : /duds/i.test(name) ? "duds" : null;
  const src = id ? partnerLogoSrc(id) : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- static art served through the asset manifest
  return <img src={src} alt={id === "duds" ? "DudsMelow" : "50/50"} width={96} height={96} onError={() => setFailedSrc(src)} className="mb-3 h-20 w-20 sm:h-24 sm:w-24 rounded-lg object-contain" />;
}
