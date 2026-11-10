"use client";

import { useState } from "react";
import { partnerLogoSrc } from "@/lib/assets";

/** Same supplied partner art everywhere an invitation or tournament is shown. */
export function EventBrand({ name }: { name: string }) {
  const id = /50\/50|5050/i.test(name) ? "fiftyfifty" : /duds/i.test(name) ? "duds" : null;
  const src = id ? partnerLogoSrc(id) : null;
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  // eslint-disable-next-line @next/next/no-img-element -- static art served through the asset manifest
  return <img src={src} alt={id === "duds" ? "DudsMelow" : "50/50"} width={40} height={40} onError={() => setFailed(true)} className="mb-2 h-10 w-10 rounded-lg object-contain" />;
}
