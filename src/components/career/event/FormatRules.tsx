/**
 * v2.2 event formats (FORMATS-SPEC.md): how a Major / Worlds of this season
 * is played, in two lines under the lobby's format line: Saturday's stage,
 * then Sunday's bracket (with who starts where in a hybrid bracket).
 */

import type { CareerCopy } from "@/content/careerCopy";
import type { EventLayout } from "@/engine/types";

export function FormatRules({ C, layout }: { C: CareerCopy; layout: EventLayout }) {
  const F = C.event.formats;
  const hybrid = layout.bracket === "hybrid8" || layout.bracket === "hybrid12";
  const sunday = [hybrid && layout.bracket === "hybrid8" ? F.hybridEntry[layout.stage] : "", F.bracketRule[layout.bracket]]
    .filter(Boolean)
    .join(" ");
  const rows = [
    { label: F.stage[layout.stage], text: F.stageRule[layout.stage] },
    { label: C.event.championshipSunday, text: sunday },
  ];
  return (
    <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="kicker shrink-0 sm:w-36">{r.label}</dt>
          <dd className="text-sub">{r.text}</dd>
        </div>
      ))}
    </dl>
  );
}
