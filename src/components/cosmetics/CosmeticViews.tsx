"use client";

/**
 * Cosmetic renderers (v2.0, visual language reset in rc.3): the ONE place a
 * title / badge / banner is drawn, so the profile hero, the leaderboard rows,
 * the locker, the recap and the toasts all look the same.
 *
 * The language is the game's own: thin line art with round caps and gradient
 * STROKES (the logo, the Legacy emblem, the achievement icons), chips that
 * look like the "Live" / "New" tags, and effects reserved for the special
 * tiers exactly like the special cards (glow for epic, holo for legend).
 */

import { useId, type ReactNode } from "react";
import { cosmeticById, type BadgeGlyph as BadgeGlyphName, type BadgeShape, type CosmeticDef, type CosmeticTier, type Stops } from "@/data/cosmetics";
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

const PX: Record<CosmeticSize, number> = { xs: 20, sm: 28, md: 40, lg: 56, xl: 72 };

/** Tier accents reused by the locker tiles. */
export const TIER_ACCENT: Record<CosmeticTier, string> = {
  common: "#94a3b8",
  rare: "#60a5fa",
  epic: "#c084fc",
  legend: "#fcd34d",
};

export const TIER_RING: Record<CosmeticTier, string> = {
  common: "border-line",
  rare: "border-blue/40",
  epic: "border-violet-400/45",
  legend: "border-amber-300/50",
};

// ---------------------------------------------------------------------------
// Shapes (48×48 box, centred on 24/24 — the Legacy emblem's grid)
// ---------------------------------------------------------------------------

const SHAPE_PATH: Record<BadgeShape, string> = {
  circle: "M24 4a20 20 0 1 1 0 40a20 20 0 1 1 0-40Z",
  shield: "M24 4 40 10v13c0 10-7 17-16 21-9-4-16-11-16-21V10Z",
  hex: "M24 3 42 13.5v21L24 45 6 34.5v-21Z",
  octagon: "M15 4h18l11 11v18L33 44H15L4 33V15Z",
  diamond: "M24 3 45 24 24 45 3 24Z",
  pentagon: "M24 3l20 14.5-7.6 23.5H11.6L4 17.5Z",
  crest: "M8 5h32v22c0 9-7 15-16 18-9-3-16-9-16-18Z",
  square: "M13 5h22a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8H13a8 8 0 0 1-8-8V13a8 8 0 0 1 8-8Z",
};

// ---------------------------------------------------------------------------
// Glyphs (24×24 stroke icons — the house icon style)
// ---------------------------------------------------------------------------

function GlyphPath({ name }: { name: BadgeGlyphName }) {
  switch (name) {
    case "flag":
      return <path d="M7 19V5h9l-1.3 3L16 11H7" />;
    case "heart":
      return <path d="M12 18.5s-6-4-6-8.6A3.4 3.4 0 0 1 12 8a3.4 3.4 0 0 1 6 1.9c0 4.6-6 8.6-6 8.6Z" />;
    case "check":
      return <path d="m6.5 12.5 3.6 3.6L17.5 8" />;
    case "flame":
      return <path d="M12 5c.8 2.6 3.4 3.9 3.4 6.9a3.4 3.4 0 0 1-6.8 0c0-1.3.6-2.1 1.3-3 .1 1 .7 1.5 1.3 1.5-.6-1.6-.5-3.2.8-5.4Z" />;
    case "star":
      return <path d="m12 5 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7L5.2 10l4.7-.7Z" />;
    case "trophy":
      return (
        <>
          <path d="M8.5 5.5h7v3.3a3.5 3.5 0 0 1-7 0Z" />
          <path d="M8.5 6.5H6.6a1.9 1.9 0 0 0 2.1 2.6M15.5 6.5h1.9a1.9 1.9 0 0 1-2.1 2.6" />
          <path d="M12 12.3v3.2m-2.5 2.5h5" />
        </>
      );
    case "bolt":
      return <path d="M13 4.5 6.5 13H12l-1 6.5L17.5 11H12Z" />;
    case "shield":
      return <path d="M12 4.5 6 7v4.5c0 3.4 2.4 5.9 6 7.5 3.6-1.6 6-4.1 6-7.5V7Z" />;
    case "crown":
      return (
        <>
          <path d="m6 9.5 1.8-2 2.4 2.3L12 6.5l1.8 3.3 2.4-2.3 1.8 2-.9 5H6.9Z" />
          <path d="M7.5 17h9" />
        </>
      );
    case "book":
      return (
        <>
          <path d="M6 6.2A1.7 1.7 0 0 1 7.7 4.5H18v12.3H7.7A1.7 1.7 0 0 0 6 18.5Z" />
          <path d="M6 18.5a1.7 1.7 0 0 1 1.7-1.7H18" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="6.5" />
          <circle cx="12" cy="12" r="2.4" />
        </>
      );
    case "rocket":
      return (
        <>
          <path d="M12 4.5c2.4 1.6 3.7 5 3.7 8.3l-1.6 1.7H9.9l-1.6-1.7c0-3.3 1.3-6.7 3.7-8.3Z" />
          <path d="M10.3 14.5 8.5 16.7v2.3l2.4-1.2M13.7 14.5l1.8 2.2v2.3l-2.4-1.2" />
        </>
      );
    case "ball":
      return (
        <>
          <circle cx="12" cy="12" r="7" />
          <path d="m12 8.3 3 2.2-1.1 3.5H10l-1.1-3.5Z" />
          <path d="M12 8.3V5m3 5.5 3.4-1M13.9 14l1.9 2.9M10.1 14l-1.9 2.9M9 10.5 5.6 9.5" />
        </>
      );
    case "gem":
      return (
        <>
          <path d="M8 5.5h8l3.5 4-7.5 9-7.5-9Z" />
          <path d="M4.5 9.5h15M9.5 5.5l2.5 13M14.5 5.5 12 18.5" />
        </>
      );
    case "medal":
      return (
        <>
          <circle cx="12" cy="14" r="4.6" />
          <path d="m9.2 10.3-2.4-5h3.2L12 9.2l2-3.9h3.2l-2.4 5" />
        </>
      );
    case "chevrons":
      return <path d="m7 11 5-4 5 4M7 16.5l5-4 5 4" />;
    case "globe":
      return (
        <>
          <circle cx="12" cy="12" r="7" />
          <path d="M5 12h14M12 5c2.5 2.5 2.5 11.5 0 14M12 5c-2.5 2.5-2.5 11.5 0 14" />
        </>
      );
    case "swords":
      return <path d="m5.5 5.5 10 10M18.5 5.5l-10 10M5.5 18.5l3-3m10 3-3-3" />;
  }
}

// ---------------------------------------------------------------------------
// Badge emblem
// ---------------------------------------------------------------------------

/** A badge: an outlined shape with a line glyph inside, drawn in one gradient
 *  stroke. Common is one muted colour; rare a tone; epic a gradient + glow;
 *  legend a prismatic gradient with the holo loop. */
export function BadgeEmblem({ badge, size = "sm", className }: { badge: CosmeticDef; size?: CosmeticSize; className?: string }) {
  const uid = useId();
  if (badge.kind !== "badge") return null;
  const { shape, glyph, colors } = badge.style;
  const tier = badge.tier;
  const gid = `bd${uid.replace(/:/g, "")}`;
  const px = PX[size];
  const stroke = colors.length === 1 ? colors[0] : `url(#${gid})`;
  return (
    <svg
      viewBox="0 0 48 48"
      width={px}
      height={px}
      className={cx("shrink-0 overflow-visible", tier === "epic" && "cos-glow-epic", tier === "legend" && "cos-glow-legend cos-holo", className)}
      fill="none"
      aria-hidden
    >
      {colors.length > 1 ? (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            {colors.map((c, i) => (
              <stop key={i} offset={colors.length === 2 ? i : i / 2} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      {tier === "legend" ? (
        <path d={SHAPE_PATH[shape]} stroke={stroke} strokeWidth="1" strokeLinejoin="round" opacity="0.35" transform="translate(24 24) scale(1.14) translate(-24 -24)" />
      ) : null}
      <path d={SHAPE_PATH[shape]} stroke={stroke} strokeWidth={tier === "common" ? 2 : 2.3} strokeLinejoin="round" opacity={tier === "common" ? 0.85 : 1} />
      <g transform="translate(12 12)" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity={tier === "common" ? 0.85 : 1}>
        <GlyphPath name={glyph} />
      </g>
    </svg>
  );
}

/** A badge chip: the emblem, optionally with its name. */
export function BadgeChip({ badge, size = "sm", className, showName }: { badge: CosmeticDef | null | undefined; size?: CosmeticSize; className?: string; showName?: boolean }) {
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
    <span className={cx("inline-flex items-center gap-1.5", className)}>
      {badges.map((b) => (
        <BadgeChip key={b.id} badge={b} size={size} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Title tag — the same chip the UI uses for "Live" / "New"
// ---------------------------------------------------------------------------

function stopsVars(colors: Stops): Record<string, string> {
  return {
    "--cos-c1": colors[0],
    "--cos-c2": colors[1] ?? colors[0],
    "--cos-c3": colors[2] ?? colors[1] ?? colors[0],
  };
}

export function TitleTag({ title, size = "sm", className }: { title: CosmeticDef | null | undefined; size?: "xs" | "sm" | "md"; className?: string }) {
  const copy = useCosmeticCopy();
  if (!title || title.kind !== "title") return null;
  const sizeClass = size === "xs" ? "px-1.5 py-px text-[9px]" : size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span className={cx("cos-title", `cos-title-${title.tier}`, sizeClass, className)} style={stopsVars(title.style.colors) as React.CSSProperties}>
      {copy.name(title.id)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Banner surface
// ---------------------------------------------------------------------------

/** A banner background (profile hero / leaderboard row). The left side is
 *  always kept dark so the text reads; the colour lives on the right. Renders
 *  a plain wrapper when there is no banner so layout never changes. */
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
  const style: Record<string, string> = { "--cos-from": s.from, "--cos-to": s.to, "--cos-accent": s.accent ?? "#ffffff" };
  return (
    <div
      className={cx(
        "cos-banner",
        `cos-banner-${banner.tier}`,
        s.pattern && s.pattern !== "none" && `cos-banner-${s.pattern}`,
        s.animated && "cos-banner-animated",
        className,
      )}
      style={style as React.CSSProperties}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Previews (locker tiles, recap chips, track nodes)
// ---------------------------------------------------------------------------

/** The art of any cosmetic at preview size (no text). */
export function CosmeticArt({ def, size = "md", className }: { def: CosmeticDef; size?: CosmeticSize; className?: string }) {
  switch (def.kind) {
    case "badge":
      return <BadgeEmblem badge={def} size={size} className={className} />;
    case "banner":
      return (
        <BannerSurface banner={def} className={cx("rounded-md border border-line-strong", className)}>
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

/** The compact representation used on the season track and in reward lists:
 *  a title shows whole, a badge at icon size, a banner as a small swatch. */
export function CosmeticIcon({ def, className }: { def: CosmeticDef; className?: string }) {
  if (def.kind === "title") return <TitleTag title={def} size="xs" className={className} />;
  if (def.kind === "banner") {
    return (
      <BannerSurface banner={def} className={cx("rounded-md border border-line-strong", className)}>
        <span className="block h-5 w-9" />
      </BannerSurface>
    );
  }
  return <BadgeEmblem badge={def} size="sm" className={className} />;
}

/** Preview of any cosmetic (locker tile / recap chip): art + name + kind. */
export function CosmeticPreview({ id, className, compact, size = "md" }: { id: string; className?: string; compact?: boolean; size?: CosmeticSize }) {
  const def = cosmeticById.get(id);
  const copy = useCosmeticCopy();
  if (!def) return null;
  return (
    <span className={cx("inline-flex items-center gap-3", className)}>
      <span className="flex shrink-0 items-center justify-center" style={{ minWidth: PX[size] * 1.4, minHeight: PX[size] * 1.2 }}>
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
