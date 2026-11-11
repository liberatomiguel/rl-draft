"use client";
import type { CareerSave } from "@/engine/career/types";
import type { CareerCopy } from "@/content/careerCopy";
import { Panel } from "@/components/ui/Panel";
import { EventTierIcon } from "./event/EventTierIcon";
import { TrophyIcon, SwordsIcon } from "@/components/ui/icons";

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
    [C.launch.winRate, played ? `${Math.round(stats.seriesWins / played * 100)}%` : "—"],
    [C.launch.games, `${stats.gameWins}–${stats.gameLosses}`],
    [C.launch.goals, `${stats.goalsFor} / ${stats.goalsAgainst}`],
  ];
  return <div className="space-y-4">
    <Panel className="overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2"><TrophyIcon className="h-6 w-6 text-amber-300" /><h2 className="display text-lg font-bold text-ink">{C.launch.seasonTitles}</h2><span className="ml-auto display text-3xl font-bold text-amber-300">{save.history.at(-1)?.titles ?? season.titles.length}</span></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><Metric label={C.launch.events} value={season.detailed ? season.events : "—"} /><Metric label={C.launch.podiums} value={season.detailed ? season.podiums : "—"} /><Metric label={C.launch.totalTitles} value={Object.values(totals).reduce((a,b) => a+b,0)} /></div>
      <table className="mt-4 w-full text-xs"><thead><tr className="border-b border-line text-faint"><th scope="col" className="pb-2 text-left">{C.launch.competition}</th><th scope="col" className="pb-2 text-right">{C.launch.seasonTitles}</th><th scope="col" className="pb-2 text-right">{C.launch.totalTitles}</th></tr></thead><tbody>{(["t3", "t2", "regional", "major", "worlds"] as const).map(tier => <tr key={tier} className="border-b border-line/50 last:border-0"><th scope="row" className="py-3 text-left font-medium text-sub"><span className="flex items-center gap-2"><EventTierIcon tier={tier} className="h-4 w-4 shrink-0 text-orange-bright" />{C.common.tier[tier]}</span></th><td className="text-right font-mono text-ink">{season.detailed ? season.titles.filter(e => e.tier === tier).length : "—"}</td><td className="text-right font-mono font-bold text-amber-300">{totals[tier]}</td></tr>)}</tbody></table>
      {!season.detailed ? <p className="mt-3 text-xs leading-relaxed text-faint">{C.launch.seasonDetailUnavailable}</p> : null}
    </Panel>
    <Panel className="p-4 sm:p-5"><h2 className="mb-3 flex items-center gap-2 display text-lg font-bold text-ink"><SwordsIcon className="h-5 w-5 text-blue-bright" />{C.launch.careerStats}</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{metrics.map(([label, value]) => <Metric key={String(label)} label={String(label)} value={value} />)}</div></Panel>
  </div>;
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
 return <div className="min-w-0 rounded-xl border border-line bg-white/[0.03] p-3"><p className="text-[10px] leading-relaxed text-faint">{label}</p><p className="display mt-1 text-xl font-bold tabular-nums text-ink">{value}</p></div>;
}
