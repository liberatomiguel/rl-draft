"use client";

/**
 * rc9 DRAFT-UI (#280): the team overall's parts, one list for the Review and
 * the Results so the two screens read the same. The rows come from
 * `overallBreakdown` and add up to the number shown next to them (players'
 * average, the bonuses, then the curve, the 99 cap and the rounding when they
 * are not zero). The curve gets its one sentence here and nowhere else.
 */

import { useCopy } from "@/content/copy";
import { overallBreakdown, type OverallPartKey } from "@/engine/overallBreakdown";
import type { TeamRatingBreakdown } from "@/engine/types";
import { cx } from "@/lib/util";

const SIGN_PLUS = "+";
const SIGN_MINUS = "−";

function signed(v: number): string {
  if (v === 0) return "0.0";
  return `${v > 0 ? SIGN_PLUS : SIGN_MINUS}${Math.abs(v).toFixed(1)}`;
}

export function OverallParts({
  rating,
  quick,
  className,
}: {
  rating: TeamRatingBreakdown;
  quick: boolean;
  className?: string;
}) {
  const { REVIEW } = useCopy();
  const b = overallBreakdown(rating, { quick });
  const labels: Record<OverallPartKey, string> = {
    players: REVIEW.rowPlayers,
    coach: REVIEW.rowCoach,
    sub: REVIEW.rowSub,
    org: REVIEW.rowOrg,
    chemistry: REVIEW.rowChemistry,
    specials: REVIEW.rowSpecials,
    curve: REVIEW.rowCurve,
    cap: REVIEW.rowCap,
    rounding: REVIEW.rowRounding,
  };
  return (
    <dl className={cx("text-sm text-sub", className)}>
      {b.parts.map((p) => (
        <div key={p.key} className="border-b border-line py-1.5 last:border-b-0">
          <div className="flex items-baseline justify-between gap-3">
            <dt>{labels[p.key]}</dt>
            <dd
              className={cx(
                "display font-semibold tabular-nums",
                p.key === "players" ? "text-ink" : p.value < 0 ? "text-bad" : "text-ink",
              )}
            >
              {p.key === "players" ? p.value.toFixed(1) : signed(p.value)}
            </dd>
          </div>
          {p.key === "curve" ? (
            <p className="mt-0.5 text-xs leading-snug text-faint">{REVIEW.curveNote(b.pivot, b.slopePercent)}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
