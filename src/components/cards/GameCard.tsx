"use client";

/**
 * GameCard v3 — renders any card kind in any state.
 *
 * Base cards (player/coach/sub): org logo as the centerpiece (no player
 * photos on base cards by design). Org cards: logo + buff, framed by buff
 * rarity (~ common · + silver · ++ gold · +++ blue).
 * Special cards: player photo (public/cards/specials/<id>.png or imageUrl)
 * with heavy rarity treatment — animated frames, halo, foil sheen.
 * Hidden-overall runs (v0.5.1, by direction): ratings/buffs/rarity stay
 * "??" but ORG LOGOS show everywhere, and SPECIALS are masked — frame,
 * holo and rarity announce "this is a special", while the photo, title,
 * type and overall stay secret until the results reveal.
 */

import { useState } from "react";
import Image from "next/image";
import { useCopy } from "@/content/copy";
import type { ResolvedCard } from "@/engine/cards";
import { cx, initials } from "@/lib/util";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { TiltCard, type TiltIntensity } from "@/components/ui/TiltCard";
import { REGION_BADGE } from "@/components/regionStyle";

export interface GameCardProps {
  card: ResolvedCard;
  /** Run-level visibility. Org cards always show their buff instead. */
  showOverall: boolean;
  /** Collection state — uncollected specials show "??" instead of rarity. */
  specialCollected?: boolean;
  size?: "sm" | "md" | "lg";
  /**
   * Fluid width: the card fills its parent (cap it with a max-w wrapper).
   * Required inside grid cells — fixed widths overflow small cells, and a
   * bare `w-full` collapses because the inner <button> is shrink-to-fit, so
   * fluid threads `w-full` through every wrapper level (v0.5.1 fix).
   */
  fluid?: boolean;
  /**
   * Lighter render for dense grids (e.g. the full collection): KEEPS the 3D tilt
   * and the foil sheen, but drops the GPU-heavy cursor holo (mix-blend-mode) +
   * backdrop-blur pills and the per-frame box-shadow halo pulse (a static rarity
   * glow stays). Lets dozens of specials scroll smoothly; the full effects still
   * play on single-card / detail views (v1.1.x perf).
   */
  lite?: boolean;
  /**
   * LCP hint for the few cards above the fold (e.g. the collection's first row):
   * loads the special photo eagerly with high fetch priority instead of lazily.
   * Only meaningful for unlocked specials — pass it to a small N of leading
   * cards, never the whole grid (priority on everything defeats the purpose).
   */
  priority?: boolean;
  selected?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  /**
   * Org logo to show in place of the mystery "?" when a SPECIAL is masked on
   * a hidden-overall run (v0.7.0): pass the drawn lineup's org so the card
   * wears the same crest as the other cards in the offer — which also keeps
   * the special's own historical moment hidden. Falls back to the card's org.
   */
  maskOrgId?: string;
  maskSeasonId?: string;
  /**
   * 3D tilt: defaults to light on base cards and strong on specials;
   * "max" is for the collection detail view. "off" disables it.
   */
  tilt?: TiltIntensity | "off";
  onClick?: () => void;
  className?: string;
}

/**
 * Role tag tints (v0.7.0) — a small colored pill per card kind so the player
 * can tell players/coach/sub/org apart at a glance. Org cards are tinted by
 * their REGION instead (the same accent as the draft-draw region badge).
 */
const KIND_TAG: Record<ResolvedCard["kind"], string> = {
  player: "border-blue-400/40 bg-blue-400/10 text-blue-200",
  coach: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  sub: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  org: "border-line-strong bg-white/5 text-sub",
};

const SPECIAL_ACCENT: Record<string, string> = {
  rare: "text-indigo-300",
  epic: "text-teal-300",
  mythic: "text-red-300",
  legendary: "text-amber-200",
};

/**
 * Overall-number treatment per special rarity (v1.1.1). Each value is a
 * self-contained `.ovr-*` class in globals.css that owns the color + its own
 * legibility shadow + a tier-scaled glow (legendary is a white-gold metallic
 * gradient, not a flat color). ⇢ To retint, edit the
 * `.ovr-rare/.ovr-epic/.ovr-mythic/.ovr-legendary` rules in src/app/globals.css.
 */
const SPECIAL_OVR_COLOR: Record<string, string> = {
  rare: "ovr-rare",
  epic: "ovr-epic",
  mythic: "ovr-mythic",
  legendary: "ovr-legendary",
};

function frameOf(card: ResolvedCard, showOverall: boolean): string {
  if (card.special) {
    const holo = ["epic", "mythic", "legendary"].includes(card.special.rarity)
      ? ` holo-${card.special.rarity}`
      : "";
    return `card-${card.special.rarity} card-special${holo}`;
  }
  // Hidden runs black out EVERYTHING except special cards (base doc §11):
  // player/coach/sub overalls, coach bonuses, org buffs and all rarities.
  if (!showOverall) return "card-hidden";
  return `card-${card.baseRarity ?? "common"}`;
}

export function GameCard({
  card,
  showOverall,
  specialCollected = true,
  size = "md",
  fluid,
  lite,
  priority,
  selected,
  disabled,
  disabledLabel,
  maskOrgId,
  maskSeasonId,
  tilt,
  onClick,
  className,
}: GameCardProps) {
  const { RARITY_LABELS, SPECIAL_TYPE_LABELS, STAT_LABELS, DRAFT_UI } = useCopy();
  const ROLE_LABEL: Record<ResolvedCard["kind"], string> = {
    player: DRAFT_UI.player,
    coach: DRAFT_UI.slotCoach,
    sub: DRAFT_UI.slotSub,
    org: DRAFT_UI.slotOrg,
  };
  const isOrg = card.kind === "org";
  const isSpecial = Boolean(card.special);
  const hiddenBase = !showOverall && !isSpecial;
  // Hidden runs: the special's identity (photo/title/type/overall) is a
  // results-screen reveal — only the frame/holo betray that it IS one.
  const maskedSpecial = isSpecial && !showOverall;
  // Masked specials (v0.7.0) show a TEAM LOGO centerpiece — the drawn lineup's
  // crest (maskOrgId) when supplied, so they match the rest of the offer in
  // hidden mode instead of a bare "?". Base cards always show their org logo.
  const showLogoCenter = !isSpecial || maskedSpecial;
  const logoOrgId = maskedSpecial ? maskOrgId ?? card.orgId : card.orgId;
  const logoSeasonId = maskedSpecial ? maskSeasonId ?? card.seasonId : card.seasonId;
  // Role tag tint — a FIXED color per kind (v1.0: the org tag no longer
  // borrows the region color; only the org's region CHIP is region-tinted).
  const tagClass = KIND_TAG[card.kind];
  const frame = frameOf(card, showOverall);
  const overallText = isOrg ? null : showOverall ? String(card.overall) : "??";
  // `lite` (dense grids) keeps the 3D tilt — it's cheap now that TiltCard only
  // promotes a layer (will-change) while actually tilting. Only the heavier
  // blend/backdrop/halo-pulse effects are dropped in lite (below + globals.css).
  const tiltTier: TiltIntensity | "off" =
    tilt ?? (disabled ? "off" : isSpecial ? "strong" : "light");

  const sizeClasses = fluid
    ? "w-full p-2.5 md:p-3"
    : size === "lg"
      ? "w-44 md:w-52 p-3.5"
      : size === "sm"
        ? "w-32 p-2.5"
        : "w-36 md:w-44 p-3";

  const interactive = Boolean(onClick) && !disabled;

  const body = (
    <div
      className={cx(
        "card-frame flex aspect-[3/4.3] flex-col text-left transition-all duration-200",
        frame,
        isSpecial && lite && "card-lite",
        sizeClasses,
        interactive && "cursor-pointer hover:-translate-y-1.5 hover:brightness-110",
        selected && "-translate-y-1.5 !shadow-[0_0_30px_rgba(249,115,22,0.45)] ring-2 ring-orange",
        disabled && "opacity-40 saturate-50",
        className,
      )}
    >
      {/* Special photo layer — masked specials hide the photo and show the
          team-logo centerpiece below instead (v0.7.0); the frame/holo still
          announce that it IS a special. */}
      {isSpecial && !maskedSpecial ? <SpecialArt card={card} priority={priority} /> : null}

      {/* Holo treatment, tier-scaled (Balatro-style, cursor-reactive). Skipped
          in `lite` mode (dense grids): these mix-blend-mode layers are the main
          scroll-jank cost when many specials render at once. */}
      {isSpecial && card.special && !lite ? (
        <>
          {card.special.rarity !== "rare" ? <div className="reverse-holo" aria-hidden /> : null}
          <div
            aria-hidden
            className={cx("holo-rainbow z-[5]", `holo-rainbow-${card.special.rarity}`)}
          />
        </>
      ) : null}

      {/* Top row */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="leading-none">
          {overallText ? (
            <span
              className={cx(
                "display block font-bold leading-none",
                size === "sm" ? "text-2xl" : "text-2xl md:text-3xl",
                isSpecial
                  ? (SPECIAL_OVR_COLOR[card.special!.rarity] ?? "text-white ovr-shadow")
                  : showOverall && (card.overall ?? 0) >= 90
                    ? "text-cyan"
                    : hiddenBase
                      ? "text-faint"
                      : "text-ink",
              )}
            >
              {overallText}
            </span>
          ) : (
            <span
              className={cx(
                "display block text-2xl font-bold leading-none",
                showOverall ? "text-orange-bright" : "text-faint",
              )}
            >
              {!showOverall ? "??" : card.buffLevel === "~" ? "·" : card.buffLevel}
            </span>
          )}
          <span
            className={cx(
              "display mt-1 inline-flex items-center rounded border px-1 py-px text-[8px] font-bold uppercase leading-none tracking-[0.12em]",
              tagClass,
              isSpecial && !lite && "backdrop-blur-sm",
            )}
          >
            {ROLE_LABEL[card.kind]}
          </span>
        </div>
        {card.country ? (
          <CountryChip code={card.country} className={cx(isSpecial && "bg-black/40")} />
        ) : isOrg && card.region ? (
          // Org region wears the same region accent as the draft-draw badge.
          <CountryChip code={card.region} className={REGION_BADGE[card.region]} />
        ) : null}
      </div>

      {/* Centerpiece: org logo (base cards) / photo space (specials).
          Org logos stay visible on hidden runs (v0.5.1) — only ratings,
          buffs and rarity are secret. */}
      <div className="relative z-10 flex flex-1 items-center justify-center py-1">
        {showLogoCenter ? (
          <div className="card-texture flex h-full w-full items-center justify-center rounded-lg">
            {logoOrgId ? (
              <TeamLogo
                orgId={logoOrgId}
                seasonId={logoSeasonId}
                size={size === "sm" ? "md" : "lg"}
              />
            ) : (
              <span className="display text-4xl font-bold text-white/15">?</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Name plate */}
      <div className="relative z-10 min-h-0">
        <p
          className={cx(
            "display truncate font-bold uppercase tracking-wide",
            size === "sm" ? "text-xs" : "text-xs md:text-sm",
            isSpecial ? "text-white" : "text-ink",
          )}
        >
          {card.name}
        </p>
        {card.special ? (
          <p
            className={cx(
              "truncate text-[10px] font-semibold uppercase tracking-wider",
              SPECIAL_ACCENT[card.special.rarity] ?? "text-orange-bright",
            )}
          >
            {maskedSpecial || !specialCollected ? "???" : card.special.title}
          </p>
        ) : null}
        <p className={cx("mt-0.5 truncate text-[10px]", isSpecial ? "text-white/60" : "text-sub")}>
          {isOrg
            ? showOverall
              ? `${STAT_LABELS[card.buffType ?? ""] ?? ""} ${card.buffLevel === "~" ? "" : card.buffLevel ?? ""}`.trim() || "Neutral"
              : "Buff hidden"
            : maskedSpecial
              ? "???" // the special's own org/season would identify the moment
              : [card.orgName, card.seasonShort].filter(Boolean).join(" · ")}
        </p>

        {/* Bottom tag — ratings/buffs blacked out on hidden runs. min-w-0 +
            truncate keep the type·rarity pill inside the card on small sizes
            (it used to spill past the frame and clip mid-letter). */}
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-1">
          {card.special ? (
            <Badge
              tone={specialCollected && !maskedSpecial ? "gold" : "neutral"}
              className={cx("!block max-w-full truncate !text-[9px]", !lite && "backdrop-blur-sm")}
            >
              {maskedSpecial
                ? `${SPECIAL_TYPE_LABELS.masked} · ${RARITY_LABELS[card.special.rarity]}`
                : specialCollected
                  ? `${SPECIAL_TYPE_LABELS[card.special.cardType]} · ${RARITY_LABELS[card.special.rarity]}`
                  : "?? · ??"}
            </Badge>
          ) : card.kind === "coach" && card.buffType && showOverall ? (
            <Badge tone="blue" className="!block max-w-full truncate !text-[9px]">
              {STAT_LABELS[card.buffType]} {card.buffLevel}
            </Badge>
          ) : (
            <span className="text-[9px] uppercase tracking-widest text-faint">
              {hiddenBase
                ? "Hidden"
                : (card.baseRarity ?? "common") === "common"
                  ? ""
                  : RARITY_LABELS[card.baseRarity ?? ""]}
            </span>
          )}
        </div>
      </div>

      {/* Disabled overlay */}
      {disabled && disabledLabel ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[13px] bg-black/55">
          <span className="display rotate-[-8deg] rounded border border-line-strong bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sub">
            {disabledLabel}
          </span>
        </div>
      ) : null}
    </div>
  );

  // Buttons are shrink-to-fit (unlike divs) — fluid must force w-full here
  // or pickable cards collapse while disabled ones render full size.
  const interactiveBody =
    onClick && !disabled ? (
      <button
        type="button"
        onClick={onClick}
        className={cx("relative block focus-visible:outline-orange", fluid && "w-full")}
        aria-pressed={selected}
      >
        {body}
      </button>
    ) : (
      <div className={cx("relative", fluid && "w-full")}>{body}</div>
    );

  if (tiltTier === "off") return interactiveBody;
  return (
    <TiltCard intensity={tiltTier} className={fluid ? "w-full" : undefined}>
      {interactiveBody}
    </TiltCard>
  );
}

/** Photo layer for special cards: real image or stylized fallback art. */
function SpecialArt({ card, priority }: { card: ResolvedCard; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = card.special?.imageUrl || `/cards/specials/${card.special?.id}.png`;

  if (failed) {
    return (
      <div className="special-fallback-art">
        <span className="display select-none text-6xl font-bold text-white/10">
          {initials(card.name)}
        </span>
        <div className="special-photo" />
      </div>
    );
  }

  return (
    <>
      {/* next/image: Vercel (and the local optimizer) serves a resized
          WebP/AVIF — alpha/transparency preserved — at the card's display size,
          lazily. Keeps the photo folder light without touching the source PNGs
          or their framing. `fill` => absolute inset-0 inside the relative card. */}
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        sizes="(max-width: 639px) 50vw, 256px"
        decoding="async"
        priority={priority}
        onError={() => setFailed(true)}
        className="object-cover object-[center_18%]"
      />
      <div className="special-photo" />
    </>
  );
}

