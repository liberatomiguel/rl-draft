"use client";

/**
 * v2.2 Pro spine round 2 (PROSPINE): the series he is playing. The games so
 * far with his line, the last call and how it went, then the next game's
 * decision (the slice 5 card) or a plain "play the game" when the game has no
 * key moment. Sim the series or the event: every call on instinct.
 */

import { useCareerCopy } from "@/content/careerCopy";
import type { ProSave } from "@/engine/career/pro/types";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { decideProGameFlow, simProEventFlow, simProSeriesFlow } from "@/store/proMatch";
import { useProStore } from "@/store/proStore";
import { ProDecisionCard } from "../ProDecisionCard";

export function ProLive({ save, eventName }: { save: ProSave; eventName: string }) {
  const C = useCareerCopy();
  const L = C.proWorld.live;
  const R = C.proWorld.report;
  const apply = useProStore((s) => s.apply);
  const live = save.live;
  if (!live) return null;
  const wins = live.games.filter((g) => g.us > g.them).length;
  const losses = live.games.length - wins;
  const callName = live.last ? (C.proMoments.calls[live.last.optionId] ?? live.last.optionId) : "";

  return (
    <div className="space-y-4">
      <Panel className="p-4 sm:p-5">
        <p className="kicker">{eventName}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h3 className="display text-lg font-bold uppercase leading-none text-ink">{R.series(live.opponent)}</h3>
          <span className="display text-xl font-bold text-ink">
            {wins}-{losses}
          </span>
        </div>
        {live.games.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {live.games.map((g, i) => (
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
        {live.last ? (
          <p className={`mt-3 text-sm ${live.last.success ? "text-good" : "text-bad"}`}>
            {live.last.instinct ? L.instinctCall(callName, live.last.success) : L.yourCall(callName, live.last.success)}
          </p>
        ) : null}
      </Panel>

      {live.decision ? (
        <ProDecisionCard decision={live.decision} onChoose={(choice) => apply((s) => decideProGameFlow(s, choice))} hideInstinct />
      ) : null}

      <div className="action-dock flex gap-2">
        {live.decision ? (
          <Button variant="secondary" className="max-sm:flex-1" onClick={() => apply((s) => decideProGameFlow(s, "instinct"))}>
            {C.proMoments.instinct}
          </Button>
        ) : (
          <Button variant="primary" className="max-sm:flex-1" onClick={() => apply((s) => decideProGameFlow(s, "instinct"))}>
            {L.playGame(live.games.length + 1)}
          </Button>
        )}
        <Button variant="secondary" className="max-sm:flex-1" onClick={() => apply(simProSeriesFlow)}>
          {L.simSeries}
        </Button>
      </div>
      <div>
        <Button variant="ghost" size="sm" onClick={() => apply(simProEventFlow)}>
          {L.simEvent}
        </Button>
      </div>
      <p className="text-xs leading-snug text-faint">{L.simHint}</p>
    </div>
  );
}
