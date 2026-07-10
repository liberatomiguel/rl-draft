"use client";

/**
 * Road to Worlds — cosmetic team star rating (v0.2: 0-5★, half-star steps).
 *
 * Instant "who am I up against" read next to org names on standings, lobbies
 * and market chips. Purely cosmetic — never a gate. World-percentile driven
 * (engine starsFor), so the strong always read strong.
 */

import { CAREER_STARS } from "@/config/balance";

const SIZES = { xs: 8, sm: 10, md: 13 } as const;
const STAR_PATH =
  "M6 0.8 L7.5 4.2 L11.2 4.6 L8.4 7 L9.2 10.8 L6 8.8 L2.8 10.8 L3.6 7 L0.8 4.6 L4.5 4.2 Z";
const FILL_ON = "var(--orange, #f97316)";
const FILL_OFF = "rgba(148,163,184,0.28)";

export function TeamStars({
  stars,
  size = "sm",
  className,
}: {
  /** 0..5 in half steps (engine-clamped; re-clamped defensively here). */
  stars: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const max = CAREER_STARS.maxStars;
  const value = Math.max(0, Math.min(max, Math.round(stars * 2) / 2));
  const px = SIZES[size];
  return (
    <span
      className={`inline-flex items-center gap-[1px] ${className ?? ""}`}
      role="img"
      aria-label={`${value}-star team`}
      title={`${value}★`}
    >
      {Array.from({ length: max }, (_, i) => {
        const fillLevel = Math.max(0, Math.min(1, value - i)); // 0 | 0.5 | 1
        return (
          <svg key={i} width={px} height={px} viewBox="0 0 12 12" aria-hidden>
            <path d={STAR_PATH} fill={FILL_OFF} />
            {fillLevel > 0 && (
              <path
                d={STAR_PATH}
                fill={FILL_ON}
                style={
                  fillLevel < 1
                    ? { clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)" }
                    : undefined
                }
              />
            )}
          </svg>
        );
      })}
    </span>
  );
}
