"use client";

/**
 * rc9 HQ (#244): the season's player statistics on HQ. Miguel on rc.8: "as
 * estatísticas de player ficaram legais, mas precisam aparecer melhor ... no
 * HQ também devemos ver as estatísticas." The same numbers as the Squad
 * screen's season stats (save.boxStats, folded from the box scores of the
 * user's series), compact: the season's best rating is the board's figure,
 * then one row per player who played, best first. The whole table is on
 * Squad; this board links there.
 *
 * States: with FEATURES.matchdayBoxScore off nothing is recorded, so nothing
 * renders (an empty board that can never fill would mislead). On, with no
 * series played yet, it says so and what fills it.
 */

import { FEATURES } from "@/config/balance";
import type { CareerCopy } from "@/content/careerCopy";
import { avgRatingOf } from "@/engine/career/boxScore";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { AppLink } from "@/components/ui/AppLink";
import { BLOCK_LINK } from "@/components/career/hub/hubShared";

/** Rows on HQ; the rest is on Squad. */
const HQ_ROWS = 4;

export function HubPlayerStats({ save, C, className }: { save: CareerSave; C: CareerCopy; className?: string }) {
  if (!FEATURES.matchdayBoxScore) return null;
  const B = C.boxScore;
  const season = save.boxStats?.find((s) => s.seasonIndex === save.clock.seasonIndex);
  const rows = season
    ? Object.entries(season.players)
        .filter(([, line]) => line.games > 0)
        .map(([key, line]) => ({ key, name: save.squad.find((p) => p.id === key)?.name ?? key, line, avg: avgRatingOf(line) }))
        .sort((a, b) => b.avg - a.avg || b.line.games - a.line.games)
    : [];
  const best = rows[0] ?? null;
  const shown = rows.slice(0, HQ_ROWS);

  return (
    <section className={cx("panel p-4 sm:p-5", className)} aria-labelledby="hq-stats-title">
      <div className="card-head">
        <h3 id="hq-stats-title" className="card-title">{B.seasonTitle}</h3>
        <AppLink href="/career/squad" className={cx(BLOCK_LINK, "inline-flex min-h-11 items-center")}>
          {C.hub.statsAll}
        </AppLink>
      </div>
      {!best ? (
        <div>
          <p className="text-sm text-ink">{B.seasonEmpty}</p>
          <p className="mt-1 text-xs text-sub">{C.hub.statsEmptyHint}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
          {/* The board's one figure: the best average rating, and whose it is. */}
          <div className="shrink-0 sm:w-32">
            <p className="display text-[2rem] font-bold leading-none tabular-nums text-ink">{best.avg.toFixed(1)}</p>
            <p className="kicker mt-1.5">{C.hub.statsBest}</p>
            <p className="mt-0.5 truncate text-sm text-sub">{best.name}</p>
          </div>
          <table className="w-full min-w-0 table-fixed text-sm">
            <thead>
              <tr>
                <th scope="col" className="kicker w-[40%] pb-2 text-left">{B.player}</th>
                <th scope="col" className="kicker pb-2 text-right">{B.games}</th>
                <th scope="col" className="kicker pb-2 text-right">{B.goals}</th>
                <th scope="col" className="kicker pb-2 text-right max-[359px]:hidden">{B.assists}</th>
                <th scope="col" className="kicker pb-2 text-right max-[359px]:hidden">{B.saves}</th>
                <th scope="col" className="kicker pb-2 text-right">{B.rating}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ key, name, line, avg }) => (
                <tr key={key} className="border-t border-line">
                  <td className="truncate py-2 pr-2 text-ink">{name}</td>
                  <td className="py-2 text-right tabular-nums text-faint">{line.games}</td>
                  <td className="py-2 text-right tabular-nums text-sub">{line.goals}</td>
                  <td className="py-2 text-right tabular-nums text-sub max-[359px]:hidden">{line.assists}</td>
                  <td className="py-2 text-right tabular-nums text-sub max-[359px]:hidden">{line.saves}</td>
                  <td className="display py-2 text-right text-[15px] font-bold tabular-nums text-ink">{avg.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
