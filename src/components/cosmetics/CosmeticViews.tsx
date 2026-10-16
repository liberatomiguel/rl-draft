"use client";

/**
 * Cosmetic renderers (v2.0): the ONE place a title / badge / frame / banner is
 * drawn, so the profile card, the leaderboard rows, the locker and the recap all
 * look the same. Pure CSS from the catalog's style params (no image assets).
 */

import type { ReactNode } from "react";
import { cosmeticById, type BadgeGlyph as BadgeGlyphName, type CosmeticDef } from "@/data/cosmetics";
import { useCopy } from "@/content/copy";
import { cx } from "@/lib/util";

/** Name + description from the copy dictionary (falls back to the id). */
export function useCosmeticCopy() {
  const { COSMETICS } = useCopy();
  return {
    name: (id: string) => COSMETICS.items[id]?.name ?? id,
    desc: (id: string) => COSMETICS.items[id]?.desc ?? "",
    kind: (k: string) => COSMETICS.kinds[k] ?? k,
    all: COSMETICS,
  };
}

/** Gradient ring around any round element (the rank emblem, an avatar). */
export function FrameRing({
  frame,
  children,
  width = 3,
  className,
}: {
  frame: CosmeticDef | null | undefined;
  children: ReactNode;
  /** Ring thickness in px. */
  width?: number;
  className?: string;
}) {
  if (!frame || frame.kind !== "frame") return <>{children}</>;
  const { colors, rings, animated } = frame.style;
  const [c1, c2, c3] = [colors[0], colors[1] ?? colors[0], colors[2]];
  const style: Record<string, string> = {
    "--cos-ring-w": `${width}px`,
    "--cos-c1": c1,
    "--cos-c2": c2,
    ...(c3 ? { "--cos-c3": c3 } : {}),
    "--cos-ring": `linear-gradient(135deg, ${c1}, ${c2}${c3 ? `, ${c3}` : ""})`,
  };
  return (
    <span
      className={cx(
        "cos-frame",
        rings === 2 && "cos-frame-2",
        animated === "sheen" && "cos-frame-sheen",
        animated === "holo" && "cos-frame-holo",
        className,
      )}
      style={style as React.CSSProperties}
      title={frame.id}
    >
      <span className="flex items-center justify-center p-0.5">{children}</span>
    </span>
  );
}

/** A banner background (profile header / leaderboard row). Renders a plain
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
      className={cx(
        "cos-banner",
        s.pattern === "rays" && "cos-banner-rays",
        s.pattern === "grid" && "cos-banner-grid",
        s.pattern === "stripes" && "cos-banner-stripes",
        s.animated && "cos-banner-animated",
        className,
      )}
      style={style as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** The title tag shown next to a name. */
export function TitleTag({
  title,
  size = "sm",
  className,
}: {
  title: CosmeticDef | null | undefined;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const copy = useCosmeticCopy();
  if (!title || title.kind !== "title") return null;
  const sizeClass = size === "xs" ? "text-[9px]" : size === "md" ? "text-sm" : "text-[11px]";
  return (
    <span
      className={cx("cos-title", title.style.glow && "cos-title-glow", sizeClass, className)}
      style={{ "--cos-color": title.style.color } as React.CSSProperties}
    >
      {copy.name(title.id)}
    </span>
  );
}

/** A badge glyph chip. */
export function BadgeChip({
  badge,
  size = "sm",
  className,
  showName,
}: {
  badge: CosmeticDef | null | undefined;
  size?: "xs" | "sm" | "md";
  className?: string;
  showName?: boolean;
}) {
  const copy = useCosmeticCopy();
  if (!badge || badge.kind !== "badge") return null;
  const px = size === "xs" ? "h-4 w-4" : size === "md" ? "h-8 w-8" : "h-5 w-5";
  const icon = size === "xs" ? "h-2.5 w-2.5" : size === "md" ? "h-4.5 w-4.5" : "h-3 w-3";
  const name = copy.name(badge.id);
  return (
    <span className={cx("inline-flex items-center gap-1", className)} title={name}>
      <span
        className={cx("inline-flex shrink-0 items-center justify-center rounded-full border", px)}
        style={{
          color: badge.style.color,
          borderColor: `${badge.style.color}66`,
          background: `${badge.style.color}1f`,
        }}
      >
        <Glyph name={badge.style.glyph} className={icon} />
      </span>
      {showName ? <span className="text-[11px] font-semibold text-sub">{name}</span> : null}
    </span>
  );
}

/** Row of up to three badges. */
export function BadgeRow({ badges, size = "sm", className }: { badges: CosmeticDef[]; size?: "xs" | "sm" | "md"; className?: string }) {
  if (badges.length === 0) return null;
  return (
    <span className={cx("inline-flex items-center gap-1", className)}>
      {badges.map((b) => (
        <BadgeChip key={b.id} badge={b} size={size} />
      ))}
    </span>
  );
}

/** Preview of any cosmetic (locker tile / recap chip): a swatch + name. */
export function CosmeticPreview({ id, className, compact }: { id: string; className?: string; compact?: boolean }) {
  const def = cosmeticById.get(id);
  const copy = useCosmeticCopy();
  if (!def) return null;
  const swatch = (() => {
    switch (def.kind) {
      case "frame":
        return (
          <FrameRing frame={def} width={3}>
            <span className="h-9 w-9 rounded-full bg-raised" />
          </FrameRing>
        );
      case "banner":
        return (
          <BannerSurface banner={def} className="h-11 w-16 rounded-md border border-line-strong">
            <span />
          </BannerSurface>
        );
      case "badge":
        return <BadgeChip badge={def} size="md" />;
      case "title":
        return (
          <span className="flex h-9 items-center">
            <TitleTag title={def} size="md" />
          </span>
        );
    }
  })();
  return (
    <span className={cx("inline-flex items-center gap-3", className)}>
      <span className="flex h-12 w-16 shrink-0 items-center justify-center">{swatch}</span>
      {compact ? null : (
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink">{copy.name(def.id)}</span>
          <span className="block text-[11px] text-faint">{copy.kind(def.kind)}</span>
        </span>
      )}
    </span>
  );
}

function Glyph({ name, className }: { name: BadgeGlyphName; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "flag":
      return (
        <svg {...common}>
          <path d="M5 21V4h11l-1.5 3.5L16 11H5" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.7-2.5 1.5-3.5C10.5 9 11.5 7 12 3Z" />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8Z" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
          <path d="M12 13v4m-3 3h6" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 3 5 13h6l-1 8 8-10h-6Z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6Z" />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="m5 9 2-2.5L9.5 9l2.5-3 2.5 3L17 6.5 19 9l-1 4H6L5 9Z" />
          <path d="M6.5 16.5h11" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Z" />
          <path d="M4 19a2 2 0 0 1 2-2h12" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      );
  }
}
