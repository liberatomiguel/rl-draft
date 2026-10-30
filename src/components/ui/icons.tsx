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

/** rc.35: the shared stroke frame of the small line icons below. */
function LineIcon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Shield — a safe, forgiving choice (Easy). */
export function ShieldIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <path d="M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-2.5Z" {...P} />
      <path d="m9 12 2 2 4-4" {...P} />
    </LineIcon>
  );
}

/** Target — the intended way to play (Normal). */
export function TargetIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </LineIcon>
  );
}

/** Flame — the hard road (Hard). */
export function FlameIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <path d="M12 3c.5 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.3-3.8 2.5-5 .3 1.6 1 2.6 2 3 0-3 0-5.5.5-8Z" {...P} />
    </LineIcon>
  );
}

/** Crossed swords — matches. */
export function SwordsIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <path d="M4 4l9 9M20 4l-9 9M6.5 15.5 4 18M17.5 15.5 20 18M8 14l2 2M16 14l-2 2" {...P} />
    </LineIcon>
  );
}

/** Coin — money. */
export function CoinIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="8" />
      <path
        d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1.1 1.6 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5v11"
        {...P}
      />
    </LineIcon>
  );
}

/** Clipboard — the coach's help, the training plan. */
export function ClipboardIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <rect x="5.5" y="5" width="13" height="15.5" rx="2" />
      <path d="M9 5V3.8h6V5M8.5 11h7M8.5 14.5h5" {...P} />
    </LineIcon>
  );
}

/** Check — a confirmed pick. */
export function CheckIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" {...P} />
    </LineIcon>
  );
}

/** Star — a recommendation. */
export function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="m12 3.2 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6-4.5-4.2 6.1-.7L12 3.2Z" />
    </svg>
  );
}

/** Scale — balance. */
export function ScaleIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 6a2.5 2.5 0 0 0 5 0L19 7Z" {...P} />
    </LineIcon>
  );
}

/** Arrow up-right — developing. */
export function TrendUpIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <path d="m4 17 6-6 4 4 6-7M14.5 8H20v5.5" {...P} />
    </LineIcon>
  );
}

/** Peak — at his best. */
export function PeakIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <path d="m3 19 6.5-11 3.5 5.5 2.5-3.5L21 19H3Z" {...P} />
    </LineIcon>
  );
}

/** Arrow down-right — declining. */
export function TrendDownIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <path d="m4 7 6 6 4-4 6 7M14.5 16H20v-5.5" {...P} />
    </LineIcon>
  );
}

/** Question — not known yet. */
export function QuestionIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5" {...P} />
      <circle cx="12" cy="16.8" r=".6" fill="currentColor" />
    </LineIcon>
  );
}

/** Badge with a check — "signable", within reach. */
export function BadgeCheckIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <path
        d="M12 3 14.2 5l2.9-.3.6 2.9 2.5 1.5-1.2 2.7 1.2 2.7-2.5 1.5-.6 2.9-2.9-.3L12 21l-2.2-2-2.9.3-.6-2.9-2.5-1.5 1.2-2.7-1.2-2.7 2.5-1.5.6-2.9 2.9.3L12 3Z"
        {...P}
      />
      <path d="m9 12 2 2 4-4" {...P} />
    </LineIcon>
  );
}

/** Lock — not available yet. */
export function LockIcon({ className }: { className?: string }) {
  return (
    <LineIcon className={className}>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" {...P} />
    </LineIcon>
  );
}
