/**
 * Achievement icon (v1.4) — one hand-drawn glyph per GROUP (the set grew to ~56,
 * so a per-id icon no longer scales). Tinted by the earned/locked chip color in
 * the grid. viewBox 0 0 24 24, currentColor, round caps — the house style.
 */

import type { AchievementDef } from "@/engine/types";

const P = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function AchievementIcon({
  group,
  id,
  className = "h-4 w-4",
}: {
  /** rc.36 (UX-05): "career" = a Road to Worlds achievement (the general list's mode filter). */
  group: AchievementDef["group"] | "career";
  className?: string;
  id?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    className,
    "aria-hidden": true,
  } as const;

  const careerPaths: Record<string, string> = {
    "car-first-sponsor": "M4 8h16v12H4ZM8 8V5h8v3M4 12h16M10 12v3h4v-3",
    "car-bank-cleared": "M3 9l9-6 9 6H3ZM6 11v7m6-7v7m6-7v7M3 21h18m-7-5 2 2 4-4",
    "car-first-qualifier": "M5 21V4h13l-3 4 3 4H5m5 5 2 2 5-5",
    "car-rep-50": "M4 18l5-5 4 3 7-10m-5 0h5v5M4 22h16",
    "car-three-seasons": "M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16m-12 4h2m4 0h2m-8 4h2",
    "car-major-qualified": "M3 16l6-6 4 3 8-9m-5 0h5v5M3 21h18",
    "car-first-regional": "M7 3h10v7a5 5 0 0 1-10 0V3ZM7 5H3v4l4 2m10-6h4v4l-4 2m-5 4v6m-4 0h8",
    "car-worlds-qualified": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z",
    "car-rep-100": "M3 18l2-12 5 5 2-7 3 7 5-5 1 12H3Zm2 3h14",
    "car-first-major": "M12 2l3 6 6 1-4 5 1 7-6-3-6 3 1-7-4-5 6-1Z",
    "car-first-worlds": "M7 3h10v7a5 5 0 0 1-10 0V3ZM3 5h4m10 0h4m-9 10v5m-5 2h10M10 6h4",
    "car-worlds-underdog": "M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 13 8-7m-8 0h8v7",
    "car-worlds-homegrown": "M12 22v-9m0 3C3 16 3 8 3 8s9 0 9 8Zm0-4c0-8 9-9 9-9s0 9-9 9Z",
    "car-three-worlds": "M12 3l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1Zm-8 14v5m8-5v5m8-5v5",
    "car-all-difficulties": "M3 21 8 9l4 6 4-12 5 18H3Z",
  };
  if (group === "career" && id && careerPaths[id]) return <svg {...common}><path d={careerPaths[id]} {...P} /></svg>;
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
    case "career": // the road, to the horizon (Road to Worlds)
      return (
        <svg {...common}>
          <path d="M5 21 10.2 4M19 21 13.8 4" {...P} />
          <path d="M12 19.5v-2.2M12 13.6v-1.8M12 8.6V7.4" {...P} />
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
