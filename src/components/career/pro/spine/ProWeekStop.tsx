"use client";

/**
 * v2.2 Pro spine round 2 (PROSPINE): the week planner says why the week
 * stopped before Monday (a matchday, an event in progress, an offer, a
 * report, the season's end) and points to the career hub.
 */

import { useCareerCopy } from "@/content/careerCopy";
import type { ProSave } from "@/engine/career/pro/types";
import { AppLink } from "@/components/ui/AppLink";
import { buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { proNextEventOf, proWeekStopOf } from "@/store/proFlow";

export function ProWeekStop({ save }: { save: ProSave }) {
  const P = useCareerCopy().proWorld;
  const S = P.stopped;
  const stop = proWeekStopOf(save);
  const next = proNextEventOf(save);
  if (!stop) {
    return next ? <p className="mt-3 text-xs text-sub">{S.next(P.nextEvent(next.name, P.days[((next.day - 1) % 7) + 1] ?? ""))}</p> : null;
  }
  const line =
    stop.kind === "matchday"
      ? S.matchday(stop.name)
      : stop.kind === "event"
        ? S.event(stop.name)
        : stop.kind === "offer"
          ? S.offer(stop.n)
          : stop.kind === "report"
            ? S.report
            : stop.kind === "seasonEnd"
              ? S.seasonEnd
              : S.retired;
  return (
    <Panel className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm text-ink">{line}</p>
      <AppLink href="/career/pro/career" className={buttonClass("primary", "sm")}>
        {S.open}
      </AppLink>
    </Panel>
  );
}
