"use client";

/**
 * Friend duel (v2.1): the runs of a link as hairline rows, best first —
 * place, run label, placement, then the score line (Swiss record, games won,
 * team overall). `youIndex` marks the player's own run.
 */

import { useCopy } from "@/content/copy";
import { duelStandings, type DuelEntry, type DuelMode } from "@/engine/duel";
import type { Placement } from "@/engine/types";
import { cx } from "@/lib/util";

export function usePlacementLabel(): (p: Placement) => string {
  const { RESULTS_UI: R } = useCopy();
  const labels: Record<Placement, string> = {
    champion: R.champion,
    runner_up: R.runnerUp,
    third: R.third,
    fourth: R.fourth,
    top4: R.top4,
    top6: R.top6,
    top8: R.top8,
    swiss_exit: R.swissExit,
  };
  return (p) => labels[p] ?? p;
}

export function DuelStandings({
  entries,
  mode,
  youIndex,
}: {
  entries: readonly DuelEntry[];
  mode: DuelMode;
  /** Index in `entries` of the player's own run (none on the intro). */
  youIndex?: number;
}) {
  const { DUEL_UI: D } = useCopy();
  const placementLabel = usePlacementLabel();
  const rows = duelStandings(entries);
  return (
    <ol className="divide-y divide-line border-y border-line" aria-label={D.standingsTitle}>
      {rows.map(({ entry, index, rank }) => {
        const you = index === youIndex;
        return (
          <li
            key={index}
            className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5", you && "bg-orange/[0.07]")}
            aria-current={you ? "true" : undefined}
          >
            <span
              className={cx(
                "display w-6 shrink-0 text-center text-lg font-bold leading-none",
                rank === 1 ? "text-orange-bright" : "text-faint",
              )}
            >
              {rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx("truncate text-sm font-semibold", you ? "text-ink" : "text-sub")}>
                {you ? D.you : D.runLabel(index + 1)}
              </p>
              <p className="display break-words text-base font-bold uppercase leading-tight text-ink">
                {placementLabel(entry.placement)}
              </p>
            </div>
            {/* Phones: the score line under the name, so the placement never truncates. */}
            <dl className="flex w-full shrink-0 gap-4 pl-9 text-xs text-sub sm:w-auto sm:gap-3 sm:pl-0 sm:text-right">
              {mode !== "quick" ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-faint">{D.colSwiss}</dt>
                  <dd className="display font-bold text-ink">
                    {entry.swissWins}-{entry.swissLosses}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-faint">{D.colGames}</dt>
                <dd className="display font-bold text-ink">{entry.gameWins}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-faint">{D.colOvr}</dt>
                <dd className="display font-bold text-ink">{entry.teamOverall}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ol>
  );
}
