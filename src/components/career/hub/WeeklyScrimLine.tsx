"use client";

import type { CareerCopy } from "@/content/careerCopy";
import { dayOfWeekOf, weekOfDay } from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";

/** Recorded results only: advancing the calendar never triggers a second sim. */
export function WeeklyScrimLine({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const entries = save.scrimLog
    .filter(e => e.seasonIndex === save.clock.seasonIndex && e.day <= save.clock.day && weekOfDay(e.day) === weekOfDay(save.clock.day))
    .sort((a, b) => a.day - b.day);
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-t border-line/60 pt-2.5 text-[11px]" aria-label={C.training.weekScrims}>
      <span className="shrink-0 font-semibold text-faint">{C.training.weekScrims}</span>
      {entries.length === 0 ? <span className="text-faint">{C.training.weekScrimsEmpty}</span> : entries.map(e => (
        <span key={e.id} className="inline-flex min-w-0 max-w-full items-baseline gap-1.5" title={e.won ? C.scrim.won(e.oppName, e.scoreA, e.scoreB) : C.scrim.lost(e.oppName, e.scoreA, e.scoreB)}>
          <span className="shrink-0 text-faint">{C.dates.weekdays[dayOfWeekOf(e.day) - 1]}</span>
          <span className={cx("shrink-0 font-mono font-semibold", e.won ? "text-good" : "text-bad")}>{e.scoreA}–{e.scoreB}</span>
          <span className="truncate text-sub">{e.oppName}</span>
        </span>
      ))}
    </div>
  );
}
