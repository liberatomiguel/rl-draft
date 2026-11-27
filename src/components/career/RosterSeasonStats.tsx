"use client";

/**
 * Road to Worlds v2.1 Matchday slice 5: the roster's season stats, folded
 * from the box scores of the user's official series (save.boxStats, written
 * when an event ends). The current season; players who left keep their line
 * under the name the box score knew.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { avgRatingOf } from "@/engine/career/boxScore";
import type { CareerSave } from "@/engine/career/types";
import { Panel } from "@/components/ui/Panel";

export function RosterSeasonStats({ save }: { save: CareerSave }) {
  const B = useCareerCopy().boxScore;
  const season = save.boxStats?.find((s) => s.seasonIndex === save.clock.seasonIndex);
  const rows = season
    ? Object.entries(season.players)
        .map(([key, line]) => ({ key, name: save.squad.find((p) => p.id === key)?.name ?? key, line, avg: avgRatingOf(line) }))
        .sort((a, b) => b.line.games - a.line.games || b.avg - a.avg)
    : [];

  return (
    <Panel className="p-4 sm:p-5">
      <div className="card-head">
        <h2 className="card-title">{B.seasonTitle}</h2>
      </div>
      {/* rc9 DS: no blurb under the title (it restated it); the legend under the table explains the columns. */}
      {rows.length === 0 ? (
        <p className="text-sm text-faint">{B.seasonEmpty}</p>
      ) : (
        <>
          {/* rc9 DS: on the Squad screen this board sits in the narrow right column from
              `lg`, so shots and score show only while it runs the full width (sm to md). */}
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr>
                <th scope="col" className="kicker w-[38%] pb-2 text-left">{B.player}</th>
                <th scope="col" className="kicker pb-2 text-right">{B.games}</th>
                <th scope="col" className="kicker pb-2 text-right">{B.goals}</th>
                <th scope="col" className="kicker pb-2 text-right">{B.assists}</th>
                <th scope="col" className="kicker pb-2 text-right">{B.saves}</th>
                <th scope="col" className="kicker hidden pb-2 text-right sm:table-cell lg:hidden">{B.shots}</th>
                <th scope="col" className="kicker hidden pb-2 text-right sm:table-cell lg:hidden">{B.score}</th>
                <th scope="col" className="kicker pb-2 text-right">{B.rating}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, name, line, avg }) => (
                <tr key={key} className="border-t border-line">
                  <td className="truncate py-2 pr-1 text-ink">{name}</td>
                  <td className="py-2 text-right tabular-nums text-sub">{line.games}</td>
                  <td className="py-2 text-right tabular-nums text-ink">{line.goals}</td>
                  <td className="py-2 text-right tabular-nums text-sub">{line.assists}</td>
                  <td className="py-2 text-right tabular-nums text-sub">{line.saves}</td>
                  <td className="hidden py-2 text-right tabular-nums text-sub sm:table-cell lg:hidden">{line.shots}</td>
                  <td className="hidden py-2 text-right tabular-nums text-sub sm:table-cell lg:hidden">{line.score}</td>
                  <td className="display py-2 text-right text-sm font-bold tabular-nums text-ink">{avg.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-faint">{B.legend}</p>
        </>
      )}
    </Panel>
  );
}
