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
