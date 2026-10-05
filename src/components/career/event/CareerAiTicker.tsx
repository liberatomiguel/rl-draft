"use client";

/**
 * Road to Worlds — "around the bracket" AI-series ticker (v0.2 rebuild).
 *
 * The rest of the field stays alive while your series gets the cinema: each
 * revealed AI series pops in as a compact row (round label, marks, score,
 * upset flag), newest first. Rows are tap-to-inspect in the Match Center.
 */

import { useCareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import type { SeriesResult, TournamentState } from "@/engine/types";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { Panel } from "@/components/ui/Panel";

export interface TickerItem {
  key: string;
  label: string;
  series: SeriesResult;
}

export function CareerAiTicker({
  save,
  t,
  items,
  onInspect,
}: {
  save: CareerSave;
  t: TournamentState;
  /** Revealed AI series, NEWEST FIRST (screen slices to taste). */
  items: TickerItem[];
  onInspect?: (key: string) => void;
}) {
  const C = useCareerCopy();
  if (items.length === 0) return null;

  return (
    <Panel className="p-4">
      <h3 className="display mb-2.5 text-sm font-bold uppercase tracking-[0.16em] text-ink">
        {C.event.aiTicker}
      </h3>
      <ul className="space-y-1">
        {items.map((item, i) => {
          const s = item.series;
          const aWon = s.winnerTeamId === s.teamAId;
          const row = (
            <>
              <span className="kicker w-[4.5rem] shrink-0 truncate !text-[8px] text-faint">
                {item.label}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <OrgMark save={save} orgRef={s.teamAId} size="xs" />
                <span
                  className={cx(
                    "min-w-0 flex-1 truncate text-right text-[11px]",
                    aWon ? "font-semibold text-ink" : "text-sub",
                  )}
                >
                  {t.teams[s.teamAId]?.name ?? s.teamAId}
                </span>
                <span className="display shrink-0 rounded bg-white/6 px-1.5 py-0.5 text-[11px] font-bold text-ink">
                  {s.score[0]}–{s.score[1]}
                </span>
                <span
                  className={cx(
                    "min-w-0 flex-1 truncate text-[11px]",
                    !aWon ? "font-semibold text-ink" : "text-sub",
                  )}
                >
                  {t.teams[s.teamBId]?.name ?? s.teamBId}
                </span>
                <OrgMark save={save} orgRef={s.teamBId} size="xs" />
              </span>
              {s.upset ? (
                <span className="display shrink-0 rounded bg-amber-400/15 px-1 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                  {C.event.upset}
                </span>
              ) : null}
            </>
          );
          const rowClass = cx(
            "flex w-full items-center gap-2 rounded-md border border-line bg-white/[0.02] px-2 py-1.5",
            i === 0 && "pop-in",
          );
          return (
            <li key={item.key}>
              {onInspect ? (
                <button
                  type="button"
                  onClick={() => onInspect(item.key)}
                  className={cx(rowClass, "transition-colors hover:bg-white/[0.05]")}
                >
                  {row}
                </button>
              ) : (
                <div className={rowClass}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
