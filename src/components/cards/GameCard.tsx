"use client";

/**
 * GameCard v2 — renders any card kind in any state.
 *
 * Base cards (player/coach/sub): org logo as the centerpiece (no player
 * photos on base cards by design). Org cards: logo + buff, framed by buff
 * rarity (~ common · + silver · ++ gold · +++ blue).
 * Special cards: player photo (public/cards/specials/<id>.png or imageUrl)
 * with heavy rarity treatment — animated frames, halo, foil sheen.
 * Hidden-overall runs: base cards go black with "??"; specials keep their
 * look but hide the number (base doc §10-§11).
 */

import { useState } from "react";
import { DRAFT_UI, RARITY_LABELS, SPECIAL_TYPE_LABELS, STAT_LABELS } from "@/content/copy";
import type { ResolvedCard } from "@/engine/cards";
import { cx, initials } from "@/lib/util";
import { Badge, CountryChip } from "@/components/ui/Badge";
import { TeamLogo } from "@/components/ui/TeamLogo";

export interface GameCardProps {
  card: ResolvedCard;
  /** Run-level visibility. Org cards always show their buff instead. */
  showOverall: boolean;
  /** Collection state — uncollected specials show "??" instead of rarity. */
  specialCollected?: boolean;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  onClick?: () => void;
  className?: string;
}

const ROLE_LABEL: Record<ResolvedCard["kind"], string> = {
  player: "Player",
  coach: "Coach",
  sub: "Sub",
  org: "Org",
};

const SPECIAL_ACCENT: Record<string, string> = {
  rare: "text-indigo-300",
  epic: "text-purple-300",
  mythic: "text-rose-300",
  legendary: "text-amber-300",
};

function frameOf(card: ResolvedCard, showOverall: boolean): string {
  if (card.special) return `card-${card.special.rarity} card-special`;
  if (!showOverall && card.kind !== "org") return "card-hidden";
  return `card-${card.baseRarity ?? "common"}`;
}

export function GameCard({
  card,
  showOverall,
  specialCollected = true,
  size = "md",
  selected,
  disabled,
  disabledLabel,
  onClick,
  className,
}: GameCardProps) {
  const isOrg = card.kind === "org";
  const isSpecial = Boolean(card.special);
  const hiddenBase = !showOverall && !isSpecial && !isOrg;
  const frame = frameOf(card, showOverall);
  const overallText = isOrg ? null : showOverall ? String(card.overall) : "??";

  const sizeClasses =
    size === "lg"
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
        sizeClasses,
        interactive && "cursor-pointer hover:-translate-y-1.5 hover:brightness-110",
        selected && "-translate-y-1.5 !shadow-[0_0_30px_rgba(249,115,22,0.45)] ring-2 ring-orange",
        disabled && "opacity-40 saturate-50",
        className,
      )}
    >
      {/* Special photo layer */}
      {isSpecial ? <SpecialArt card={card} /> : null}

      {/* Top row */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="leading-none">
          {overallText ? (
            <span
              className={cx(
                "display block font-bold leading-none",
                size === "sm" ? "text-2xl" : "text-3xl",
                isSpecial
                  ? "text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]"
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
            <span className="display block text-2xl font-bold leading-none text-orange-bright">
              {card.buffLevel === "~" ? "·" : card.buffLevel}
            </span>
          )}
          <span className={cx("kicker mt-1 block !text-[9px]", isSpecial && "!text-white/70")}>
            {ROLE_LABEL[card.kind]}
          </span>
        </div>
        {card.country ? (
          <CountryChip code={card.country} className={cx(isSpecial && "bg-black/40")} />
        ) : isOrg && card.region ? (
          <CountryChip code={card.region} />
        ) : null}
      </div>

      {/* Centerpiece: org logo (base cards) / photo space (specials) */}
      <div className="relative z-10 flex flex-1 items-center justify-center py-1">
        {isSpecial ? null : hiddenBase ? (
          <span className="display text-4xl font-bold text-white/15">?</span>
        ) : (
          <div className="card-texture flex h-full w-full items-center justify-center rounded-lg">
            {card.orgId ? (
              <TeamLogo orgId={card.orgId} size={size === "sm" ? "md" : "lg"} />
            ) : null}
          </div>
        )}
      </div>

      {/* Name plate */}
      <div className="relative z-10 min-h-0">
        <p
          className={cx(
            "display truncate font-bold uppercase tracking-wide",
            size === "sm" ? "text-xs" : "text-sm",
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
            {specialCollected ? card.special.title : "???"}
          </p>
        ) : null}
        <p className={cx("mt-0.5 truncate text-[10px]", isSpecial ? "text-white/60" : "text-sub")}>
          {isOrg
            ? `${STAT_LABELS[card.buffType ?? ""] ?? ""} ${card.buffLevel === "~" ? "" : card.buffLevel ?? ""}`.trim() || "Neutral"
            : [card.orgName, card.seasonShort].filter(Boolean).join(" · ")}
        </p>

        {/* Bottom tag */}
        <div className="mt-1.5 flex items-center justify-between gap-1">
          {card.special ? (
            <Badge tone={specialCollected ? "gold" : "neutral"} className="!text-[9px] backdrop-blur-sm">
              {specialCollected
                ? `${SPECIAL_TYPE_LABELS[card.special.cardType]} · ${RARITY_LABELS[card.special.rarity]}`
                : "?? · ??"}
            </Badge>
          ) : card.kind === "coach" && card.buffType ? (
            <Badge tone="blue" className="!text-[9px]">
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

  if (onClick && !disabled) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="relative block focus-visible:outline-orange"
        aria-pressed={selected}
      >
        {body}
      </button>
    );
  }
  return <div className="relative">{body}</div>;
}

/** Photo layer for special cards: real image or stylized fallback art. */
function SpecialArt({ card }: { card: ResolvedCard }) {
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
      />
      <div className="special-photo" />
    </>
  );
}

/** Non-pickable placeholder for lineups missing a coach or sub. */
export function PlaceholderCard({
  kind,
  size = "md",
}: {
  kind: "coach" | "sub";
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses =
    size === "lg"
      ? "w-44 md:w-52 p-3.5"
      : size === "sm"
        ? "w-32 p-2.5"
        : "w-36 md:w-44 p-3";
  return (
    <div
      className={cx(
        "card-frame card-common flex aspect-[3/4.3] flex-col opacity-55",
        sizeClasses,
      )}
      aria-label={kind === "coach" ? DRAFT_UI.noCoach : DRAFT_UI.noSub}
    >
      <div className="flex items-start justify-between">
        <div className="leading-none">
          <span className="display block text-3xl font-bold leading-none text-faint">50</span>
          <span className="kicker mt-1 block !text-[9px]">{ROLE_LABEL[kind]}</span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <svg viewBox="0 0 24 24" className="h-12 w-12 text-white/15" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="m6 6 12 12" />
        </svg>
      </div>
      <div className="min-h-0">
        <p className="display truncate text-sm font-bold uppercase tracking-wide text-faint">
          {kind === "coach" ? DRAFT_UI.noCoach : DRAFT_UI.noSub}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-faint">{DRAFT_UI.notFielded}</p>
        <div className="mt-1.5 h-[18px]" />
      </div>
    </div>
  );
}
