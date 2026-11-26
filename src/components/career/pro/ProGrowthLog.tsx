"use client";

/**
 * v2.2 Pro (PRO-SPEC §3, §4.1): "why did my overall move". The save's explained
 * attribute changes, newest first, each with its source and its day.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { useCopy } from "@/content/copy";
import type { ProGrowthEntry } from "@/engine/career/pro/types";

const SHOWN = 14;

export function ProGrowthLog({ log }: { log: ProGrowthEntry[] }) {
  const C = useCareerCopy().proWeek;
  const copy = useCopy();
  const rows = [...log].reverse().slice(0, SHOWN);
  return (
    <section aria-label={C.log.title}>
      <p className="kicker mb-3">{C.log.title}</p>
      {rows.length === 0 ? (
        <p className="text-sm leading-snug text-sub">{C.log.empty}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((e, i) => (
            <li key={`${e.seasonIndex}:${e.day}:${e.stat}:${e.source}:${i}`} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
              <span className="min-w-0">
                <span className={e.delta >= 0 ? "text-ink" : "text-bad"}>{C.log.line(copy.STAT_LABELS[e.stat], e.delta)}</span>
                <span className="ml-2 text-xs text-sub">{(e.reason && C.log.reasons[e.reason]) || C.log.source[e.source] || e.source}</span>
              </span>
              <span className="shrink-0 text-xs text-faint">{C.log.day(e.seasonIndex, e.day)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
