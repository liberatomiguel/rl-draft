"use client";

/**
 * Road to Worlds — a player's phase on his arc as an icon chip (rc.35, front
 * C): developing / at his peak / declining, or "?" until a report reveals it
 * (DEV-04, `phaseTagFor`). Read by the Market tiles and HQ's squad cards.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { cx } from "@/lib/util";
import { PeakIcon, QuestionIcon, TrendDownIcon, TrendUpIcon } from "@/components/ui/icons";
import type { PhaseLabel } from "@/components/career/careerUi";

const PHASE_STYLE: Record<PhaseLabel, { cls: string; Icon: typeof PeakIcon }> = {
  growing: { cls: "border-good/40 bg-good/10 text-good", Icon: TrendUpIcon },
  prime: { cls: "border-amber-400/40 bg-amber-400/10 text-amber-300", Icon: PeakIcon },
  declining: { cls: "border-orange/40 bg-orange/10 text-orange-bright", Icon: TrendDownIcon },
  unknown: { cls: "border-line-strong bg-white/5 text-faint", Icon: QuestionIcon },
};

export function PhaseChip({ phase, className }: { phase: PhaseLabel; className?: string }) {
  const C = useCareerCopy();
  const { cls, Icon } = PHASE_STYLE[phase];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em]",
        cls,
        className,
      )}
      title={phase === "unknown" ? C.player.phaseUnknownHint : undefined}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{C.player.phase[phase]}</span>
    </span>
  );
}
