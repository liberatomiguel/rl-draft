"use client";

import type { CareerCopy } from "@/content/careerCopy";
import { dayOfWeekOf, weekOfDay } from "@/engine/career/calendar";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { OrgMark } from "@/components/career/OrgMark";

/** Recorded results only: advancing the calendar never triggers a second sim. */
export function WeeklyScrimLine({ save, C }: { save: CareerSave; C: CareerCopy }) {
  const entries = save.scrimLog
    .filter(e => e.seasonIndex === save.clock.seasonIndex && e.day <= save.clock.day && weekOfDay(e.day) === weekOfDay(save.clock.day))
    .sort((a, b) => a.day - b.day);
  return (
    <div className="mt-3 border-t border-line/60 pt-3" aria-label={C.training.weekScrims}>
      <p className="mb-2 text-[11px] font-semibold text-faint">{C.training.weekScrims}</p>
      {entries.length === 0 ? <p className="text-xs text-faint">{C.training.weekScrimsEmpty}</p> : (
        <ul className="space-y-2">
          {entries.map(e => (
            <li key={e.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-line/60 bg-white/[0.025] px-2.5 py-2 text-xs" aria-label={e.won ? C.scrim.won(e.oppName, e.scoreA, e.scoreB) : C.scrim.lost(e.oppName, e.scoreA, e.scoreB)}>
              <span className="w-6 shrink-0 text-[10px] text-faint">{C.dates.weekdays[dayOfWeekOf(e.day) - 1]}</span>
              <OrgMark save={save} orgRef="user" size="sm" className="shrink-0" />
              <span className="min-w-0 flex-1 truncate font-semibold text-sub" title={save.identity.orgName}>{save.identity.abbrev}</span>
              <span className={cx("shrink-0 rounded-md bg-black/20 px-2 py-1 font-mono text-sm font-bold tabular-nums", e.won ? "text-good" : "text-bad")}>{e.scoreA}–{e.scoreB}</span>
              <span className="min-w-0 flex-[2] truncate text-sub" title={e.oppName}>{e.oppName}</span>
              {e.oppRef ? <OrgMark save={save} orgRef={e.oppRef} size="sm" className="shrink-0" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-[10px] font-bold text-sub" aria-label={e.oppName}>{e.oppName.slice(0, 2).toUpperCase()}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
