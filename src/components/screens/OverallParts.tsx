"use client";

/**
 * rc9 DRAFT-UI (#280): the team overall's parts, one list for the Review and
 * the Results so the two screens read the same. The rows come from
 * `overallBreakdown` and add up to the number shown next to them (players'
 * average, the bonuses, then the curve, the 99 cap and the rounding when they
 * are not zero). The curve gets its one sentence here and nowhere else.
 *
 * Each row is seen as well as read: the players' average is a bar out of 99,
 * every adjustment a small bar from a centre line (green to the right for a
 * gain, red to the left for a cost) with its signed figure in a chip.
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
  // One scale for every adjustment on this team, so the bars compare.
  const reach = Math.max(3, ...b.parts.filter((p) => p.key !== "players").map((p) => Math.abs(p.value)));
  return (
    <dl className={cx("text-sm text-sub", className)}>
      {b.parts.map((p) => {
        const isBase = p.key === "players";
        const tone = p.value > 0 ? "good" : p.value < 0 ? "bad" : "faint";
        const pct = isBase ? Math.min(100, (p.value / 99) * 100) : Math.min(50, (Math.abs(p.value) / reach) * 50);
        return (
          <div key={p.key} className="border-b border-line py-2 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <dt className={cx("min-w-0 flex-1 truncate", isBase && "text-ink")}>{labels[p.key]}</dt>
              <div
                className="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-sm bg-white/[0.06] sm:w-24"
                aria-hidden="true"
              >
                {isBase ? (
                  <span className="absolute inset-y-0 left-0 rounded-sm bg-blue-bright" style={{ width: `${pct}%` }} />
                ) : (
                  <>
                    <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                    {p.value !== 0 ? (
                      <span
                        className={cx("absolute inset-y-0", p.value > 0 ? "left-1/2 bg-good" : "right-1/2 bg-bad")}
                        style={{ width: `${pct}%` }}
                      />
                    ) : null}
                  </>
                )}
              </div>
              <dd
                className={cx(
                  "display min-w-[3.25rem] shrink-0 rounded-[3px] px-1.5 py-0.5 text-right text-[15px] font-semibold tabular-nums",
                  isBase && "text-ink",
                  !isBase && tone === "good" && "bg-good/10 text-good",
                  !isBase && tone === "bad" && "bg-bad/10 text-bad",
                  !isBase && tone === "faint" && "text-faint",
                )}
              >
                {isBase ? p.value.toFixed(1) : signed(p.value)}
              </dd>
            </div>
            {p.key === "curve" ? (
              <p className="mt-1 text-xs leading-snug text-faint">{REVIEW.curveNote(b.pivot, b.slopePercent)}</p>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
