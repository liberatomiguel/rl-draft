"use client";

/**
 * Cosmetic renderers (v2.0, visual language reset in rc.3): the ONE place a
 * title / badge / banner is drawn, so the profile hero, the leaderboard rows,
 * the locker, the recap and the toasts all look the same.
 *
 * Titles (rc.20, the final set) are the "Live" / "New" chip decorated by
 * tier: common grey, uncommon a weak colour, rare a strong colour with a soft
 * glow, epic a gradient with glow and a holo sweep, legendary white gold with
 * glow, holo and pointer tilt. Banners are layered CSS gradients per pattern
 * family (no images); only the legendary sheen moves, with transform. Badges
 * (rc.4) are illustrated art: static SVGs drawn from Miguel's design file.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { cosmeticById, type CosmeticDef, type CosmeticTier, type Stops } from "@/data/cosmetics";
import { BADGE_GLOW_PAD, badgeArtSrc, badgeGlowSrc, badgeShift, bannerArtSrc } from "@/lib/assets";
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
/** A named size or an exact pixel box (badges, rc.5). */
export type BadgeSize = CosmeticSize | number;

export const COSMETIC_PX: Record<CosmeticSize, number> = { xs: 20, sm: 28, md: 40, lg: 56, xl: 72 };
const PX = COSMETIC_PX;

/** Tier accents reused by the locker tiles. */
export const TIER_ACCENT: Record<CosmeticTier, string> = {
  common: "#94a3b8",
  uncommon: "#9fe3b8",
  rare: "#60a5fa",
  epic: "#c084fc",
  legend: "#fcd34d",
};

export const TIER_RING: Record<CosmeticTier, string> = {
  common: "border-line",
  uncommon: "border-emerald-300/35",
  rare: "border-blue/40",
  epic: "border-violet-400/45",
  legend: "border-amber-300/50",
};

// ---------------------------------------------------------------------------
// Badge emblem (rc.4: Miguel's "Gema & Moldura" art, one static SVG each;
// rc.7: effects rebuilt light; rc.8: rare plain; rc.9: pre-rendered WebP in
// production; rc.11: silhouette glow; rc.13: legendary still at rest, tilt on
// hover only — globals.css "Badge FX")
// ---------------------------------------------------------------------------

/** Below this box the effects are invisible noise, so the art renders plain. */
const BADGE_FX_MIN_PX = 28;
/** Pointer tilt range (deg) by badge size — a board-row badge tilts far less
 *  than the profile's. Rendering, not gameplay. */
const tiltDegFor = (px: number): number => (px >= 64 ? 32 : px >= 44 ? 21 : 12);
/** Twinkles only on badges at least this big (hero, locker, peek) — on the
 *  board and the profile showcase they are noise and cost main-thread time. */
const BADGE_SPARK_MIN_PX = 64;

/**
 * ONE shared IntersectionObserver marks badges on screen (`data-live`); the
 * CSS only animates those, so a long board or locker grid costs nothing off
 * screen. A data attribute, not a class: React owns `className`.
 */
let liveObserver: IntersectionObserver | null | undefined;
function observeLive(el: Element): () => void {
  if (liveObserver === undefined) {
    liveObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                if (e.isIntersecting) (e.target as HTMLElement).dataset.live = "";
                else delete (e.target as HTMLElement).dataset.live;
              }
            },
            { rootMargin: "48px" },
          );
  }
  if (!liveObserver) {
    (el as HTMLElement).dataset.live = "";
    return () => {};
  }
  liveObserver.observe(el);
  return () => liveObserver?.unobserve(el);
}

/** A stable per-badge offset so a grid never animates in lockstep. */
function fxDelay(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `-${(h % 5000) / 1000}s`;
}

/**
 * A badge: its SVG art (`public/badges/<art>.svg`). Lazy + async, so a board of
 * 100 rows only fetches what scrolls into view; in production it is a
 * pre-rendered WebP (rc.9). Effects stay cheap (transform / opacity only, on
 * screen only): common / uncommon / rare plain; epic a soft prismatic sweep;
 * legendary still at rest with a gold glow in its own silhouette (blurred at
 * build time) breathing gently and a slow sweep, tilting toward the pointer on
 * hover (desktop, size-scaled). Twinkles only on large badges. The sweep is
 * masked by the badge art so it only lights the badge.
 * `reduce-fx` / `lite-fx` / reduced motion switch the motion off.
 */
export function BadgeEmblem({
  badge,
  size = "sm",
  className,
  fx = true,
}: {
  badge: CosmeticDef;
  size?: BadgeSize;
  className?: string;
  /** false = plain art (tiny previews). */
  fx?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isBadge = badge.kind === "badge";
  const px = typeof size === "number" ? size : PX[size];
  const tier = badge.tier;
  const live = isBadge && fx && px >= BADGE_FX_MIN_PX && (tier === "epic" || tier === "legend");
  useEffect(() => {
    if (!live || !ref.current) return;
    return observeLive(ref.current);
  }, [live]);
  if (badge.kind !== "badge") return null;
  const src = badgeArtSrc(badge.style.art, px);
  // rc.21: move the art's visual centre onto the box centre (build-images
  // measures the alpha-weighted centroid; crests / tabs made some badges sit
  // off-centre next to the others).
  const shift = badgeShift(badge.style.art);
  const shiftStyle = shift ? { translate: `${(shift[0] * px).toFixed(1)}px ${(shift[1] * px).toFixed(1)}px` } : undefined;
  const img = (
    // Static SVG from public/ (no next/image: nothing to optimise, and the
    // static export serves it as is).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={px}
      height={px}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      draggable={false}
      className={live ? "bfx-img" : cx("shrink-0 select-none object-contain", className)}
      style={live ? shiftStyle : { width: px, height: px, ...shiftStyle }}
    />
  );
  if (!live) return img;

  // Legendary + mouse: tilt toward the pointer (DOM-only CSS vars and a data
  // attribute, no re-render). At rest a legendary does not move.
  const tiltDeg = tiltDegFor(px);
  const sparks = px >= BADGE_SPARK_MIN_PX;
  const onMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (e.pointerType !== "mouse" || !el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    if (!("hover" in el.dataset)) {
      // Hand-off without a jump: freeze the idle sway where it is, then ease it
      // flat while the pointer tilt (outer layer) eases in.
      const sway = el.querySelector<HTMLElement>(".bfx-sway");
      if (sway) sway.style.transform = getComputedStyle(sway).transform;
      el.dataset.hover = "";
      if (sway) {
        void sway.offsetWidth;
        sway.style.transition = "transform 0.35s ease-out";
        sway.style.transform = "none";
      }
    }
    el.style.setProperty("--bfx-ry", `${(x * tiltDeg * 2).toFixed(1)}deg`);
    el.style.setProperty("--bfx-rx", `${(-y * tiltDeg * 2).toFixed(1)}deg`);
    el.style.setProperty("--bfx-bx", `${(-x * 70).toFixed(1)}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    delete el.dataset.hover;
    for (const v of ["--bfx-ry", "--bfx-rx", "--bfx-bx"]) el.style.removeProperty(v);
    const sway = el.querySelector<HTMLElement>(".bfx-sway");
    sway?.style.removeProperty("transform");
    sway?.style.removeProperty("transition");
  };
  const legend = tier === "legend";
  const glow = legend ? badgeGlowSrc(badge.style.art) : null;
  const vars: Record<string, string | number> = { width: px, height: px, "--bfx-mask": `url("${src}")`, "--bfx-delay": fxDelay(badge.id) };
  if (glow) {
    vars["--bfx-glow"] = `url("${glow}")`;
    vars["--bfx-glow-pad"] = BADGE_GLOW_PAD;
  }
  return (
    <span
      ref={ref}
      className={cx("bfx", `bfx-${tier}`, px <= 40 && "bfx-sm", className)}
      style={vars as React.CSSProperties}
      onPointerMove={legend ? onMove : undefined}
      onPointerLeave={legend ? onLeave : undefined}
      aria-hidden
    >
      <span className="bfx-tilt">
        <span className="bfx-sway">
          {glow ? <span className="bfx-glow" /> : null}
          {img}
          <span className="bfx-holo">
            <span className="bfx-band" />
          </span>
          {sparks ? <span className="bfx-spark bfx-spark-a" /> : null}
          {sparks ? <span className="bfx-spark bfx-spark-b" /> : null}
          {legend && sparks ? <span className="bfx-spark bfx-spark-c" /> : null}
        </span>
      </span>
    </span>
  );
}

/** A badge chip: the emblem, optionally with its name. */
export function BadgeChip({ badge, size = "sm", className, showName }: { badge: CosmeticDef | null | undefined; size?: BadgeSize; className?: string; showName?: boolean }) {
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

/** Row of up to three badges. rc.4: the first is the FEATURED one — pass
 *  `featuredSize` to draw it a step larger than the rest. */
export function BadgeRow({
  badges,
  size = "sm",
  featuredSize,
  className,
}: {
  badges: CosmeticDef[];
  size?: BadgeSize;
  featuredSize?: BadgeSize;
  className?: string;
}) {
  if (badges.length === 0) return null;
  return (
    <span className={cx("inline-flex items-center gap-1", className)}>
      {badges.map((b, i) => (
        <BadgeChip key={b.id} badge={b} size={i === 0 && featuredSize ? featuredSize : size} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Title tag — the same chip the UI uses for "Live" / "New"
// ---------------------------------------------------------------------------

function stopsVars(colors: Stops, glow?: string): Record<string, string> {
  return {
    "--cos-c1": colors[0],
    "--cos-c2": colors[1] ?? colors[0],
    "--cos-c3": colors[2] ?? colors[1] ?? colors[0],
    "--cos-glow": glow ?? colors[0],
  };
}

/** Pointer tilt range (deg) for legendary titles — desktop only, no re-render. */
const TITLE_TILT_DEG = 14;
/** Names this long get the tighter `cos-title-long` treatment. */
const LONG_TITLE_CHARS = 22;

/** rc.21: a step larger everywhere (Miguel) — md is the profile hero, sm the
 *  board row, xs the compact icon in lists and the calendar. */
const TITLE_SIZE = {
  xs: "px-1.5 py-px text-[9.5px]",
  sm: "px-1.5 py-px text-[12px]",
  md: "px-2 py-0.5 text-[15px]",
  lg: "px-3 py-1 text-lg",
  xl: "px-4 py-2 text-2xl",
} as const;

export function TitleTag({ title, size = "sm", className }: { title: CosmeticDef | null | undefined; size?: keyof typeof TITLE_SIZE; className?: string }) {
  const copy = useCosmeticCopy();
  if (!title || title.kind !== "title") return null;
  const sizeClass = TITLE_SIZE[size];
  const legend = title.tier === "legend";
  const name = copy.name(title.id);
  // Legendary: tilt toward the pointer (CSS vars on the element, no state).
  const onMove = legend
    ? (e: React.PointerEvent<HTMLSpanElement>) => {
        if (e.pointerType !== "mouse") return;
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ct-ry", `${(x * TITLE_TILT_DEG * 2).toFixed(1)}deg`);
        el.style.setProperty("--ct-rx", `${(-y * TITLE_TILT_DEG * 2).toFixed(1)}deg`);
        el.style.setProperty("--ct-bx", `${(x * 60).toFixed(1)}%`);
      }
    : undefined;
  const onLeave = legend
    ? (e: React.PointerEvent<HTMLSpanElement>) => {
        for (const v of ["--ct-ry", "--ct-rx", "--ct-bx"]) e.currentTarget.style.removeProperty(v);
      }
    : undefined;
  return (
    <span
      className={cx("cos-title", `cos-title-${title.tier}`, name.length >= LONG_TITLE_CHARS && "cos-title-long", sizeClass, className)}
      style={stopsVars(title.style.colors, title.style.glow) as React.CSSProperties}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <span className="cos-title-text">{name}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Banner surface
// ---------------------------------------------------------------------------

/** A banner background (profile hero / leaderboard row). The left side is
 *  always kept dark so the text reads; the colour lives on the right. Renders
 *  a plain wrapper when there is no banner so layout never changes. */
/** Pointer tilt range (deg) for the legendary banner on the profile hero. */
const BANNER_TILT_DEG = 4;

export function BannerSurface({
  banner,
  children,
  className,
  plainClassName,
  glow,
  displayPx = 1240,
}: {
  banner: CosmeticDef | null | undefined;
  children: ReactNode;
  className?: string;
  /** Classes used when no banner is equipped. */
  plainClassName?: string;
  /** The profile hero: epic / legendary glow in the banner's colour. */
  glow?: boolean;
  /** Widest the surface renders (CSS px) — picks the WebP width. */
  displayPx?: number;
}) {
  if (!banner || banner.kind !== "banner") return <div className={cx(className, plainClassName)}>{children}</div>;
  const legend = banner.tier === "legend";
  // Legendary (rc.22): the holo band follows the pointer; on the hero (glow)
  // the whole surface tilts a little, like the legendary titles. DOM-only CSS
  // vars, no re-render; transform only.
  const onMove = legend
    ? (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== "mouse") return;
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.dataset.hover = "";
        el.style.setProperty("--cb-bx", `${(x * 90).toFixed(1)}%`);
        if (glow) {
          el.style.setProperty("--cb-ry", `${(x * BANNER_TILT_DEG * 2).toFixed(2)}deg`);
          el.style.setProperty("--cb-rx", `${(-y * BANNER_TILT_DEG * 2).toFixed(2)}deg`);
        }
      }
    : undefined;
  const onLeave = legend
    ? (e: React.PointerEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        delete el.dataset.hover;
        for (const v of ["--cb-bx", "--cb-ry", "--cb-rx"]) el.style.removeProperty(v);
      }
    : undefined;
  return (
    <div
      className={cx(bannerClasses(banner), glow && "cos-banner-glow", className)}
      style={bannerVars(banner, displayPx) as React.CSSProperties}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <span className="cos-frame" aria-hidden />
      {children}
    </div>
  );
}

/** The class list of a banner surface (shared with the unlock pop-up). */
export function bannerClasses(banner: Extract<CosmeticDef, { kind: "banner" }>): string {
  return cx("cos-banner", `cos-banner-${banner.tier}`);
}

/** CSS variables of a banner: its image (rc.21, pre-rendered art) and glow colour. */
export function bannerVars(banner: Extract<CosmeticDef, { kind: "banner" }>, displayPx = 1240): Record<string, string> {
  const [a, b, d] = banner.style.frame;
  return {
    "--cos-img": `url("${bannerArtSrc(banner.style.art, displayPx)}")`,
    "--cos-glow": banner.style.glow,
    "--cos-fa": a,
    "--cos-fb": b,
    "--cos-fd": d,
  };
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
        <BannerSurface banner={def} displayPx={400} className={cx("cos-banner-thumb rounded-md border border-line-strong", className)}>
          <span className="block" style={{ width: PX[size] * 2.8, height: PX[size] * 1.25 }} />
        </BannerSurface>
      );
    case "title":
      return (
        <span className={cx("inline-flex items-center", className)}>
          <TitleTag title={def} size={size === "xs" ? "xs" : size === "sm" ? "sm" : size === "xl" ? "lg" : "md"} />
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
      <BannerSurface banner={def} displayPx={400} className={cx("cos-banner-thumb rounded-md border border-line-strong", className)}>
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
