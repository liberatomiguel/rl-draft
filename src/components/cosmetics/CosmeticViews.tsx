"use client";

/**
 * Cosmetic renderers (v2.0, redrawn in rc.2): the ONE place an avatar / title /
 * badge / frame / banner is drawn, so the profile hero, the leaderboard rows,
 * the locker, the recap and the toasts all look the same. Pure SVG + CSS from
 * the catalog's style params — no image assets, no requests.
 *
 * Visual rules (docs: src/data/cosmetics.ts header): the TIER decides how much
 * decoration an item gets. Common is flat; rare gets a rim; epic gets metal,
 * a gem and a glow; legend gets wings / laurels, sparkle and the holo loop.
 */

import { useId, type ReactNode } from "react";
import {
  cosmeticById,
  type AvatarMotif,
  type BadgeGlyph as BadgeGlyphName,
  type BadgeShape,
  type CosmeticDef,
  type CosmeticTier,
  type FrameShape,
} from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";

/** Name + description from the copy dictionary (falls back to the id). */
export function useCosmeticCopy() {
  const { COSMETICS } = useCopy();
  return {
    name: (id: string) => COSMETICS.items[id]?.name ?? id,
    desc: (id: string) => COSMETICS.items[id]?.desc ?? "",
    kind: (k: string) => COSMETICS.kinds[k] ?? k,
    tier: (t: string) => COSMETICS.tiers[t] ?? t,
    all: COSMETICS,
  };
}

export type CosmeticSize = "xs" | "sm" | "md" | "lg" | "xl";

const PX: Record<CosmeticSize, number> = { xs: 24, sm: 36, md: 56, lg: 96, xl: 136 };

/** Tier accents reused by every renderer. */
export const TIER_ACCENT: Record<CosmeticTier, string> = {
  common: "#94a3b8",
  rare: "#60a5fa",
  epic: "#c084fc",
  legend: "#fcd34d",
};

export const TIER_RING: Record<CosmeticTier, string> = {
  common: "border-slate-400/30",
  rare: "border-blue/50",
  epic: "border-violet-400/60 shadow-[0_0_16px_rgba(192,132,252,0.18)]",
  legend: "border-amber-300/70 shadow-[0_0_22px_rgba(252,211,77,0.22)]",
};

// ---------------------------------------------------------------------------
// Shapes (100×100 box)
// ---------------------------------------------------------------------------

const SHAPE_PATH: Record<BadgeShape, string> = {
  circle: "M50 6a44 44 0 1 1 0 88a44 44 0 1 1 0-88Z",
  shield: "M50 5 88 18v34c0 22-17 37-38 43C29 89 12 74 12 52V18Z",
  hex: "M50 4 90 27v46L50 96 10 73V27Z",
  octagon: "M32 6h36l26 26v36L68 94H32L6 68V32Z",
  diamond: "M50 4 96 50 50 96 4 50Z",
  pentagon: "M50 5 95 38 78 93H22L5 38Z",
  crest: "M14 8h72v46c0 20-16 34-36 41C30 88 14 74 14 54Z",
};

const FRAME_PATH: Record<Exclude<FrameShape, "ring" | "wings" | "laurel">, string> = {
  hex: "M50 3 91 26.5v47L50 97 9 73.5v-47Z",
  octagon: "M31 4h38l27 27v38L69 96H31L4 69V31Z",
  shield: "M50 3 90 16v36c0 23-18 39-40 45C28 91 10 75 10 52V16Z",
  square: "M14 4h72a10 10 0 0 1 10 10v72a10 10 0 0 1-10 10H14A10 10 0 0 1 4 86V14A10 10 0 0 1 14 4Z",
  crest: "M12 6h76v48c0 21-17 36-38 43C29 90 12 75 12 54Z",
};

// ---------------------------------------------------------------------------
// Glyphs (24×24 stroke icons — the house icon style)
// ---------------------------------------------------------------------------

function GlyphPath({ name }: { name: BadgeGlyphName }) {
  switch (name) {
    case "flag":
      return <path d="M5 21V4h11l-1.5 3.5L16 11H5" />;
    case "heart":
      return <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />;
    case "check":
      return <path d="m5 12.5 4.5 4.5L19 7" />;
    case "flame":
      return <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.7-2.5 1.5-3.5C10.5 9 11.5 7 12 3Z" />;
    case "star":
      return <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8Z" />;
    case "trophy":
      return (
        <>
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
          <path d="M7 5H4.5a2.5 2.5 0 0 0 2.8 3.3M17 5h2.5a2.5 2.5 0 0 1-2.8 3.3" />
          <path d="M12 13v4m-3 3h6" />
        </>
      );
    case "bolt":
      return <path d="M13 3 5 13h6l-1 8 8-10h-6Z" />;
    case "shield":
      return <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6Z" />;
    case "crown":
      return (
        <>
          <path d="m5 9 2-2.5L9.5 9l2.5-3 2.5 3L17 6.5 19 9l-1 4H6L5 9Z" />
          <path d="M6.5 16.5h11" />
        </>
      );
    case "book":
      return (
        <>
          <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Z" />
          <path d="M4 19a2 2 0 0 1 2-2h12" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.5" />
        </>
      );
    case "rocket":
      return (
        <>
          <path d="M12 3c3 2 4.5 6 4.5 10l-2 2h-5l-2-2C7.5 9 9 5 12 3Z" />
          <path d="M9.5 13 7 16v3l3-1.5M14.5 13 17 16v3l-3-1.5M12 17v4" />
        </>
      );
    case "ball":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m12 7.5 3.5 2.5-1.3 4.2h-4.4L8.5 10Z" />
          <path d="M12 7.5V4M15.5 10l3.2-1M14.2 14.2l2 3M9.8 14.2l-2 3M8.5 10 5.3 9" />
        </>
      );
    case "wings":
      return <path d="M12 16c-1-5-4-8-9-9 2 4 3 6 3 9 2-1 4-1 6 0Zm0 0c1-5 4-8 9-9-2 4-3 6-3 9-2-1-4-1-6 0Z" />;
    case "gem":
      return (
        <>
          <path d="M7 4h10l4 5-9 11L3 9Z" />
          <path d="M3 9h18M9 4l3 16M15 4l-3 16" />
        </>
      );
    case "medal":
      return (
        <>
          <circle cx="12" cy="14.5" r="5.5" />
          <path d="m8.5 10 -3-6h4l2.5 4.5L14.5 4h4l-3 6" />
        </>
      );
    case "chevrons":
      return <path d="M6 10l6-5 6 5M6 16l6-5 6 5" />;
    case "globe":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" />
        </>
      );
    case "swords":
      return <path d="m4 4 12 12M20 4 8 16M4 20l4-4m12 4-4-4M14 6l4-2-2 4" />;
  }
}

// ---------------------------------------------------------------------------
// Avatar motifs (100×100 filled silhouettes)
// ---------------------------------------------------------------------------

function AvatarMotifPath({ motif, ink }: { motif: AvatarMotif; ink: string }) {
  const shade = "rgba(0,0,0,0.38)";
  switch (motif) {
    case "octane":
      return (
        <g fill={ink}>
          <path d="M14 62l10-16 24-8 22 4 18 14v10H14Z" />
          <path d="M44 42l14-2 10 10H40Z" fill={shade} />
          <circle cx="32" cy="68" r="9" />
          <circle cx="72" cy="68" r="9" />
          <circle cx="32" cy="68" r="3.5" fill={shade} />
          <circle cx="72" cy="68" r="3.5" fill={shade} />
          <path d="M14 48h10v4H14Z" />
        </g>
      );
    case "ball":
      return (
        <g fill="none" stroke={ink} strokeWidth="5" strokeLinejoin="round">
          <circle cx="50" cy="50" r="30" />
          <path d="M50 34l13 9-5 15H42l-5-15Z" />
          <path d="M50 34V20M63 43l12-4M58 58l7 11M42 58l-7 11M37 43l-12-4" />
        </g>
      );
    case "boost":
      return (
        <g fill={ink}>
          <path d="M50 14c6 14 22 20 22 38a22 22 0 0 1-44 0c0-8 4-14 9-19 0 8 4 11 8 11C50 36 46 28 50 14Z" />
          <path d="M50 50c3 6 9 8 9 14a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1.5 4 3 4-1-4-1-6 2-10Z" fill={shade} />
          <path d="M36 80h28v8H36Z" />
        </g>
      );
    case "bolt":
      return <path d="M58 10 28 54h20l-6 36 30-46H52Z" fill={ink} />;
    case "star":
      return <path d="m50 10 11.5 24.5 27 3.5-19.8 18.5 5 26.5L50 70l-23.7 13 5-26.5L11.5 38l27-3.5Z" fill={ink} />;
    case "visor":
      return (
        <g fill={ink}>
          <path d="M22 60a28 28 0 0 1 56 0v12a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6Z" />
          <path d="M28 54h44v14H28Z" fill={shade} />
          <path d="M42 86h16v6H42Z" />
        </g>
      );
    case "planet":
      return (
        <g>
          <circle cx="50" cy="50" r="22" fill={ink} />
          <ellipse cx="50" cy="52" rx="40" ry="11" fill="none" stroke={ink} strokeWidth="5" transform="rotate(-18 50 52)" />
          <path d="M36 42c4-4 10-6 16-5" stroke={shade} strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      );
    case "comet":
      return (
        <g fill={ink}>
          <circle cx="64" cy="38" r="16" />
          <path d="M54 50 16 82l16-30 20 4Z" opacity="0.9" />
          <path d="M60 30c3-3 8-4 11-2" stroke={shade} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </g>
      );
    case "trophy":
      return (
        <g fill={ink}>
          <path d="M32 16h36v22a18 18 0 0 1-36 0Z" />
          <path d="M32 20H20a8 8 0 0 0 10 12M68 20h12a8 8 0 0 1-10 12" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M46 56h8v12h-8ZM34 70h32v8H34Z" />
          <path d="M40 22h8v14h-8Z" fill={shade} opacity="0.5" />
        </g>
      );
    case "phoenix":
      return (
        <g fill={ink}>
          <path d="M50 28c-6-12-20-16-36-12 10 4 16 12 18 22-8-2-16 0-22 6 10 0 18 4 24 12-6 2-10 6-12 12 10-4 20-4 28-2Z" />
          <path d="M50 28c6-12 20-16 36-12-10 4-16 12-18 22 8-2 16 0 22 6-10 0-18 4-24 12 6 2 10 6 12 12-10-4-20-4-28-2Z" />
          <path d="M50 30c-6 8-8 22-6 40 2 8 6 14 6 20 0-6 4-12 6-20 2-18 0-32-6-40Z" fill={shade} opacity="0.55" />
          <path d="M50 18c3 2 5 6 4 10-3-1-6-1-8 0-1-4 1-8 4-10Z" />
        </g>
      );
    case "crown":
      return (
        <g fill={ink}>
          <path d="M18 36l12 14 14-24 12 24 14-14 2 32H18Z" />
          <path d="M20 76h60v10H20Z" />
          <circle cx="18" cy="34" r="5" />
          <circle cx="50" cy="24" r="5" />
          <circle cx="82" cy="34" r="5" />
          <path d="M34 58h32v6H34Z" fill={shade} />
        </g>
      );
    case "skull":
      return (
        <g fill={ink}>
          <path d="M50 16c-20 0-32 13-32 30 0 10 5 16 10 20v12h44V66c5-4 10-10 10-20 0-17-12-30-32-30Z" />
          <circle cx="38" cy="46" r="8" fill={shade} />
          <circle cx="62" cy="46" r="8" fill={shade} />
          <path d="M46 58h8l-4 8Z" fill={shade} />
          <path d="M40 70h4v8h-4Zm8 0h4v8h-4Zm8 0h4v8h-4Z" fill={shade} />
        </g>
      );
    case "rocket":
      return (
        <g fill={ink}>
          <path d="M50 8c12 8 18 24 18 42l-8 10H40l-8-10c0-18 6-34 18-42Z" />
          <circle cx="50" cy="40" r="7" fill={shade} />
          <path d="M40 56 24 68v14l16-8ZM60 56l16 12v14l-16-8Z" />
          <path d="M44 72h12l-6 16Z" fill={shade} opacity="0.6" />
        </g>
      );
    case "diamond":
      return (
        <g fill={ink}>
          <path d="M30 20h40l18 22-38 42-38-42Z" />
          <path d="M12 42h76M30 20l20 64M70 20 50 84M38 42l12-22 12 22" fill="none" stroke={shade} strokeWidth="3" strokeLinejoin="round" />
        </g>
      );
    case "shield":
      return (
        <g fill={ink}>
          <path d="M50 10 84 22v30c0 20-15 33-34 38C31 85 16 72 16 52V22Z" />
          <path d="M56 32 40 54h10l-3 16 16-22H53Z" fill={shade} />
        </g>
      );
    case "flame":
      return (
        <g fill={ink}>
          <path d="M50 10c4 16 24 22 24 44a24 24 0 0 1-48 0c0-10 5-16 11-22 0 9 4 13 9 13-1-10-3-20 4-35Z" />
          <path d="M50 52c3 7 10 9 10 17a10 10 0 0 1-20 0c0-4 2-7 5-9 0 4 2 5 4 5-1-5-1-8 1-13Z" fill={shade} />
        </g>
      );
  }
}

// ---------------------------------------------------------------------------
// Avatar + frame
// ---------------------------------------------------------------------------

/** The profile avatar: a tile with the motif, optionally wearing a frame. */
export function AvatarMark({
  avatar,
  frame,
  size = "md",
  className,
}: {
  avatar: CosmeticDef | null | undefined;
  frame?: CosmeticDef | null;
  size?: CosmeticSize;
  className?: string;
}) {
  const uid = useId();
  const px = PX[size];
  const a = avatar && avatar.kind === "avatar" ? avatar : null;
  const [c1, c2] = a?.style.colors ?? ["#334155", "#0f172a"];
  const ink = a?.style.ink ?? "#f1f5f9";
  const gid = `av${uid.replace(/:/g, "")}`;
  // The frame needs a margin around the tile: the shapes extend beyond it.
  const framed = Boolean(frame && frame.kind === "frame");
  const box = framed ? Math.round(px * 1.34) : px;
  return (
    <span
      className={cx("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: box, height: box }}
    >
      <svg viewBox="0 0 100 100" width={px} height={px} className="relative z-10 shrink-0" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
          <linearGradient id={`${gid}-sheen`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${gid}-clip`}>
            <rect x="2" y="2" width="96" height="96" rx="24" />
          </clipPath>
        </defs>
        <rect x="2" y="2" width="96" height="96" rx="24" fill={`url(#${gid})`} />
        <rect x="2" y="2" width="96" height="96" rx="24" fill={`url(#${gid}-sheen)`} />
        <g clipPath={`url(#${gid}-clip)`}>{a ? <AvatarMotifPath motif={a.style.motif} ink={ink} /> : null}</g>
        <rect x="2" y="2" width="96" height="96" rx="24" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
      </svg>
      {framed ? <FrameOverlay frame={frame!} /> : null}
    </span>
  );
}

/** The frame drawn over any square box (absolute, fills the parent). */
export function FrameOverlay({ frame, className }: { frame: CosmeticDef; className?: string }) {
  const uid = useId();
  if (frame.kind !== "frame") return null;
  const { shape, colors, weight, studs, animated } = frame.style;
  const gid = `fr${uid.replace(/:/g, "")}`;
  const [c1, c2, c3] = [colors[0], colors[1] ?? colors[0], colors[2]];
  const sw = weight === 2 ? 3.4 : 2.6;
  const stroke = `url(#${gid})`;
  const studPts: [number, number][] =
    shape === "hex"
      ? [
          [50, 3],
          [50, 97],
        ]
      : shape === "octagon" || shape === "square"
        ? [
            [8, 8],
            [92, 8],
            [8, 92],
            [92, 92],
          ]
        : shape === "shield" || shape === "crest"
          ? [[50, shape === "crest" ? 6 : 3]]
          : [
              [50, 2],
              [2, 50],
              [98, 50],
              [50, 98],
            ];

  return (
    <svg
      viewBox="-12 -12 124 124"
      className={cx(
        "pointer-events-none absolute inset-0 z-20 h-full w-full",
        animated === "sheen" && "cos-fx-sheen",
        animated === "holo" && "cos-fx-holo",
        animated === "pulse" && "cos-fx-pulse",
        className,
      )}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset={c3 ? "0.5" : "1"} stopColor={c2} />
          {c3 ? <stop offset="1" stopColor={c3} /> : null}
        </linearGradient>
      </defs>
      {shape === "ring" ? (
        <>
          <circle cx="50" cy="50" r="52" fill="none" stroke={stroke} strokeWidth={sw} />
          {weight === 2 ? <circle cx="50" cy="50" r="57" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.55" /> : null}
        </>
      ) : shape === "wings" ? (
        <>
          <path d={FRAME_PATH.hex} fill="none" stroke={stroke} strokeWidth={sw} transform="translate(50 50) scale(1.1) translate(-50 -50)" />
          <path d="M-4 42c-10-10-14-26-10-40 10 8 14 20 14 34Zm0 14c-10 6-18 16-20 30 10-4 18-12 22-26Z" fill={stroke} opacity="0.95" />
          <path d="M104 42c10-10 14-26 10-40-10 8-14 20-14 34Zm0 14c10 6 18 16 20 30-10-4-18-12-22-26Z" fill={stroke} opacity="0.95" />
        </>
      ) : shape === "laurel" ? (
        <>
          <circle cx="50" cy="50" r="52" fill="none" stroke={stroke} strokeWidth={sw} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <path
                d="M-2 60c-6-2-9-6-9-11 5 0 9 4 9 11Z"
                fill={stroke}
                transform={`rotate(${-20 + i * 22} 50 50)`}
              />
              <path
                d="M102 60c6-2 9-6 9-11-5 0-9 4-9 11Z"
                fill={stroke}
                transform={`rotate(${20 - i * 22} 50 50)`}
              />
            </g>
          ))}
          <path d="M34 108h32" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={FRAME_PATH[shape]} fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" transform="translate(50 50) scale(1.12) translate(-50 -50)" />
          {weight === 2 ? (
            <path
              d={FRAME_PATH[shape]}
              fill="none"
              stroke={stroke}
              strokeWidth="1.2"
              strokeLinejoin="round"
              opacity="0.5"
              transform="translate(50 50) scale(1.22) translate(-50 -50)"
            />
          ) : null}
        </>
      )}
      {studs
        ? studPts.map(([x, y], i) => (
            <g key={i} transform={`translate(${(x - 50) * 1.14 + 50} ${(y - 50) * 1.14 + 50})`}>
              <path d="M0-4.5 4.5 0 0 4.5-4.5 0Z" fill={c3 ?? c1} />
              <path d="M0-4.5 4.5 0H-4.5Z" fill="#fff" opacity="0.45" />
            </g>
          ))
        : null}
    </svg>
  );
}

/** Compatibility wrapper: a frame around any square element (rank emblem,
 *  recap tile). Prefer `AvatarMark` for the profile avatar. */
export function FrameRing({
  frame,
  children,
  className,
}: {
  frame: CosmeticDef | null | undefined;
  children: ReactNode;
  /** Kept for call-site compatibility; the frame shapes size themselves. */
  width?: number;
  className?: string;
}) {
  if (!frame || frame.kind !== "frame") return <>{children}</>;
  return (
    <span className={cx("relative inline-flex items-center justify-center p-[14%]", className)}>
      <span className="relative z-10 flex items-center justify-center">{children}</span>
      <FrameOverlay frame={frame} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Badge emblem
// ---------------------------------------------------------------------------

/** A badge emblem: shaped, bevelled, rimmed by tier; glyph in the middle. */
export function BadgeEmblem({
  badge,
  size = "sm",
  className,
}: {
  badge: CosmeticDef;
  size?: CosmeticSize;
  className?: string;
}) {
  const uid = useId();
  if (badge.kind !== "badge") return null;
  const { shape, glyph, colors, rim, ink, pips, gem, wings } = badge.style;
  const tier = badge.tier;
  const gid = `bd${uid.replace(/:/g, "")}`;
  const px = PX[size];
  const rimColor = rim ?? (tier === "common" ? "rgba(255,255,255,0.22)" : TIER_ACCENT[tier]);
  const rimWidth = tier === "common" ? 2 : tier === "rare" ? 3 : 4;
  const d = SHAPE_PATH[shape];
  const inkColor = ink ?? "#f8fafc";
  return (
    <svg
      viewBox={wings ? "-24 -8 148 116" : "-4 -4 108 108"}
      width={px}
      height={px}
      className={cx(
        "shrink-0 overflow-visible",
        tier === "epic" && "cos-emblem-epic",
        tier === "legend" && "cos-emblem-legend",
        className,
      )}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
        <linearGradient id={`${gid}-bevel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${gid}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={rimColor} />
          <stop offset="1" stopColor={tier === "legend" ? "#fff" : rimColor} stopOpacity={tier === "legend" ? 0.9 : 0.6} />
        </linearGradient>
      </defs>
      {wings ? (
        <g fill={`url(#${gid}-rim)`} opacity="0.95">
          <path d="M6 40c-14-6-22-18-24-34 12 6 20 16 24 30Zm-2 12c-12 2-22 10-26 24 12-2 22-10 26-24Z" />
          <path d="M94 40c14-6 22-18 24-34-12 6-20 16-24 30Zm2 12c12 2 22 10 26 24-12-2-22-10-26-24Z" />
        </g>
      ) : null}
      {tier !== "common" ? <path d={d} fill="none" stroke={`url(#${gid}-rim)`} strokeWidth={rimWidth + 3} strokeLinejoin="round" opacity="0.35" /> : null}
      <path d={d} fill={`url(#${gid})`} stroke={`url(#${gid}-rim)`} strokeWidth={rimWidth} strokeLinejoin="round" />
      <path d={d} fill={`url(#${gid}-bevel)`} />
      {tier === "epic" || tier === "legend" ? (
        <path d={d} fill="none" stroke="#fff" strokeWidth="1" strokeLinejoin="round" opacity="0.35" transform="translate(50 50) scale(0.86) translate(-50 -50)" />
      ) : null}
      <g transform={`translate(${pips ? 25 : 25} ${pips ? 16 : 22}) scale(2.1)`} fill="none" stroke={inkColor} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <GlyphPath name={glyph} />
      </g>
      {pips
        ? Array.from({ length: Math.min(3, pips) }).map((_, i, arr) => (
            <path key={i} d="M0-4 4 0 0 4-4 0Z" fill={inkColor} transform={`translate(${50 + (i - (arr.length - 1) / 2) * 11} 78)`} />
          ))
        : null}
      {gem ? (
        <g transform="translate(50 3)">
          <path d="M0-6 6 0 0 6-6 0Z" fill={gem} stroke="#fff" strokeWidth="1" />
          <path d="M0-6 6 0H-6Z" fill="#fff" opacity="0.5" />
        </g>
      ) : null}
      {tier === "legend" ? (
        <g fill="#fff" className="cos-twinkle">
          <circle cx="18" cy="26" r="2" />
          <circle cx="84" cy="34" r="1.6" style={{ animationDelay: "0.9s" }} />
          <circle cx="70" cy="84" r="1.8" style={{ animationDelay: "1.7s" }} />
        </g>
      ) : null}
    </svg>
  );
}

/** A badge chip: the emblem, optionally with its name. */
export function BadgeChip({
  badge,
  size = "sm",
  className,
  showName,
}: {
  badge: CosmeticDef | null | undefined;
  size?: CosmeticSize;
  className?: string;
  showName?: boolean;
}) {
  const copy = useCosmeticCopy();
  if (!badge || badge.kind !== "badge") return null;
  const name = copy.name(badge.id);
  return (
    <span className={cx("inline-flex items-center gap-1.5", className)} title={name}>
      <BadgeEmblem badge={badge} size={size} />
      {showName ? <span className="text-[11px] font-semibold text-sub">{name}</span> : null}
    </span>
  );
}

/** Row of up to three badges. */
export function BadgeRow({ badges, size = "sm", className }: { badges: CosmeticDef[]; size?: CosmeticSize; className?: string }) {
  if (badges.length === 0) return null;
  return (
    <span className={cx("inline-flex items-center gap-1", className)}>
      {badges.map((b) => (
        <BadgeChip key={b.id} badge={b} size={size} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Title tag
// ---------------------------------------------------------------------------

/** The title chip: a container whose decoration rises with the tier. */
export function TitleTag({
  title,
  size = "sm",
  className,
}: {
  title: CosmeticDef | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const copy = useCosmeticCopy();
  if (!title || title.kind !== "title") return null;
  const sizeClass =
    size === "xs"
      ? "px-1.5 py-px text-[9px]"
      : size === "md"
        ? "px-3 py-1 text-sm"
        : size === "lg"
          ? "px-3.5 py-1.5 text-base"
          : "px-2 py-0.5 text-[11px]";
  const tier = title.tier;
  return (
    <span
      className={cx(
        "cos-title",
        `cos-title-${tier}`,
        title.style.fx === "glow" && "cos-title-glow",
        title.style.fx === "holo" && "cos-title-holo",
        sizeClass,
        className,
      )}
      style={{ "--cos-color": title.style.color } as React.CSSProperties}
    >
      {copy.name(title.id)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Banner surface
// ---------------------------------------------------------------------------

/** A banner background (profile hero / leaderboard row). Renders a plain
 *  wrapper when there is no banner so layout never changes. */
export function BannerSurface({
  banner,
  children,
  className,
  plainClassName,
}: {
  banner: CosmeticDef | null | undefined;
  children: ReactNode;
  className?: string;
  /** Classes used when no banner is equipped. */
  plainClassName?: string;
}) {
  if (!banner || banner.kind !== "banner") return <div className={cx(className, plainClassName)}>{children}</div>;
  const s = banner.style;
  const style: Record<string, string> = {
    "--cos-from": s.from,
    "--cos-to": s.to,
    "--cos-accent": s.accent ?? "#ffffff",
  };
  return (
    <div
      className={cx("cos-banner", s.pattern && s.pattern !== "none" && `cos-banner-${s.pattern}`, s.animated && "cos-banner-animated", className)}
      style={style as React.CSSProperties}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Previews (locker tiles, recap chips, toasts)
// ---------------------------------------------------------------------------

/** The art of any cosmetic at preview size (no text). */
export function CosmeticArt({ def, size = "md", className }: { def: CosmeticDef; size?: CosmeticSize; className?: string }) {
  switch (def.kind) {
    case "avatar":
      return <AvatarMark avatar={def} size={size} className={className} />;
    case "frame":
      return (
        <span className={cx("relative inline-flex items-center justify-center", className)} style={{ width: PX[size] * 1.34, height: PX[size] * 1.34 }}>
          <span className="relative z-10 rounded-[22%] bg-white/10" style={{ width: PX[size], height: PX[size] }} />
          <FrameOverlay frame={def} />
        </span>
      );
    case "badge":
      return <BadgeEmblem badge={def} size={size} className={className} />;
    case "banner":
      return (
        <BannerSurface banner={def} className={cx("rounded-lg border border-line-strong", className)}>
          <span className="block" style={{ width: PX[size] * 2.6, height: PX[size] * 1.15 }} />
        </BannerSurface>
      );
    case "title":
      return (
        <span className={cx("inline-flex items-center", className)}>
          <TitleTag title={def} size={size === "xs" ? "xs" : size === "sm" ? "sm" : "md"} />
        </span>
      );
  }
}

/** The smallest honest representation of a cosmetic (season track nodes,
 *  reward lists): art for everything that has art, a tier-coloured tag for a
 *  title (its text never fits a node). */
export function CosmeticIcon({ def, className }: { def: CosmeticDef; className?: string }) {
  if (def.kind === "title") {
    return (
      <span
        className={cx("inline-flex h-6 w-7 items-center justify-center rounded-md border text-[9px] font-black uppercase", className)}
        style={{ color: def.style.color, borderColor: `${def.style.color}80`, background: `${def.style.color}1f` }}
        aria-hidden
      >
        Aa
      </span>
    );
  }
  if (def.kind === "banner") {
    return (
      <BannerSurface banner={def} className={cx("rounded-md border border-line-strong", className)}>
        <span className="block h-6 w-9" />
      </BannerSurface>
    );
  }
  return <CosmeticArt def={def} size="xs" className={className} />;
}

/** Preview of any cosmetic (locker tile / recap chip): art + name + kind. */
export function CosmeticPreview({ id, className, compact, size = "md" }: { id: string; className?: string; compact?: boolean; size?: CosmeticSize }) {
  const def = cosmeticById.get(id);
  const copy = useCosmeticCopy();
  if (!def) return null;
  return (
    <span className={cx("inline-flex items-center gap-3", className)}>
      <span className="flex shrink-0 items-center justify-center" style={{ minWidth: PX[size] * 1.4, minHeight: PX[size] * 1.4 }}>
        <CosmeticArt def={def} size={size} />
      </span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink">{copy.name(def.id)}</span>
          <span className="block text-[11px] text-faint">
            {copy.kind(def.kind)} · <span style={{ color: TIER_ACCENT[def.tier] }}>{copy.tier(def.tier)}</span>
          </span>
        </span>
      )}
    </span>
  );
}
