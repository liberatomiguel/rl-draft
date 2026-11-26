"use client";

/**
 * v2.2 Pro spine (PROSPINE): the match report. His team's series of one
 * event, revealed game by game (the score, then his line: goals, assists,
 * saves and his 0-10 rating from the box score). The games are already
 * played; the reveal is the watching.
 */

import { useCareerCopy } from "@/content/careerCopy";
import type { ProSave } from "@/engine/career/pro/types";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { dismissProReportFlow, revealProGameFlow, revealProReportFlow } from "@/store/proFlow";
import { useProStore } from "@/store/proStore";

export function ProReport({ save }: { save: ProSave }) {
  const C = useCareerCopy();
  const R = C.proWorld.report;
  const apply = useProStore((s) => s.apply);
  const r = save.report;
  if (!r) return null;
  const total = r.series.reduce((n, s) => n + s.games.length, 0);
  const done = r.revealed >= total;
  const starts = r.series.map((_, i) => r.series.slice(0, i).reduce((n, s) => n + s.games.length, 0));
  const played = r.series.filter((s) => s.rating !== null);
  const avg = played.length ? (played.reduce((a, s) => a + (s.rating ?? 0), 0) / played.length).toFixed(1) : null;

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="kicker">{R.title}</p>
          <h3 className="display mt-1 text-lg font-bold uppercase leading-none text-ink">{r.eventName}</h3>
          <p className="mt-1 text-xs text-sub">{r.teamName}</p>
        </div>
        {done && r.placement ? <span className="text-sm font-semibold text-ink">{R.placement[r.placement]}</span> : null}
      </div>

      {r.benched ? <p className="mt-3 text-sm text-sub">{R.benched}</p> : null}

      <ol className="mt-4 space-y-4">
        {r.series.map((s, si) => {
          const start = starts[si];
          const visible = Math.max(0, Math.min(s.games.length, r.revealed - start));
          const finished = visible === s.games.length;
          return (
            <li key={s.roundKey} className="border-t border-line pt-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-ink">{R.series(s.opponent)}</span>
                {finished ? (
                  <span className={s.won ? "font-semibold text-good" : "font-semibold text-bad"}>
                    {s.won ? R.won : R.lost} {s.score[0]}-{s.score[1]}
                  </span>
                ) : (
                  <span className="text-xs text-faint">{visible === 0 ? R.hidden : `${s.games.slice(0, visible).filter((g) => g.us > g.them).length}-${s.games.slice(0, visible).filter((g) => g.us < g.them).length}`}</span>
                )}
              </div>
              {visible > 0 ? (
                <ul className="mt-2 space-y-1">
                  {s.games.slice(0, visible).map((g, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 text-xs">
                      <span className="text-sub">
                        {R.game(i + 1)}: <span className={g.us > g.them ? "text-good" : "text-bad"}>{g.us}-{g.them}</span>
                        {g.overtime ? ` ${R.ot}` : ""}
                      </span>
                      {g.pro ? (
                        <span className="text-ink">
                          {R.line(g.pro.goals, g.pro.assists, g.pro.saves)} · {R.rating} <span className="font-semibold">{g.pro.rating.toFixed(1)}</span>
                          {g.pro.mvp ? <span className="ml-1 font-semibold text-orange">{R.mvp}</span> : null}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>

      {done && avg ? <p className="mt-4 text-sm font-semibold text-ink">{R.avg(avg)}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!done ? (
          <>
            <Button variant="primary" onClick={() => apply(revealProGameFlow)}>
              {R.nextGame}
            </Button>
            <Button variant="secondary" onClick={() => apply(revealProReportFlow)}>
              {R.showAll}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => apply(dismissProReportFlow)}>
            {R.close}
          </Button>
        )}
      </div>
    </Panel>
  );
}
