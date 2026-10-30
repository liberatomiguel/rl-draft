/**
 * Shared inline-SVG icons (v1.4). The app draws every icon by hand (no icon
 * library) — viewBox 0 0 24 24, `currentColor`, round caps/joins for the soft
 * broadcast look. Keep new icons consistent with AppShell's nav glyphs.
 */

const P = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

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

/** rc.35 (front N) — the contract talk's levers and meter. */
function TalkGlyph({ className, children }: { className?: string; children: import("react").ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Coins — the weekly wage. */
export function CoinsIcon({ className }: { className?: string }) {
  return (
    <TalkGlyph className={className}>
      <ellipse cx="9" cy="7" rx="5" ry="2.5" {...P} />
      <path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" {...P} />
      <path d="M10 15.5c.6 1.2 2.6 2 5 2 2.8 0 5-1.1 5-2.5v-4c0-1.4-2.2-2.5-5-2.5" {...P} />
    </TalkGlyph>
  );
}

/** Trophy-percent — the prize share. */
export function PercentIcon({ className }: { className?: string }) {
  return (
    <TalkGlyph className={className}>
      <path d="m18 6-12 12" {...P} />
      <circle cx="7.5" cy="7.5" r="2.5" {...P} />
      <circle cx="16.5" cy="16.5" r="2.5" {...P} />
    </TalkGlyph>
  );
}

/** Gift — the signing bonus. */
export function GiftIcon({ className }: { className?: string }) {
  return (
    <TalkGlyph className={className}>
      <rect x="4" y="9" width="16" height="11" rx="1.5" {...P} />
      <path d="M3 9h18M12 9v11" {...P} />
      <path d="M12 9c-1.5-3-5-4-5-1.5S10 9 12 9Zm0 0c1.5-3 5-4 5-1.5S14 9 12 9Z" {...P} />
    </TalkGlyph>
  );
}

/** Handshake — his answer. */
export function HandshakeIcon({ className }: { className?: string }) {
  return (
    <TalkGlyph className={className}>
      <path d="m3 11 4-4 3 1 3-2 4 1 4 4" {...P} />
      <path d="m7 13 4 4c.6.6 1.4.6 2 0l5-5" {...P} />
      <path d="m10 10 3 3M3 11l4 4" {...P} />
    </TalkGlyph>
  );
}

/** Calendar — the contract length. */
export function CalendarIcon({ className }: { className?: string }) {
  return (
    <TalkGlyph className={className}>
      <rect x="4" y="5" width="16" height="15" rx="2" {...P} />
      <path d="M4 10h16M9 3v4M15 3v4" {...P} />
    </TalkGlyph>
  );
}
