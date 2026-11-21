"use client";

/**
 * Road to Worlds v2.1 Matchday slice 5: the box score of a finished series in
 * the Match Center (R137 option B: no play-by-play, no live momentum bar).
 * A sheet per game and the series totals: goals, assists, saves, shots, score
 * and the 0-10 rating per player, the MVP, and the game's 2-4 key moments.
 *
 * Presentation only: buildSeriesBoxScore reads the persisted result on its
 * own seed, so this sheet always matches the score and the season stats.
 */

import { useMemo, useState } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { momentText } from "@/content/momentText";
import { buildSeriesBoxScore, type PlayerLine } from "@/engine/career/boxScore";
import type { SeriesResult, TournamentState } from "@/engine/types";
import { cx } from "@/lib/util";
import { Badge } from "@/components/ui/Badge";

type Side = "a" | "b";

export function SeriesBoxScoreView({
  t,
  roundKey,
  series,
  defaultOpen = false,
}: {
  t: TournamentState;
  roundKey: string;
  series: SeriesResult;
  defaultOpen?: boolean;
}) {
  const C = useCareerCopy();
  const B = C.boxScore;
  const teamA = t.teams[series.teamAId];
  const teamB = t.teams[series.teamBId];
  const box = useMemo(
    () => buildSeriesBoxScore(series, roundKey, { a: teamA, b: teamB }),
    [series, roundKey, teamA, teamB],
  );
  /** null = the series totals; a number = that game's sheet. */
  const [view, setView] = useState<number | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const game = view !== null ? box.games[view] : null;
  const mvp = game ? game.mvp : box.mvp;
  const names: Record<Side, string[]> = { a: teamA?.playerNames ?? [], b: teamB?.playerNames ?? [] };
  // A game's sheet: its own moments. The series: each game's first, at most four.
  const moments = game ? game.moments : box.games.flatMap((g) => g.moments.slice(0, 1)).slice(0, 4);

  return (
    <div className="mt-4 border-t border-line pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="display flex min-h-11 w-full items-center justify-between text-sm font-bold uppercase tracking-wide text-ink sm:min-h-9"
      >
        {B.title}
        <svg viewBox="0 0 24 24" className={cx("h-4 w-4 text-sub transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label={B.title}>
            <Tab selected={view === null} onClick={() => setView(null)}>
              {B.series}
            </Tab>
            {box.games.map((g, i) => (
              <Tab key={g.index} selected={view === i} onClick={() => setView(i)} label={B.gameLabel(g.index)}>
                {B.game(g.index)} · {g.final[0]}-{g.final[1]}
              </Tab>
            ))}
          </div>

          {(["a", "b"] as const).map((side) => {
            const lines: PlayerLine[] = game ? game.players[side] : box.totals[side];
            const team = side === "a" ? teamA : teamB;
            return (
              <table key={side} className="mt-3 w-full table-fixed text-xs">
                <caption className={cx("display mb-1 truncate text-left text-xs font-bold uppercase tracking-wide", team?.isUser ? "text-orange-bright" : "text-sub")}>
                  {team?.name ?? "?"}
                </caption>
                <thead className="text-faint">
                  <tr>
                    <th scope="col" className="w-[40%] py-1 text-left font-medium">{B.player}</th>
                    <th scope="col" className="py-1 text-right font-medium">{B.goals}</th>
                    <th scope="col" className="py-1 text-right font-medium">{B.assists}</th>
                    <th scope="col" className="py-1 text-right font-medium">{B.saves}</th>
                    <th scope="col" className="hidden py-1 text-right font-medium sm:table-cell">{B.shots}</th>
                    <th scope="col" className="hidden py-1 text-right font-medium sm:table-cell">{B.score}</th>
                    <th scope="col" className="py-1 text-right font-medium">{B.rating}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const isMvp = mvp?.side === side && mvp.playerIdx === i;
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="py-1.5 pr-1">
                          <span className="flex min-w-0 items-center gap-1">
                            <span className="truncate font-semibold text-ink">{names[side][i] ?? "?"}</span>
                            {isMvp ? <Badge tone="gold" className="!px-1 !py-0 !text-[9px]">{B.mvp}</Badge> : null}
                          </span>
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-ink">{l.goals}</td>
                        <td className="py-1.5 text-right tabular-nums text-sub">{l.assists}</td>
                        <td className="py-1.5 text-right tabular-nums text-sub">{l.saves}</td>
                        <td className="hidden py-1.5 text-right tabular-nums text-sub sm:table-cell">{l.shots}</td>
                        <td className="hidden py-1.5 text-right tabular-nums text-sub sm:table-cell">{l.score}</td>
                        <td className="display py-1.5 text-right text-sm font-bold tabular-nums text-ink">{l.rating.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })}

          {moments.length > 0 ? (
            <div className="mt-3">
              <p className="kicker mb-1">{B.moments}</p>
              <ul className="space-y-1">
                {moments.map((m, i) => (
                  <li key={i} className="flex gap-2 text-sm text-sub">
                    {game ? null : <span className="display shrink-0 text-xs font-bold text-faint">{B.game(m.gameIndex)}</span>}
                    <span>{momentText(C, m, m.playerIdx !== null ? names[m.side][m.playerIdx] : undefined)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-3 text-[11px] text-faint">{B.legend}</p>
        </div>
      ) : null}
    </div>
  );
}

function Tab({ selected, onClick, label, children }: { selected: boolean; onClick: () => void; label?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cx(
        "display min-h-11 rounded-md border px-2.5 text-[11px] font-semibold uppercase tracking-wide sm:min-h-8",
        selected ? "border-orange text-ink" : "border-line text-sub hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
