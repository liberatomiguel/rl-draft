"use client";

/**
 * v2.2 Pro (PRO-SPEC §3, §4.1): "why did my overall move". The save's explained
 * attribute changes, newest first, each with its source and its day.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { useCopy } from "@/content/copy";
import { PRO_STAT_KEYS } from "@/engine/career/pro/growth";
import type { ProGrowthEntry } from "@/engine/career/pro/types";

const SHOWN = 14;

type Row = { entry: ProGrowthEntry; all: boolean };

/** One ranked session moves every attribute by the same sliver: show it as one line. */
function groupEven(entries: ProGrowthEntry[]): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    let n = 1;
    while (
      i + n < entries.length &&
      entries[i + n].source === e.source &&
      entries[i + n].day === e.day &&
      entries[i + n].seasonIndex === e.seasonIndex &&
      entries[i + n].delta.toFixed(2) === e.delta.toFixed(2) &&
      !e.reason &&
      e.delta > 0
    )
      n++;
    if (n >= PRO_STAT_KEYS.length) {
      out.push({ entry: e, all: true });
      i += n - 1;
    } else out.push({ entry: e, all: false });
  }
  return out;
}

export function ProGrowthLog({ log }: { log: ProGrowthEntry[] }) {
  const C = useCareerCopy().proWeek;
  const copy = useCopy();
  const rows = groupEven([...log].reverse()).slice(0, SHOWN);
  return (
    <section aria-label={C.log.title}>
      <p className="kicker mb-3">{C.log.title}</p>
      {rows.length === 0 ? (
        <p className="text-sm leading-snug text-sub">{C.log.empty}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map(({ entry: e, all }, i) => (
            <li key={`${e.seasonIndex}:${e.day}:${e.stat}:${e.source}:${i}`} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
              <span className="min-w-0">
                <span className={e.delta >= 0 ? "text-ink" : "text-bad"}>{all ? C.projected.allStats(e.delta) : C.log.line(copy.STAT_LABELS[e.stat], e.delta)}</span>
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
