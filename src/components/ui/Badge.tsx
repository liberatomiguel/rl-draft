"use client";

import { useState } from "react";
import { flagSprite, flagSrc } from "@/lib/assets";
import { cx } from "@/lib/util";

type Tone = "neutral" | "blue" | "orange" | "good" | "bad" | "gold";

// A flat tag: a tinted block with no outline. The border stays in the box
// model (transparent) so a caller's own `border-*` override still works.
const TONES: Record<Tone, string> = {
  neutral: "border-transparent bg-white/[0.07] text-sub",
  blue: "border-transparent bg-blue/15 text-blue-bright",
  orange: "border-transparent bg-orange/15 text-orange-bright",
  good: "border-transparent bg-good/15 text-good",
  bad: "border-transparent bg-bad/15 text-bad",
  gold: "border-transparent bg-amber-400/15 text-amber-300",
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
        "display inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-tight tracking-[0.05em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The flag chip's box: 20 × 14 CSS px with a 1 px border, so the flag fills
 *  18 × 12 — the flag sprite's cell (FLAG_SPRITE in build-images.mjs). */
const FLAG_BOX = "inline-block h-3.5 w-5 rounded-[3px] border border-line-strong shadow-sm";

/**
 * Country chip: real flag from public/flags/<cc>.png when present
 * (populated by `npm run fetch:assets -- --flags`), text code otherwise.
 * Region codes (NA/EU/…) have no flag file: the asset manifest knows that
 * (flagSrc → null), so they render the text chip with no request at all.
 * onError stays as a safety net for a flag that fails to load.
 * Production (rc.32, WEB-02, #149): every flag is a cell of ONE sprite (one
 * request for all the flags of a page); the chip clips the sprite <img> to its
 * box. If the sprite fails, the raw PNG is next, then the text chip. Dev
 * shows the raw PNGs. `className` styles the box (not its size).
 */
export function CountryChip({ code, className }: { code: string; className?: string }) {
  const cell = flagSprite(code);
  const raw = flagSrc(code);
  // URLs that failed to load on this mount (derived reset: a new code → a new
  // raw URL → retried; a failed sprite stays skipped, it serves every code).
  const [failed, setFailed] = useState<readonly string[]>([]);
  const fail = (url: string) => setFailed((f) => (f.includes(url) ? f : [...f, url]));

  if (cell && !failed.includes(cell.src)) {
    return (
      <span role="img" aria-label={code} title={code} className={cx("relative overflow-hidden", FLAG_BOX, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cell.src}
          alt=""
          decoding="async"
          onError={() => fail(cell.src)}
          className="absolute max-w-none"
          style={{ left: -cell.left, top: -cell.top, width: cell.width, height: cell.height }}
        />
      </span>
    );
  }

  if (raw && !failed.includes(raw)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={raw}
        alt={code}
        title={code}
        onError={() => fail(raw)}
        className={cx(FLAG_BOX, "object-cover", className)}
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
