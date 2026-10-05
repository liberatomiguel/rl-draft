"use client";

/**
 * Road to Worlds — the career player card tile.
 *
 * Token-built (NOT GameCard, which is dataset-coupled): a compact broadcast
 * card with a rarity-like border keyed off overall, OVR block, AGE · POT band,
 * archetype tag + flag, and an optional footer (wage / contract). Used by the
 * squad, training and market screens.
 */

import { cx } from "@/lib/util";
import { useCareerCopy } from "@/content/careerCopy";
import { CountryChip } from "@/components/ui/Badge";
import type { PotentialBand } from "@/engine/career/types";
import type { ArchetypeId } from "@/engine/career/types";

/** Rarity-like frame keyed off overall: 90+ cyan glow · 80+ amber · base. */
function ovrFrame(overall: number): {
  border: string;
  ovr: string;
  glow?: string;
  wash?: string;
} {
  if (overall >= 90)
    return {
      border: "border-blue/60",
      ovr: "text-cyan",
      glow: "shadow-[0_0_20px_-6px_rgba(59,130,246,0.6)]",
      wash: "from-blue/[0.08]",
    };
  if (overall >= 80)
    return {
      border: "border-amber-400/50",
      ovr: "text-amber-300",
      glow: "shadow-[0_0_16px_-9px_rgba(251,191,36,0.5)]",
      wash: "from-amber-400/[0.05]",
    };
  return { border: "border-line-strong", ovr: "text-ink" };
}

export function PlayerCardTile({
  name,
  overall,
  age,
  band,
  archetype,
  country,
  region,
  size = "md",
  footer,
  selected,
  disabled,
  onClick,
  className,
}: {
  name: string;
  overall: number;
  age?: number;
  band?: PotentialBand;
  archetype?: ArchetypeId;
  country?: string;
  region?: string;
  size?: "sm" | "md";
  footer?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const C = useCareerCopy();
  const frame = ovrFrame(overall);
  const potText =
    band && band.min === band.max ? C.player.potExact(band.max) : band ? C.player.potBand(band.min, band.max) : null;
  const Wrapper: React.ElementType = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "group relative flex w-full flex-col rounded-xl border bg-gradient-to-b to-transparent text-left transition-all",
        frame.wash ?? "from-white/[0.04]",
        frame.border,
        frame.glow,
        size === "sm" ? "p-2.5" : "p-3.5",
        onClick &&
          !disabled &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-orange/60 hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60",
        selected &&
          "!border-orange bg-orange/[0.04] ring-1 ring-orange/40 shadow-[0_0_18px_-8px_rgba(249,115,22,0.5)]",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={cx("display truncate font-bold text-ink", size === "sm" ? "text-sm" : "text-base")}>
            {name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
            {country ? <CountryChip code={country} /> : region ? <span>{region}</span> : null}
            {age !== undefined ? <span>· {C.player.age(age)}</span> : null}
          </div>
        </div>
        <div className="shrink-0 text-right leading-none">
          <div className={cx("display font-bold", frame.ovr, size === "sm" ? "text-xl" : "text-2xl")}>
            {Math.round(overall)}
          </div>
          <div className="kicker text-[9px] text-faint">{C.common.ovr}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {potText ? (
          <span className="rounded bg-blue/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan">
            {potText}
          </span>
        ) : null}
        {archetype ? (
          <span className="rounded bg-white/6 px-1.5 py-0.5 text-[10px] font-semibold text-sub">
            {C.player.archetype[archetype]}
          </span>
        ) : null}
      </div>

      {footer ? <div className="mt-2 border-t border-line/60 pt-2 text-xs text-sub">{footer}</div> : null}
    </Wrapper>
  );
}
