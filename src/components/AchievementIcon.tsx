/**
 * Achievement icon (v1.4) — one hand-drawn glyph per GROUP (the set grew to ~56,
 * so a per-id icon no longer scales). Tinted by the earned/locked chip color in
 * the grid. viewBox 0 0 24 24, currentColor, round caps — the house style.
 */

import type { AchievementDef } from "@/engine/types";

const P = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function AchievementIcon({
  group,
  className = "h-4 w-4",
}: {
  group: AchievementDef["group"];
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    className,
    "aria-hidden": true,
  } as const;

  switch (group) {
    case "milestone": // flag on a pole
      return (
        <svg {...common}>
          <path d="M6 21V4" {...P} />
          <path d="M6 5h11l-2.5 3L17 11H6Z" {...P} />
        </svg>
      );
    case "mode": // flame (difficulty / modes)
      return (
        <svg {...common}>
          <path d="M12 3c1.3 3.2 4 4.6 4 8.2a4 4 0 0 1-8 0c0-1.7.7-2.8 1.8-3.7.1 1.7 1 2.3 1.8 2.3C12.1 9 11.2 6.4 12 3Z" {...P} />
        </svg>
      );
    case "performance": // star
      return (
        <svg {...common}>
          <path d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9Z" {...P} />
        </svg>
      );
    case "chemistry": // linked nodes
      return (
        <svg {...common}>
          <circle cx="6.5" cy="8" r="2.2" />
          <circle cx="17.5" cy="8" r="2.2" />
          <circle cx="12" cy="16.5" r="2.2" />
          <path d="M8.4 9.2 10.6 14.6M15.6 9.2 13.4 14.6M8.7 8h6.6" {...P} />
        </svg>
      );
    case "roster": // two people
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20c.9-3.2 3-4.8 5.5-4.8s4.6 1.6 5.5 4.8" {...P} />
          <path d="M16 6.2a3 3 0 0 1 0 5.6M17 20c-.3-2-1-3.6-2.2-4.6" {...P} />
        </svg>
      );
    case "collection": // card / album
      return (
        <svg {...common}>
          <rect x="4" y="3.5" width="10" height="14" rx="2" />
          <path d="M9 20.5h9a2 2 0 0 0 2-2V8" {...P} />
        </svg>
      );
    case "progression": // upward chevrons
      return (
        <svg {...common}>
          <path d="M6 13l6-6 6 6M6 18l6-6 6 6" {...P} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
