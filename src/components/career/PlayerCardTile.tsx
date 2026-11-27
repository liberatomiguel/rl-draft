"use client";

/**
 * Road to Worlds — the career player card tile.
 *
 * Token-built (NOT GameCard, which is dataset-coupled): a compact tile in the
 * trading card's language (its stock, a hairline frame keyed off overall, no
 * glow): name, one line of who he is (flag, age, role), the overall as the
 * figure, the potential band and phase, and an optional footer (wage /
 * contract). Used by the squad, training and market screens.
 */

import { cx } from "@/lib/util";
import { baseRarityOf } from "@/engine/cards";
import { useCareerCopy } from "@/content/careerCopy";
import { CountryChip } from "@/components/ui/Badge";
import type { PotentialBand } from "@/engine/career/types";
import type { ArchetypeId } from "@/engine/career/types";
import { PhaseChip } from "@/components/career/PhaseChip";
import type { PhaseLabel } from "@/components/career/careerUi";

/** A rarity-like hairline keyed off overall (the card tiers: 90+ blue, 80+ gold, base grey). */
function ovrFrame(overall: number): { border: string; ovr: string } {
  if (overall >= 90) return { border: "border-blue/60", ovr: "text-blue-bright" };
  if (overall >= 80) return { border: "border-amber-400/50", ovr: "text-amber-300" };
  return { border: "border-line-strong", ovr: "text-ink" };
}

export function PlayerCardTile({
  name,
  overall,
  age,
  band,
  phase,
  archetype,
  country,
  region,
  size = "md",
  footer,
  selected,
  disabled,
  onClick,
  className,
  rarityFrame = false,
  layout = "stack",
  aside,
}: {
  name: string;
  overall: number;
  age?: number;
  band?: PotentialBand;
  /** rc.35 (front C): his phase on his arc as an icon chip ("?" until a report reveals it). */
  phase?: PhaseLabel;
  archetype?: ArchetypeId;
  country?: string;
  region?: string;
  size?: "sm" | "md";
  footer?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** Use the Draft's complete OVR rarity palette on the squad screen. */
  rarityFrame?: boolean;
  /** "row" lays the card on its side (the squad's bench and coach). */
  layout?: "stack" | "row";
  /** Row layout only: one tag on the right of the name. */
  aside?: React.ReactNode;
}) {
  const C = useCareerCopy();
  const frame = ovrFrame(overall);
  const potText =
    band && band.min === band.max ? C.player.potExact(band.max) : band ? C.player.potBand(band.min, band.max) : null;
  const Wrapper: React.ElementType = onClick ? "button" : "div";

  // rc9 (Miguel, 27/11): the horizontal card of the squad's bench and coach.
  // Same stock and frame as the tile, laid on its side: the figure, a hairline,
  // then the name with who he is under it; `aside` holds one tag on the right.
  if (layout === "row") {
    return (
      <Wrapper
        type={onClick ? "button" : undefined}
        onClick={onClick}
        disabled={disabled}
        className={cx(
          "group relative flex w-full items-center gap-3 p-3 text-left transition-[border-color,transform]",
          rarityFrame ? `card-frame card-${baseRarityOf(Math.round(overall))}` : cx("rounded-xl border bg-surface", frame.border),
          onClick && !disabled && "cursor-pointer hover:-translate-y-0.5 hover:!border-orange/60",
          selected && "!border-orange",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <div className="relative w-11 shrink-0 text-center leading-none">
          <div className={cx("display text-2xl font-bold tabular-nums", rarityFrame ? "text-ink" : frame.ovr)}>
            {Math.round(overall)}
          </div>
          <div className="display mt-1 text-[11px] font-semibold uppercase text-faint">{C.common.ovr}</div>
        </div>
        <span className="relative h-10 w-px shrink-0 bg-line" aria-hidden />
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="display truncate text-base font-bold leading-tight text-ink">{name}</span>
            {aside ? <span className="shrink-0">{aside}</span> : null}
          </div>
          {country || region || age !== undefined || archetype || potText ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-sub">
              {country ? <CountryChip code={country} /> : region ? <span>{region}</span> : null}
              {age !== undefined ? <span>{C.player.age(age)}</span> : null}
              {archetype ? (
                <>
                  {country || region || age !== undefined ? <span aria-hidden>·</span> : null}
                  <span>{C.player.archetype[archetype]}</span>
                </>
              ) : null}
              {potText ? <span className="display font-semibold text-blue-bright">{potText}</span> : null}
            </div>
          ) : null}
          {footer ? <div className="mt-1 text-xs text-sub">{footer}</div> : null}
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        // Cut from the trading card's stock: its body, a hairline frame, no
        // glow. State (hover, selected) only colours the hairline.
        "group relative flex w-full flex-col text-left transition-[border-color,transform]",
        rarityFrame ? `card-frame card-${baseRarityOf(Math.round(overall))}` : cx("rounded-xl border bg-surface", frame.border),
        size === "sm" ? "p-3" : "p-3 sm:p-4",
        onClick && !disabled && "cursor-pointer hover:-translate-y-0.5 hover:!border-orange/60",
        selected && "!border-orange",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cx("display truncate font-bold leading-tight text-ink", size === "sm" ? "text-base" : "text-lg")}>
            {name}
          </div>
          {/* Who he is, as one quiet line: flag, age, role. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-sub">
            {country ? <CountryChip code={country} /> : region ? <span>{region}</span> : null}
            {age !== undefined ? <span>{C.player.age(age)}</span> : null}
            {archetype ? (
              <>
                {country || region || age !== undefined ? <span aria-hidden>·</span> : null}
                <span>{C.player.archetype[archetype]}</span>
              </>
            ) : null}
          </div>
        </div>
        {/* The deciding figure: the overall, set as a number with its label under it. */}
        <div className="shrink-0 text-right leading-none">
          <div className={cx("display font-bold", rarityFrame ? "text-ink" : frame.ovr, size === "sm" ? "text-2xl" : "text-2xl sm:text-3xl")}>
            {Math.round(overall)}
          </div>
          <div className="display mt-1 text-[11px] font-semibold uppercase text-faint">{C.common.ovr}</div>
        </div>
      </div>

      {potText || phase ? (
        <div className="relative mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 sm:mt-2.5">
          {potText ? <span className="display text-xs font-semibold text-blue-bright">{potText}</span> : null}
          {phase ? <PhaseChip phase={phase} /> : null}
        </div>
      ) : null}

      {footer ? <div className="relative mt-2 border-t border-line pt-2 text-xs text-sub sm:mt-2.5 sm:pt-2.5">{footer}</div> : null}
    </Wrapper>
  );
}
