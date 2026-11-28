"use client";

/**
 * rc9 MATCHDAY (STORIES, DESIGN-DECISIONS #237): your players' numbers on the
 * Event screen, always there. "This event" adds up every series of yours the
 * screen has shown; "Last series" is the latest one. Before the first series
 * it says when the numbers come. Built from the box scores of the series on
 * screen (spoiler-safe: a series still playing is not counted).
 */

import { useMemo, useState } from "react";
import { FEATURES } from "@/config/balance";
import { useCareerCopy } from "@/content/careerCopy";
import { buildSeriesBoxScore } from "@/engine/career/boxScore";
import type { TournamentState } from "@/engine/types";
import { cx } from "@/lib/util";
import { Panel } from "@/components/ui/Panel";
import { seriesKey, type RoundRef } from "./eventPlayback";

interface Row {
  name: string;
  games: number;
  goals: number;
  assists: number;
  saves: number;
  ratingSum: number;
}

export function EventStatsCard({ t, rounds, revealed }: { t: TournamentState; rounds: RoundRef[]; revealed: Set<string> }) {
  const C = useCareerCopy();
  const E = C.eventStats;
  const B = C.boxScore;
  const [view, setView] = useState<"event" | "last">("event");

  const { event, last } = useMemo(() => {
    const total = new Map<string, Row>();
    let lastRows: Row[] = [];
    for (const round of rounds) {
      const si = round.userSeriesIndex;
      if (si === null || !revealed.has(seriesKey(round, si))) continue;
      const series = round.series[si];
      const side = series.teamAId === "user" ? "a" : "b";
      const team = t.teams.user;
      const box = buildSeriesBoxScore(series, round.key, { a: t.teams[series.teamAId], b: t.teams[series.teamBId] });
      const rows: Row[] = box.totals[side].map((l, i) => ({
        name: team?.playerNames[i] ?? "",
        games: l.games,
        goals: l.goals,
        assists: l.assists,
        saves: l.saves,
        ratingSum: l.avgRating * l.games,
      }));
      for (const r of rows) {
        const cur = total.get(r.name) ?? { name: r.name, games: 0, goals: 0, assists: 0, saves: 0, ratingSum: 0 };
        total.set(r.name, {
          name: r.name,
          games: cur.games + r.games,
          goals: cur.goals + r.goals,
          assists: cur.assists + r.assists,
          saves: cur.saves + r.saves,
          ratingSum: cur.ratingSum + r.ratingSum,
        });
      }
      lastRows = rows;
    }
    return { event: [...total.values()], last: lastRows };
  }, [t, rounds, revealed]);

  if (!FEATURES.matchdayBoxScore) return null;
  const rows = view === "event" ? event : last;

  return (
    <Panel className="p-5" aria-labelledby="event-stats-title">
      <div className="card-head">
        <h2 id="event-stats-title" className="card-title">{E.title}</h2>
      </div>
      {event.length === 0 ? (
        <p className="text-sm text-sub">{E.empty}</p>
      ) : (
        <>
          <div className="-mt-1 mb-3 flex gap-4" role="group" aria-label={E.title}>
            {(["event", "last"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cx(
                  "display min-h-11 border-b-2 text-sm font-semibold transition-colors sm:min-h-9",
                  view === v ? "border-orange text-ink" : "border-transparent text-sub hover:text-ink",
                )}
              >
                {E[v]}
              </button>
            ))}
          </div>
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="kicker">
                <th scope="col" className="w-[44%] pb-1 text-left font-medium">{B.player}</th>
                <th scope="col" className="pb-1 text-right font-medium">{B.goals}</th>
                <th scope="col" className="pb-1 text-right font-medium">{B.assists}</th>
                <th scope="col" className="pb-1 text-right font-medium">{B.saves}</th>
                <th scope="col" className="pb-1 text-right font-medium">{B.rating}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-line">
                  <td className="py-2 pr-2">
                    <span className="display block truncate text-[15px] font-semibold text-ink">{r.name}</span>
                    <span className="block text-xs text-faint">{B.gamesPlayed(r.games)}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink">{r.goals}</td>
                  <td className="py-2 text-right tabular-nums text-sub">{r.assists}</td>
                  <td className="py-2 text-right tabular-nums text-sub">{r.saves}</td>
                  <td className="display py-2 text-right font-semibold tabular-nums text-ink">
                    {(r.games > 0 ? r.ratingSum / r.games : 0).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}
