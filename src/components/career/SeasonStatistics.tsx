"use client";
import type { CareerSave } from "@/engine/career/types";
import type { CareerCopy } from "@/content/careerCopy";
import { Panel } from "@/components/ui/Panel";
import { EventTierIcon } from "./event/EventTierIcon";
import { TrophyIcon } from "@/components/ui/icons";

export function seasonStatisticsOf(save: CareerSave) {
  const last = save.history.at(-1);
  const season = last?.seasonIndex ?? save.clock.seasonIndex;
  const events = save.eventResults.filter(e => e.seasonIndex === season && e.rows.some(r => r.ref === "user"));
  const titles = events.filter(e => e.tier !== "qualifier" && e.rows.find(r => r.ref === "user")?.placement === "champion");
  const podiums = events.filter(e => e.tier !== "qualifier" && ["champion", "runner_up", "third"].includes(e.rows.find(r => r.ref === "user")?.placement ?? ""));
  const detailed = season === save.clock.seasonIndex && !(last && last.titles > 0 && events.length === 0);
  return { events: events.length, titles, podiums: podiums.length, detailed };
}

export function SeasonStatistics({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const season = seasonStatisticsOf(save); const stats = save.stats;
  const totals = { t3: stats.titlesT3, t2: stats.titlesT2, regional: stats.titlesRegional, major: stats.titlesMajor, worlds: stats.titlesWorlds };
  const played = stats.seriesWins + stats.seriesLosses;
  const metrics = [
    [C.launch.wins, stats.seriesWins], [C.launch.losses, stats.seriesLosses],
    [C.launch.winRate, played ? `${Math.round(stats.seriesWins / played * 100)}%` : "-"],
    [C.launch.games, `${stats.gameWins}–${stats.gameLosses}`],
    [C.launch.goals, `${stats.goalsFor} / ${stats.goalsAgainst}`],
  ];
  return (
    <div className="space-y-4">
      {/* The season's titles: the one gold figure, then the breakdown as a table. Titles are rewards and keep their gold. */}
      <Panel className="p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <TrophyIcon className="h-5 w-5 shrink-0 text-amber-300" />
          <h3 className="card-title">{C.launch.seasonTitles}</h3>
          <span className="display ml-auto text-4xl font-extrabold leading-none text-amber-300">{save.history.at(-1)?.titles ?? season.titles.length}</span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-x-6 border-t border-line pt-4">
          <Metric label={C.launch.events} value={season.detailed ? season.events : "-"} />
          <Metric label={C.launch.podiums} value={season.detailed ? season.podiums : "-"} />
          <Metric label={C.launch.totalTitles} value={Object.values(totals).reduce((a, b) => a + b, 0)} />
        </dl>
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className="kicker pb-2 text-left">{C.launch.competition}</th>
              <th scope="col" className="kicker pb-2 text-right">{C.launch.seasonTitles}</th>
              <th scope="col" className="kicker pb-2 pl-4 text-right">{C.launch.totalTitles}</th>
            </tr>
          </thead>
          <tbody>
            {(["t3", "t2", "regional", "major", "worlds"] as const).map(tier => (
              <tr key={tier} className="border-b border-line last:border-0">
                <th scope="row" className="py-2.5 text-left font-normal text-ink">
                  <span className="flex items-center gap-2">
                    <EventTierIcon tier={tier} className="h-4 w-4 shrink-0 text-sub" />
                    {C.common.tier[tier]}
                  </span>
                </th>
                <td className="display text-right text-lg font-semibold leading-none text-ink">{season.detailed ? season.titles.filter(e => e.tier === tier).length : "-"}</td>
                <td className="display pl-4 text-right text-lg font-bold leading-none text-amber-300">{totals[tier]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!season.detailed ? <p className="mt-3 text-xs leading-relaxed text-faint">{C.launch.seasonDetailUnavailable}</p> : null}
      </Panel>
      {/* The career's record: a strip of figures, no box per number. */}
      <Panel className="p-4 sm:p-5">
        <div className="card-head"><h3 className="card-title">{C.launch.careerStats}</h3></div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
          {metrics.map(([label, value]) => <Metric key={String(label)} label={String(label)} value={value} />)}
        </dl>
      </Panel>
    </div>
  );
}

/** A number set as a number: the figure large, its label quiet under it. */
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col-reverse justify-end">
      <dt className="mt-1.5 text-xs leading-snug text-sub">{label}</dt>
      <dd className="display text-2xl font-bold tabular-nums leading-none text-ink">{value}</dd>
    </div>
  );
}
