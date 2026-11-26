"use client";

/**
 * v2.2 Pro spine QA round (PROSPINE): Monday's plan, one tap (the coach's
 * plan, last week again, or the planner), the auto-plan opt-in; and the line
 * that says what last week did and why Continue stopped.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { rankOf } from "@/engine/career/pro/ranked";
import type { ProSave } from "@/engine/career/pro/types";
import { AppLink } from "@/components/ui/AppLink";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { advanceProToNextStopFlow, autoPlanOf, confirmProWeekFlow, proCoachPlanOf, setProAutoPlanFlow } from "@/store/proFlow";
import { useProStore } from "@/store/proStore";

export function ProWeekGate({ save }: { save: ProSave }) {
  const P = useCareerCopy().proWorld;
  const G = P.weekStop;
  const apply = useProStore((s) => s.apply);
  const coach = proCoachPlanOf(save);
  const repeat = save.player.lastPlan ? autoPlanOf(save, "repeat") : null;
  return (
    <Panel className="p-5">
      <h3 className="display text-lg font-bold uppercase leading-none text-ink">{G.title}</h3>
      <p className="mt-2 text-sm leading-snug text-sub">{G.body}</p>
      <ol className="mt-3 grid grid-cols-3 gap-2">
        {coach.map((a, i) => (
          <li key={i} className="rounded-md border border-line px-2 py-2 text-center">
            <span className="block text-[11px] uppercase tracking-wider text-faint">{P.block[i]}</span>
            <span className="mt-0.5 block text-sm font-semibold text-ink">{P.activity[a.kind]}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => apply((s) => advanceProToNextStopFlow(confirmProWeekFlow(s, "coach")))}>
          {G.coach}
        </Button>
        {repeat ? (
          <Button variant="secondary" onClick={() => apply((s) => advanceProToNextStopFlow(confirmProWeekFlow(s, "repeat")))}>
            {G.repeat}
          </Button>
        ) : null}
        <AppLink href="/career/pro/week" className={buttonClass("secondary", "md")}>
          {G.own}
        </AppLink>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <Button variant="ghost" size="sm" onClick={() => apply((s) => confirmProWeekFlow(setProAutoPlanFlow(s, true), s.weekPlan ? "own" : "coach"))}>
          {G.auto}
        </Button>
        <p className="mt-1 text-xs leading-snug text-faint">{G.autoHint}</p>
      </div>
    </Panel>
  );
}

/** What last week did (growth, energy, rank) and, when Continue stopped for it, the reason. */
export function ProLastWeek({ save }: { save: ProSave }) {
  const C = useCareerCopy();
  const P = C.proWorld;
  const N = P.notices;
  const apply = useProStore((s) => s.apply);
  const log = save.lastWeekLog;
  const n = save.notice;
  const notice = !n
    ? null
    : n.kind === "offerExpiring"
      ? N.offerExpiring(n.name, n.days)
      : n.kind === "burnoutWarning"
        ? N.burnoutWarning(n.energy)
        : n.kind === "burnedOut"
          ? N.burnedOut(n.weeks)
          : n.kind === "contractEnding"
            ? N.contractEnding(n.org, n.renewal)
            : n.kind === "planFellBack"
              ? N.planFellBack(n.energy)
              : n.kind === "rolePromoted"
                ? N.rolePromoted(n.org)
                : N.roleKept(n.org);
  if (!log && !notice && !save.autoPlan) return null;
  const growth = log ? log.growth.reduce((a, g) => a + g.delta, 0) : 0;
  const ranks = log?.notes.filter((x) => x.code === "rankUp" || x.code === "rankDown") ?? [];
  const now = rankOf(save.player.mmr);
  return (
    <div className="space-y-1 text-sm">
      {notice ? <p className="font-semibold text-ink">{notice}</p> : null}
      {log ? (
        <p className="text-sub">
          <span className="kicker mr-2">{P.lastWeek.title}</span>
          {P.lastWeek.line(`${growth >= 0 ? "+" : ""}${growth.toFixed(2)}`, log.energyTrace[log.energyTrace.length - 1] ?? Math.round(save.player.energy))}
          {ranks.length > 0 ? ` ${P.lastWeek.rank(`${now.label}${now.division ? ` ${now.division}` : ""}`)}` : ""}{" "}
          <AppLink href="/career/pro/week" className="font-semibold text-blue-bright hover:underline">
            {P.lastWeek.see}
          </AppLink>
        </p>
      ) : null}
      {save.autoPlan ? (
        <p className="text-xs text-faint">
          {P.weekStop.autoOn}{" "}
          <button type="button" className="font-semibold text-blue-bright hover:underline" onClick={() => apply((s) => setProAutoPlanFlow(s, false))}>
            {P.weekStop.autoOff}
          </button>
        </p>
      ) : null}
    </div>
  );
}
