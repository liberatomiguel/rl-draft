"use client";

/**
 * GameCard — renders any card kind (player / coach / sub / org) in any state:
 * draft offer, team review, results reveal and collection.
 *
 * Rarity → frame (base doc §10):
 *   silver (≤79) · gold (80-89) · blue (90+) · hidden ("??" black) · special tiers.
 * With overalls hidden, base cards render as black "??" cards; special cards
 * keep their frame but hide the number (base doc §11).
 */

import { RARITY_LABELS, SPECIAL_TYPE_LABELS, STAT_LABELS } from "@/content/copy";
import type { ResolvedCard } from "@/engine/cards";
import { cx, initials } from "@/lib/util";
import { Badge, CountryChip } from "@/components/ui/Badge";

export interface GameCardProps {
  card: ResolvedCard;
  /** Run-level visibility. Org cards have no overall at all. */
  showOverall: boolean;
  /** Collection state — uncollected specials show "??" instead of rarity. */
  specialCollected?: boolean;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  /** Pickable, but will occupy the substitute slot. */
  asSubHint?: string;
  onClick?: () => void;
  className?: string;
}

const ROLE_LABEL: Record<ResolvedCard["kind"], string> = {
  player: "Player",
  coach: "Coach",
  sub: "Sub",
  org: "Org",
};

const AVATAR_GRADIENT: Record<string, string> = {
  silver: "from-slate-400/50 to-slate-600/40",
  gold: "from-amber-300/55 to-amber-700/40",
  blue: "from-sky-300/60 to-blue-700/45",
  hidden: "from-slate-700/60 to-slate-900/60",
  rare: "from-indigo-300/60 to-indigo-700/45",
  epic: "from-purple-300/60 to-purple-800/45",
  mythic: "from-rose-300/60 to-orange-600/45",
  legendary: "from-amber-200/70 to-orange-600/50",
};

function frameClass(card: ResolvedCard, showOverall: boolean): { frame: string; avatar: string } {
  if (card.special) {
    const r = card.special.rarity;
    return { frame: `card-${r} card-special`, avatar: AVATAR_GRADIENT[r] };
  }
  if (!showOverall && card.kind !== "org") {
    return { frame: "card-hidden", avatar: AVATAR_GRADIENT.hidden };
  }
  const rarity = card.baseRarity ?? "silver";
  return { frame: `card-${rarity}`, avatar: AVATAR_GRADIENT[rarity] };
}

export function GameCard({
  card,
  showOverall,
  specialCollected = true,
  size = "md",
  selected,
  disabled,
  disabledLabel,
  asSubHint,
  onClick,
  className,
}: GameCardProps) {
  const { frame, avatar } = frameClass(card, showOverall);
  const isOrg = card.kind === "org";
  const overallText = isOrg ? null : showOverall ? String(card.overall) : "??";

  const sizeClasses =
    size === "lg"
      ? "w-44 md:w-48 p-3.5"
      : size === "sm"
        ? "w-32 p-2.5"
        : "w-36 md:w-40 p-3";

  const interactive = Boolean(onClick) && !disabled;

  const body = (
    <div
      className={cx(
        "card-frame flex aspect-[3/4.3] flex-col text-left transition-all duration-200",
        frame,
        sizeClasses,
        interactive && "cursor-pointer hover:-translate-y-1.5 hover:brightness-110",
        selected && "-translate-y-1.5 ring-2 ring-orange shadow-[0_0_30px_rgba(249,115,22,0.4)]",
        disabled && "opacity-40 saturate-50",
        className,
      )}
    >
      {/* Top row: overall + role */}
      <div className="flex items-start justify-between">
        <div className="leading-none">
          {overallText ? (
            <span
              className={cx(
                "display block font-bold leading-none",
                size === "sm" ? "text-2xl" : "text-3xl",
                showOverall && (card.overall ?? 0) >= 90 && !card.special && "text-cyan",
                card.special && "text-orange-bright",
                !showOverall && !card.special && "text-faint",
              )}
            >
              {overallText}
            </span>
          ) : (
            <span className="display block text-2xl font-bold leading-none text-orange-bright">
              {card.buffLevel}
            </span>
          )}
          <span className="kicker mt-1 block !text-[9px]">{ROLE_LABEL[card.kind]}</span>
        </div>
        {card.country ? <CountryChip code={card.country} /> : isOrg && card.region ? (
          <CountryChip code={card.region} />
        ) : null}
      </div>

      {/* Avatar */}
      <div className="flex flex-1 items-center justify-center py-1">
        <div
          className={cx(
            "flex items-center justify-center bg-gradient-to-br",
            "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]",
            size === "sm" ? "h-14 w-14" : "h-[72px] w-[72px]",
          )}
        >
          <span className={cx("flex h-full w-full items-center justify-center bg-gradient-to-br", avatar)}>
            <span className="display text-xl font-bold text-white/85">
              {!showOverall && !card.special && card.kind !== "org" ? "?" : initials(card.name)}
            </span>
          </span>
        </div>
      </div>

      {/* Name + meta */}
      <div className="min-h-0">
        <p className={cx("display truncate font-bold uppercase tracking-wide text-ink", size === "sm" ? "text-xs" : "text-sm")}>
          {card.name}
        </p>
        {card.special ? (
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-orange-bright">
            {card.special.title}
          </p>
        ) : null}
        <p className="mt-0.5 truncate text-[10px] text-sub">
          {isOrg
            ? `${STAT_LABELS[card.buffType ?? ""] ?? ""} ${card.buffLevel ?? ""}`.trim()
            : [card.orgName, card.seasonShort].filter(Boolean).join(" · ")}
        </p>

        {/* Bottom tag line */}
        <div className="mt-1.5 flex items-center justify-between gap-1">
          {card.special ? (
            <Badge tone={specialCollected ? "gold" : "neutral"} className="!text-[9px]">
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
              {showOverall || isOrg ? RARITY_LABELS[card.baseRarity ?? ""] ?? "" : "Hidden"}
            </span>
          )}
        </div>
      </div>

      {/* Disabled overlay */}
      {disabled && disabledLabel ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[13px] bg-black/55">
          <span className="display rotate-[-8deg] rounded border border-line-strong bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sub">
            {disabledLabel}
          </span>
        </div>
      ) : null}

      {/* As-sub hint */}
      {!disabled && asSubHint ? (
        <div className="absolute left-1/2 top-11 z-10 w-max -translate-x-1/2">
          <Badge tone="blue" className="!text-[9px] shadow-lg">
            {asSubHint}
          </Badge>
        </div>
      ) : null}
    </div>
  );

  if (onClick && !disabled) {
    return (
      <button type="button" onClick={onClick} className="relative block focus-visible:outline-orange" aria-pressed={selected}>
        {body}
      </button>
    );
  }
  return <div className="relative">{body}</div>;
}
