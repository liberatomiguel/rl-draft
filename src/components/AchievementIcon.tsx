"use client";

/**
 * One hand-drawn line icon PER achievement (22). Category colors come from
 * the grid; unknown ids fall back to a generic trophy.
 */

const P = {
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function AchievementIcon({ id, className = "h-4 w-4" }: { id: string; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    className,
    "aria-hidden": true as const,
  };

  switch (id) {
    case "first-draft": // card with a plus
      return (
        <svg {...common}><rect x="6" y="3.5" width="12" height="17" rx="2" /><path d="M12 9v6m-3-3h6" {...P} /></svg>
      );
    case "first-title": // rocket lifting off
      return (
        <svg {...common}><path d="M12 3c3 2 4 5.5 4 8.5L12 15l-4-3.5C8 8.5 9 5 12 3Z" {...P} /><path d="M8 14l-2 4m10-4 2 4m-6-2v4" {...P} /></svg>
      );
    case "swiss-merchant": // 3-0 scoreboard
      return (
        <svg {...common}><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M8.5 10v4m3.5-4-1 4m4.5-4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" {...P} /></svg>
      );
    case "game-seven-ice": // ice crystal
      return (
        <svg {...common}><path d="M12 3v18M5 7.5l14 9M19 7.5l-14 9M12 7l2.5-2M12 7 9.5 5M12 17l2.5 2M12 17l-2.5 2" {...P} /></svg>
      );
    case "comeback-kings": // arrow turning back up
      return (
        <svg {...common}><path d="M5 7v6a4 4 0 0 0 4 4h9" {...P} /><path d="m14.5 13.5 3.5 3.5-3.5 3.5M19 7l-4-3.5" {...P} /></svg>
      );
    case "dynasty-builder": // three crowns stacked
      return (
        <svg {...common}><path d="m5 9 2-2.5L9.5 9l2.5-3 2.5 3L17 6.5 19 9l-1 4H6L5 9Z" {...P} /><path d="M6.5 16.5h11M8 20h8" {...P} /></svg>
      );
    case "podium": // podium steps
      return (
        <svg {...common}><path d="M9 20v-8h6v8M9 20H4v-5h5m6 5h5v-3.5h-5M12 4l1 2h2l-1.6 1.3.6 2-2-1.2-2 1.2.6-2L9 6h2l1-2Z" {...P} /></svg>
      );
    case "the-long-way": // winding path up
      return (
        <svg {...common}><path d="M4 19c5 0 5-4 1.5-4S2 11 7 11s6-4 2-4" {...P} /><path d="M14 5h6v6m0-6-8 8" {...P} /></svg>
      );
    case "strangers": // broken link
      return (
        <svg {...common}><path d="M9 12a4 4 0 0 1 4-4h2a4 4 0 0 1 0 8h-1" {...P} /><path d="M15 12a4 4 0 0 1-4 4H9a4 4 0 0 1-2.5-7" {...P} /><path d="m4 4 3 3m13 13-3-3" {...P} /></svg>
      );
    case "old-school": // retro clock
      return (
        <svg {...common}><circle cx="12" cy="13" r="7" /><path d="M12 9.5V13l2.5 1.5M5 5l2 2m12-2-2 2" {...P} /></svg>
      );
    case "one-country-army": // flag
      return (
        <svg {...common}><path d="M6 21V4m0 1h11l-2.5 4L17 13H6" {...P} /></svg>
      );
    case "against-the-odds": // dice showing a long shot
      return (
        <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" /></svg>
      );
    case "no-numbers-needed": // crossed-out eye
      return (
        <svg {...common}><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" {...P} /><circle cx="12" cy="12" r="2.5" /><path d="m4 4 16 16" {...P} /></svg>
      );
    case "hard-mode-hero": // skull
      return (
        <svg {...common}><path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6v3h9v-3c2-1 3.5-3 3.5-6a8 8 0 0 0-8-8Z" {...P} /><circle cx="9" cy="11" r="1.3" fill="currentColor" stroke="none" /><circle cx="15" cy="11" r="1.3" fill="currentColor" stroke="none" /></svg>
      );
    case "legacy-unlocked": // opening padlock
      return (
        <svg {...common}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" {...P} /><path d="M12 14.5v2.5" {...P} /></svg>
      );
    case "legacy-cleared": // gauntlet fist
      return (
        <svg {...common}><path d="M7 13V7.5a1.5 1.5 0 0 1 3 0V12m0-4.5v-1a1.5 1.5 0 0 1 3 0V12m0-4.5a1.5 1.5 0 0 1 3 0V13" {...P} /><path d="M7 13c-2 0-2.5 2 0 3.5V19a2 2 0 0 0 2 2h5a3 3 0 0 0 3-3v-5" {...P} /></svg>
      );
    case "perfect-chemistry": // flask
      return (
        <svg {...common}><path d="M10 3h4m-3 0v6l-5 9a2 2 0 0 0 1.8 3h8.4a2 2 0 0 0 1.8-3l-5-9V3" {...P} /><path d="M8.5 15h7" {...P} /></svg>
      );
    case "collector": // single shining card
      return (
        <svg {...common}><rect x="7" y="4" width="10" height="15" rx="2" /><path d="m12 8 1 2 2 .3-1.5 1.4.4 2.1L12 12.7l-1.9 1.1.4-2.1L9 10.3l2-.3 1-2Z" {...P} /></svg>
      );
    case "archive-hunter": // fanned cards
      return (
        <svg {...common}><rect x="4" y="5" width="9" height="13" rx="1.5" /><path d="M13.5 5.5 17 6a1.5 1.5 0 0 1 1.3 1.7L17 17.5" {...P} /><path d="m18.5 8 1.8.8a1.5 1.5 0 0 1 .7 2L19 16" {...P} /></svg>
      );
    case "curator": // framed gallery
      return (
        <svg {...common}><rect x="3.5" y="5" width="7.5" height="9" rx="1" /><rect x="13" y="5" width="7.5" height="9" rx="1" /><path d="M6 19h12" {...P} /></svg>
      );
    case "immaculate": // flawless gem
      return (
        <svg {...common}><path d="M7 4h10l4 5-9 11L3 9l4-5Z" {...P} /><path d="M3 9h18M9.5 9 12 20l2.5-11" {...P} /></svg>
      );
    case "untouchable": // shield with zero
      return (
        <svg {...common}><path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" {...P} /><ellipse cx="12" cy="12" rx="2.4" ry="3.2" /></svg>
      );
    default: // fallback trophy
      return (
        <svg {...common}><path d="M8 4h8v5a4 4 0 0 1-8 0Z" {...P} /><path d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v4m-3 3h6" {...P} /></svg>
      );
  }
}
