/**
 * Shared inline-SVG icons (v1.4). The app draws every icon by hand (no icon
 * library) — viewBox 0 0 24 24, `currentColor`, round caps/joins for the soft
 * broadcast look. Keep new icons consistent with AppShell's nav glyphs.
 */

const P = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** rc.35 (sponsor comparison): a stroked 24px glyph from its paths. */
function Glyph({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Coins — weekly pay. */
export function CoinsIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <ellipse cx="9" cy="7" rx="5" ry="2.5" {...P} />
      <path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" {...P} />
      <path d="M10 15.3c.9 1.3 3 2.2 5.5 2.2 2.8 0 5-1.1 5-2.5v-4c0-1.4-2.2-2.5-5-2.5" {...P} />
      <path d="M14 13.4c.5.1 1 .1 1.5.1 2.8 0 5-1.1 5-2.5" {...P} />
    </Glyph>
  );
}

/** Signature — a payment on signing. */
export function SignIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M3 19.5h18" {...P} />
      <path d="M5 15c2-4 3.5-6 4.5-6 1.6 0-1.5 6 .5 6 1.5 0 2.5-3 4-3 1.2 0 .8 2.5 2 2.5.8 0 1.5-.6 2-1.2" {...P} />
    </Glyph>
  );
}

/** Flag — a milestone (paid the day a first goal is reached). */
export function FlagIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M5 21V4" {...P} />
      <path d="M5 4.5h11l-2.5 4 2.5 4H5" {...P} />
    </Glyph>
  );
}

/** Trophy — a goal's bonus. */
export function TrophyIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" {...P} />
      <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.5M17 6h2.5a2.5 2.5 0 0 1-2.6 3.5" {...P} />
      <path d="M12 14v3.5M8.5 20.5h7M9.5 17.5h5v3h-5z" {...P} />
    </Glyph>
  );
}

/** Target — a goal. */
export function TargetIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="8.5" {...P} />
      <circle cx="12" cy="12" r="4.5" {...P} />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </Glyph>
  );
}

/** Warning triangle — a fine. */
export function FineIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" {...P} />
      <path d="M12 10v4.5M12 17.3v.2" {...P} />
    </Glyph>
  );
}

/** Shield — safe (no fine). */
export function ShieldIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 3 19.5 6v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6L12 3Z" {...P} />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" {...P} />
    </Glyph>
  );
}

/** Calendar — a deal's length / a payment date. */
export function CalendarIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" {...P} />
      <path d="M3.5 10h17M8 3v4M16 3v4" {...P} />
    </Glyph>
  );
}

/** Globe — a global sponsor. */
export function GlobeIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="8.5" {...P} />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5Z" {...P} />
    </Glyph>
  );
}

/** Crown — Legacy accent. Path matches the dynasty-builder achievement crown. */
export function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <path d="m5 9 2-2.5L9.5 9l2.5-3 2.5 3L17 6.5 19 9l-1 4H6L5 9Z" {...P} />
      <path d="M6.5 16.5h11" {...P} />
    </svg>
  );
}

/** Pencil — "edit" affordance (e.g. the display name on the profile card). */
export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <path d="M4 20.5h4L18.5 10l-4-4L4 16.5v4Z" {...P} />
      <path d="M13.5 7l4 4" {...P} />
    </svg>
  );
}

/** Lightning bolt — replaces the ⚡ emoji on the results eliminator (v1.4). */
export function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13 2 4 13.5h6L9 22l10-12h-6l1.4-8z" />
    </svg>
  );
}

/**
 * Legacy emblem — the prismatic hexagon with a crown inside. One source for the
 * unlock ceremony (framed, large), the setup card accent and the in-run Legacy
 * indicator. Size via `className` on the svg; `framed` adds the glowing tile.
 * Pass a unique `gradientId` when two emblems can render on the same screen.
 */
export function LegacyEmblem({
  className = "h-16 w-16",
  framed = false,
  gradientId = "legacyGrad",
}: {
  className?: string;
  framed?: boolean;
  gradientId?: string;
}) {
  const stroke = `url(#${gradientId})`;
  const svg = (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="0.5" stopColor="#a855f7" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      {/* hexagon shield */}
      <path d="M24 4 41 14v20L24 44 7 34V14Z" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      {/* crown */}
      <path
        d="M15 31 13.5 18.5 20 23 24 14.5 28 23 34.5 18.5 33 31Z"
        stroke={stroke}
        strokeWidth="2.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M15.5 31.5H32.5" stroke={stroke} strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
  if (!framed) return svg;
  return (
    <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-cyan/40 bg-gradient-to-br from-cyan/15 via-blue/10 to-purple-500/15 shadow-[0_0_44px_rgba(56,189,248,0.4)] md:h-32 md:w-32">
      {svg}
    </div>
  );
}
