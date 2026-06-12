"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/util";

type Tone = "neutral" | "blue" | "orange" | "good" | "bad" | "gold";

const TONES: Record<Tone, string> = {
  neutral: "border-line-strong bg-white/5 text-sub",
  blue: "border-blue/40 bg-blue/10 text-blue-bright",
  orange: "border-orange/40 bg-orange/10 text-orange-bright",
  good: "border-good/40 bg-good/10 text-good",
  bad: "border-bad/40 bg-bad/10 text-bad",
  gold: "border-amber-400/40 bg-amber-400/10 text-amber-300",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "display inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Country chip: real flag from public/flags/<cc>.png when present
 * (populated by `npm run fetch:assets -- --flags`), text code otherwise.
 * Region codes (NA/EU/…) have no flag file and use the text fallback.
 */
export function CountryChip({ code, className }: { code: string; className?: string }) {
  const src = `/flags/${code.toLowerCase()}.png`;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={code}
        title={code}
        onError={() => setFailed(true)}
        className={cx(
          "inline-block h-3.5 w-5 rounded-[3px] border border-line-strong object-cover shadow-sm",
          className,
        )}
      />
    );
  }

  return (
    <span
      title={code}
      className={cx(
        "inline-flex items-center justify-center rounded border border-line-strong bg-white/5 px-1.5 py-px font-mono text-[10px] font-semibold tracking-widest text-sub",
        className,
      )}
    >
      {code}
    </span>
  );
}
