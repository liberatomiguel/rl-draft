"use client";

import type { CareerCopy } from "@/content/careerCopy";
import { dayOfWeekOf, weekOfDay } from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";
import { useCareerStore } from "@/store/careerStore";
import { teamChemistryOf } from "@/store/careerTraining";
import { ScrimSeriesRow } from "../ScrimBroadcast";

/**
 * The cycle's growth and the week's scrims, under Training on HQ's team board.
 * Recorded results only: advancing the calendar never triggers a second sim.
 *
 * rc9 HQ (#240): moved out of the day card (it is the squad's news, not the
 * day's). Two quiet parts: the growth as three small signed figures with their
 * labels, then the scrims as rows (day, opponent, score). Our own crest and tag
 * on every row are gone: every scrim is ours. Nothing to show: nothing drawn.
 */
export function WeeklyScrimLine({ save, C, className }: { save: CareerSave; C: CareerCopy; className?: string }) {
  const playing = useCareerStore((s) => s.scrimPlayback?.id);
  const entries = save.scrimLog
    .filter(e => e.seasonIndex === save.clock.seasonIndex && e.day <= save.clock.day && weekOfDay(e.day) === weekOfDay(save.clock.day))
    .sort((a, b) => a.day - b.day);
  const plan = save.training?.plan;
  const baseline = plan ? { players: Object.fromEntries(Object.entries(plan.players).map(([id,p]) => [id, { overall: p.overallStart }])), chemistry: plan.chemStart } : null;
  const gains = baseline ? save.squad.filter(p => baseline.players[p.id]).map(p => ({ name: p.name, gain: p.overall - baseline.players[p.id].overall })) : [];
  const average = gains.length ? gains.reduce((n,p) => n+p.gain,0)/gains.length : 0;
  const best = [...gains].sort((a,b) => b.gain-a.gain)[0];
  const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
  const tone = (n: number) => (n > 0 ? "text-good" : n < 0 ? "text-bad" : "text-sub");
  const showGrowth = gains.length > 0 && baseline !== null;
  const scrimsPlanned = (plan?.package?.scrimsPerWeek ?? 0) > 0;
  if (!showGrowth && entries.length === 0 && !scrimsPlanned) return null;
  const chem = baseline ? teamChemistryOf(save) - baseline.chemistry : 0;
  return (
    <div className={cx("space-y-4", className)}>
      {showGrowth ? (
        <div>
          <p className="kicker">{C.training.weekSummary}</p>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex flex-row-reverse items-baseline justify-end gap-1.5">
              <dt className="text-xs text-faint">{C.common.ovr}</dt>
              <dd className={cx("display text-[15px] font-bold tabular-nums", tone(average))}>{fmt(average)}</dd>
            </div>
            <div className="flex flex-row-reverse items-baseline justify-end gap-1.5">
              <dt className="text-xs text-faint">{C.training.weekChemistry}</dt>
              <dd className={cx("display text-[15px] font-bold tabular-nums", tone(chem))}>{fmt(chem)}</dd>
            </div>
            {best ? (
              <div className="flex flex-row-reverse items-baseline justify-end gap-1.5">
                <dt className="text-xs text-faint">{best.name}</dt>
                <dd className={cx("display text-[15px] font-bold tabular-nums", tone(best.gain))}>{fmt(best.gain)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
      {entries.length > 0 || scrimsPlanned ? (
        <div aria-label={C.training.weekScrims}>
          <p className="kicker">{C.training.weekScrims}</p>
          {entries.length === 0 ? (
            <p className="mt-2 text-xs text-faint">{C.training.weekScrimsEmpty}</p>
          ) : (
            <ul className="mt-1">
              {entries.map(e => (
                e.id === playing ? <ScrimSeriesRow key={e.id} entry={e} save={save} C={C} /> :
                <li key={e.id} className="flex min-h-10 min-w-0 items-center gap-3 border-b border-line py-1.5 text-sm last:border-b-0" aria-label={e.won ? C.scrim.won(e.oppName, e.scoreA, e.scoreB) : C.scrim.lost(e.oppName, e.scoreA, e.scoreB)}>
                  <span className="w-8 shrink-0 text-xs text-faint">{C.dates.weekdays[dayOfWeekOf(e.day) - 1]}</span>
                  {e.oppRef ? <OrgMark save={save} orgRef={e.oppRef} size="xs" className="shrink-0" /> : null}
                  <span className="min-w-0 flex-1 truncate text-sub" title={e.oppName}>{e.oppName}</span>
                  <span className={cx("display shrink-0 text-[15px] font-bold tabular-nums", e.won ? "text-good" : "text-bad")}>{e.scoreA}–{e.scoreB}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
