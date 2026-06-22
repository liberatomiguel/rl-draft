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
import type { SpecialEffect } from "@/engine/types";
import { BUFF_LEVEL_VALUE } from "@/config/balance";
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
  creator: "text-pink-200",
  wings: "text-orange-300",
  community: "text-emerald-300",
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
  creator: "ovr-creator",
  wings: "ovr-wings",
  community: "ovr-community",
};

/** Compact stat codes for the special-card buff pill (full names don't fit). */
const STAT_SHORT: Record<string, string> = {
  offense: "OFF",
  defense: "DEF",
  mechanics: "MEC",
  consistency: "CON",
  experience: "EXP",
  clutch: "CLT",
};

/**
 * Short label for a special card's buff, shown as a pill on the card (v1.2.1).
 * Whole-team boosts read "Team"; otherwise the (up to two) boosted stats. On
 * hidden-overall runs the value is masked to "+??" but the stat still shows —
 * e.g. "+?? CLT" — so the player knows WHAT it buffs, not how much.
 */
function specialBuffLabel(effect: SpecialEffect, showOverall: boolean): string | null {
  const attrs = effect.attributes ?? [];
  const value = showOverall ? `+${effect.value}` : "+??";
  // A direct overall lift (Creator card) is the headline buff — show it as OVR.
  if (effect.overallBonus) {
    return showOverall ? `+${effect.overallBonus} OVR` : "+?? OVR";
  }
  // A team_attribute_boost lifts the WHOLE team — read "Team" regardless of how
  // many stats it lists (and it doubles as less of an identity tell on Hard).
  if (effect.type === "team_attribute_boost") return `${value} Team`;
  if (attrs.length === 0) return null; // legacy situational effects → no stat pill
  const stats = attrs
    .slice(0, 2)
    .map((a) => STAT_SHORT[a] ?? a.slice(0, 3).toUpperCase())
    .join("·");
  return `${value} ${stats}`;
}

function frameOf(card: ResolvedCard, showOverall: boolean): string {
  if (card.special) {
    const holo = ["epic", "mythic", "legendary", "creator", "wings", "community"].includes(card.special.rarity)
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
  // v1.3: special cards always show their photo, identity, org/season and buff in
  // EVERY mode (base doc §11/§14) — exactly like base cards keep their crest and
  // name on no-overall runs. The ONLY difficulty-driven mask left for a special is
  // the rarity label (and the overall number, handled by `overallText`). Whether a
  // not-yet-collected special hides its title/rarity is the COLLECTION reward
  // (`specialCollected`), independent of difficulty.
  const hideSpecialRarity = isSpecial && !showOverall;
  // Only BASE cards use the org-logo centerpiece now; specials always show the photo.
  const showLogoCenter = !isSpecial;
  const logoOrgId = card.orgId;
  const logoSeasonId = card.seasonId;
  // Role tag tint — a FIXED color per kind (v1.0: the org tag no longer
  // borrows the region color; only the org's region CHIP is region-tinted).
  const tagClass = KIND_TAG[card.kind];
  const frame = frameOf(card, showOverall);
  const overallText = isOrg ? null : showOverall ? String(card.overall) : "??";
  // Buff pill (v1.2.1; v1.3 always shows the value): every special advertises its
  // full buff — the gameplay info a drafter needs, shown in EVERY mode now that the
  // photo is no longer hidden. It shows even on yet-to-be-unlocked specials.
  const buffLabel =
    isSpecial && card.special ? specialBuffLabel(card.special.effect, true) : null;
  // `lite` (dense grids) keeps the 3D tilt — it's cheap now that TiltCard only
  // promotes a layer (will-change) while actually tilting. Only the heavier
  // blend/backdrop/halo-pulse effects are dropped in lite (below + globals.css).
  const tiltTier: TiltIntensity | "off" =
    tilt ?? (disabled ? "off" : isSpecial ? "strong" : "light");

  const sizeClasses = fluid
    ? "w-full p-2 md:p-3"
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
      {/* Special photo layer — v1.3: always shown for specials, in every mode. */}
      {isSpecial ? <SpecialArt card={card} priority={priority} /> : null}

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
                // Mobile trims the overall a step so dense reveal/draft cards keep
                // every line inside the frame; desktop is unchanged (v1.2.1).
                size === "sm" ? "text-2xl" : "text-xl sm:text-2xl md:text-3xl",
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
                // Orange only when there's an actual boost; a neutral org reads as
                // a muted "—" so it's clearly "no buff", not a cryptic dot (v1.2.2).
                showOverall && card.buffLevel !== "~" ? "text-orange-bright" : "text-faint",
              )}
            >
              {!showOverall
                ? "??"
                : card.buffLevel === "~"
                  ? "—"
                  : `+${BUFF_LEVEL_VALUE[card.buffLevel ?? "~"]}`}
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
                // Mobile keeps the in-card logo a touch smaller so the nameplate
                // never clips after the v1.2.0 logo enlargement; desktop (md+)
                // restores the full "lg" size, so it's unchanged there (v1.2.1).
                className={
                  size === "sm"
                    ? undefined
                    : "!h-10 !w-10 sm:!h-14 sm:!w-14 md:!h-[4.5rem] md:!w-[4.5rem]"
                }
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
            {!specialCollected ? "???" : card.special.title}
          </p>
        ) : null}
        <p className={cx("mt-0.5 truncate text-[10px]", isSpecial ? "text-white/60" : "text-sub")}>
          {isOrg
            ? showOverall
              ? card.buffLevel === "~"
                ? "No buff"
                : `${STAT_LABELS[card.buffType ?? ""] ?? ""} +${BUFF_LEVEL_VALUE[card.buffLevel ?? "~"]}`.trim()
              : "Buff hidden"
            : [card.orgName, card.seasonShort].filter(Boolean).join(" · ")}
        </p>

        {/* Bottom tag — ratings/buffs blacked out on hidden runs. min-w-0 +
            truncate keep the type·rarity pill inside the card on small sizes
            (it used to spill past the frame and clip mid-letter). */}
        <div className="mt-1.5 flex min-w-0 items-center justify-between gap-1">
          {card.special ? (
            <>
              <Badge
                tone={specialCollected ? "gold" : "neutral"}
                className={cx("!block min-w-0 truncate !text-[9px]", !lite && "backdrop-blur-sm")}
              >
                {!specialCollected
                  ? "?? · ??"
                  : card.special.rarity === "creator"
                    ? RARITY_LABELS.creator
                    : // v1.3: type stays; only the rarity label hides on no-overall runs.
                      `${SPECIAL_TYPE_LABELS[card.special.cardType]} · ${
                        hideSpecialRarity ? "??" : RARITY_LABELS[card.special.rarity]
                      }`}
              </Badge>
              {buffLabel ? (
                <Badge
                  tone="good"
                  className={cx("shrink-0 !text-[9px]", !lite && "backdrop-blur-sm")}
                >
                  {buffLabel}
                </Badge>
              ) : null}
            </>
          ) : card.kind === "coach" && card.buffType && showOverall ? (
            <Badge tone="blue" className="!block max-w-full truncate !text-[9px]">
              {/* Same clear +N notation as org cards (v1.2.2). */}
              {card.buffLevel === "~"
                ? "No buff"
                : `${STAT_LABELS[card.buffType]} +${BUFF_LEVEL_VALUE[card.buffLevel ?? "~"]}`}
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
    // No assigned photo → show the org logo of the team this card was DRAFTED with
    // (resolvePlayerCard sets card.orgId/seasonId to the drafted lineup in-game, and
    // to the base card's lineup in the Collection — exactly the two contexts we want).
    // The center of the .special-photo gradient is transparent, so the logo reads.
    return (
      <div className="special-fallback-art">
        {card.orgId ? (
          <TeamLogo orgId={card.orgId} seasonId={card.seasonId} size="lg" />
        ) : (
          <span className="display select-none text-6xl font-bold text-white/10">
            {initials(card.name)}
          </span>
        )}
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

