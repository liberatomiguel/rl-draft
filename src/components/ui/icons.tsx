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

// ---------------------------------------------------------------------------
// rc.35 (front T) — training and coach glyphs (same 24-grid, stroke 1.8)
// ---------------------------------------------------------------------------

function Glyph({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Rising line — growth / Develop. */
export function TrendUpIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M3.5 17.5 9.5 11.5l4 4 7-7.5" {...P} />
      <path d="M15.5 8h5v5" {...P} />
    </Glyph>
  );
}

/** Trophy — Compete (preparation). */
export function TrophyIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0v-5Z" {...P} />
      <path d="M7.5 6.5H4.5a3 3 0 0 0 3 4M16.5 6.5h3a3 3 0 0 1-3 4M12 14v3.5M8.5 20h7" {...P} />
    </Glyph>
  );
}

/** Heart with a pulse — Recover. */
export function HeartPulseIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" {...P} />
      <path d="M7 12.5h2.5l1.3-2.3 2.2 4.3 1.3-2h2.7" {...P} />
    </Glyph>
  );
}

/** Gauge — intensity. */
export function GaugeIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 17a8 8 0 1 1 16 0" {...P} />
      <path d="m12 17 4-5.5" {...P} />
      <circle cx="12" cy="17" r="1.3" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Crossed swords — scrims. */
export function SwordsIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4.5 4.5 15 15M19.5 4.5 9 15" {...P} />
      <path d="M13 17l4-4M11 17l-4-4M16 16l3.5 3.5M8 16l-3.5 3.5" {...P} />
    </Glyph>
  );
}

/** Whistle — the coach. */
export function WhistleIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M3.5 9.5h9l6-3v4.5a5.5 5.5 0 1 1-11 1.5" {...P} />
      <circle cx="13" cy="13.5" r="1.4" {...P} />
      <path d="M3.5 9.5v3" {...P} />
    </Glyph>
  );
}

/** Star — quality / recommended. */
export function StarIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <Glyph className={className}>
      <path
        d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 3.8Z"
        fill={filled ? "currentColor" : "none"}
        {...P}
      />
    </Glyph>
  );
}

/** Hourglass — experience / days left. */
export function HourglassIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M6.5 3.5h11M6.5 20.5h11M7.5 3.5c0 5 9 5 9 8.5s-9 3.5-9 8.5M16.5 3.5c0 5-9 5-9 8.5s9 3.5 9 8.5" {...P} />
    </Glyph>
  );
}

/** Warning triangle — absence risk. */
export function AlertIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 4 21 19.5H3L12 4Z" {...P} />
      <path d="M12 10v4.5M12 17v.1" {...P} />
    </Glyph>
  );
}

/** Ring with a dot — the base plan (nothing added). */
export function BaseDotIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="7.5" {...P} />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Wallet — wage. */
export function WalletIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18V7.5Zm0 0 11.5-3v3" {...P} />
      <path d="M15.5 13.5h1.5" {...P} />
    </Glyph>
  );
}
