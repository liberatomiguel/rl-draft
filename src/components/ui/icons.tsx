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
export function StarIcon({ className, filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
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

/**
 * rc.35 — progression ladder & finance glyphs. Same grammar as the icons
 * above (24-grid, currentColor, 1.8 stroke, round caps).
 */
function Glyph({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      {children}
    </svg>
  );
}

/** Keyboard + mouse — pro peripherals. */
export function PeripheralsIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="2.5" y="9" width="13" height="8" rx="1.5" {...P} />
      <path d="M5 12h1m2.5 0h1m2.5 0h1M6 14.5h6" {...P} />
      <rect x="17.5" y="9" width="4" height="7" rx="2" {...P} />
      <path d="M19.5 9v2" {...P} />
    </Glyph>
  );
}

/** Monitor — 240Hz monitors. */
export function MonitorIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" {...P} />
      <path d="M9 20h6M12 16.5V20" {...P} />
    </Glyph>
  );
}

/** Tower PC — tournament PCs. */
export function PcIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="7" y="3" width="10" height="18" rx="1.5" {...P} />
      <path d="M10 7h4M10 10h4" {...P} />
      <circle cx="12" cy="16" r="1.6" {...P} />
    </Glyph>
  );
}

/** Clipboard with a tick — a coach. */
export function CoachIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="5" y="4.5" width="14" height="16" rx="1.5" {...P} />
      <path d="M9 3.5h6v2.5H9z" {...P} />
      <path d="M8.5 11l2 2 4-4M8.5 16.5h7" {...P} />
    </Glyph>
  );
}

/** Star medal — an ex-pro coach. */
export function StarCoachIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="m8 3 4 5 4-5" {...P} />
      <circle cx="12" cy="15" r="6" {...P} />
      <path d="m12 12 1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 14.3l2-.3 1-2Z" {...P} />
    </Glyph>
  );
}

/** Handshake — sponsors. */
export function HandshakeIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M2.5 8.5 6 6l4 1.5L13 6l3.5 1.5L21.5 9" {...P} />
      <path d="M2.5 8.5V14l3 1M21.5 9v5l-3 1" {...P} />
      <path d="m8 12 3 3c.8.8 2 .8 2.6 0l3.4-3.5-3-2.5-2.5 1.5L10 9.5" {...P} />
    </Glyph>
  );
}

/** Tent — bootcamp. */
export function TentIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M3 19.5 12 5l9 14.5H3Z" {...P} />
      <path d="m12 11-3.5 8.5M12 11l3.5 8.5M10.5 3l1.5 2 1.5-2" {...P} />
    </Glyph>
  );
}

/** Head + spark — sports psychologist. */
export function MindIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M14 20.5v-3h2.5a1.5 1.5 0 0 0 1.5-1.5v-2.5l2-.5-2-4A7 7 0 1 0 8 15.7v4.8" {...P} />
      <path d="M12 7.5v3m-1.5-1.5h3" {...P} />
    </Glyph>
  );
}

/** Building — performance centre. */
export function HqIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 20.5h16M6 20.5V9l6-3.5L18 9v11.5" {...P} />
      <path d="M10 20.5v-4h4v4M9.5 11.5h1m3 0h1" {...P} />
    </Glyph>
  );
}

/** Wallet — balance. */
export function WalletIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V7.5Zm0 0L15.5 4.5V7.5" {...P} />
      <path d="M16 13.5h1" {...P} />
    </Glyph>
  );
}

/** Calendar — next payroll. */
export function CalendarIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" {...P} />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" {...P} />
    </Glyph>
  );
}

/** Trend line (up by default). */
export function TrendIcon({ className, down }: { className?: string; down?: boolean }) {
  return (
    <Glyph className={className}>
      {down ? <path d="m3 7 6 6 4-4 8 8M15 17h6v-6" {...P} /> : <path d="m3 17 6-6 4 4 8-8M15 7h6v6" {...P} />}
    </Glyph>
  );
}

/** Bank — debt. */
export function BankIcon({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M3 9.5 12 4l9 5.5H3ZM4 20h16M6 12v5m4-5v5m4-5v5m4-5v5" {...P} />
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
