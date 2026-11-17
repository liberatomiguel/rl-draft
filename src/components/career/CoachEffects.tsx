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
    { key: "rating", text: C.market.coachRating(fx.ratingMod), tone: fx.ratingMod > 0 ? "text-blue-bright" : "text-sub" },
  ];
  return (
    <ul className={cx("space-y-0.5 text-xs leading-snug", className)} aria-label={C.market.coachEffects}>
      {!compact ? <li className="kicker mb-1">{C.market.coachEffects}</li> : null}
      {rows.map((r) => (
        <li key={r.key} className={r.tone}>
          {r.text}
        </li>
      ))}
    </ul>
  );
}
