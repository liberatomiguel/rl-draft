"use client";

/**
 * v2.0 (R22) — the coach's effects, spelled out. One component for the
 * market card, the current-coach panel and the squad's coach slot, all fed
 * by `coachEffectsFor` so the numbers can never drift between screens.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { coachEffectsFor } from "@/engine/career/development";
import type { CoachState } from "@/engine/career/types";
import { cx } from "@/lib/util";

export function CoachEffectLines({
  coach,
  className,
  compact,
}: {
  coach: Pick<CoachState, "overall" | "bonusType" | "bonusLevel">;
  className?: string;
  compact?: boolean;
}) {
  const C = useCareerCopy();
  const fx = coachEffectsFor(coach);
  // The stat buff ("Boosts Clutch +") is already on every coach card/slot;
  // these are the two numeric effects players could not see before.
  const rows = [
    { key: "train", text: C.market.coachTraining(fx.trainingPct), tone: fx.trainingPct > 0 ? "text-good" : "text-sub" },
    { key: "rating", text: C.market.coachRating(fx.ratingMod), tone: fx.ratingMod > 0 ? "text-ink" : "text-sub" },
  ];
  // rc9 TRAIN-MARKET: a gain in training is green (a gain, against what it was); the rating line is
  // a plain value in ink; the label is the faint kicker. No blue: blue is for links.
  return (
    <ul className={cx("space-y-1 text-[13px] leading-snug", className)} aria-label={C.market.coachEffects}>
      {!compact ? <li className="kicker mb-1.5">{C.market.coachEffects}</li> : null}
      {rows.map((r) => (
        <li key={r.key} className={r.tone}>
          {r.text}
        </li>
      ))}
    </ul>
  );
}
