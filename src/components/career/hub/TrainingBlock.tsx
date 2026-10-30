"use client";

/**
 * Road to Worlds hub — THE TRAINING BLOCK (rc.35, front T; rc.34 H3).
 *
 * The cycle at a glance, from one flow read (`careerTraining.trainingBlockOf`):
 * what is running (the objective's icon and name, who set it), the cycle's
 * progress ring with the days left, the expected gain to its end, the
 * scrims, the coach (or the hire link), the absence risk and the last
 * cycle's result — then "Adjust" into the Training tab. rc.34's
 * "Delegate: the coach runs it" switch is gone: a hired coach always runs
 * the plan (Miguel). A legacy proposal still shows its card until the save
 * passes the load repair. Props unchanged, so HQ's layout places it as before.
 */

import { useRouter } from "next/navigation";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { trainingBlockOf } from "@/store/careerTraining";
import { clockLabel } from "@/components/career/careerUi";
import {
  CycleRing,
  fmt1,
  OBJECTIVE_TONE,
  ObjectiveIcon,
  PackageChips,
  TrainingProposalCard,
} from "@/components/career/training/TrainingPackageParts";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AlertIcon, SwordsIcon, TrendUpIcon, WhistleIcon } from "@/components/ui/icons";
import { Panel } from "@/components/ui/Panel";

export function TrainingBlock({ save, C }: { save: CareerSave; C: CareerCopy; statLabels?: Record<string, string> }) {
  const router = useRouter();
  const approve = useCareerStore((s) => s.approveTrainingProposal);
  const keepBase = useCareerStore((s) => s.keepBaseTraining);
  const Y = C.training.cycle;
  const b = trainingBlockOf(save);
  const clock = clockLabel(save);
  const running = save.phase === "running";
  const eventToday = Boolean(save.pendingEventDef && save.pendingEventDef.day === save.clock.day) || Boolean(save.activeEvent);
  const trainingDay = running && !eventToday && clock.dow <= 5;
  const status = eventToday ? C.hub.trainingMatch : trainingDay ? C.hub.trainingToday : C.hub.trainingRest;
  const objective = b.package?.objective ?? null;
  const tone = objective ? OBJECTIVE_TONE[objective] : { text: "text-sub", ring: "border-line", bg: "bg-white/[0.03]" };
  const openTraining = () => router.push("/career/training");

  return (
    <Panel className="rise-in overflow-hidden p-0" style={{ animationDelay: "90ms" }}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <p className="kicker min-w-0 truncate text-[10px]">
          {C.hub.trainingTitle} · {Y.cycleOf(b.period.index + 1, b.period.count)}
        </p>
        <Badge tone={trainingDay ? "good" : eventToday ? "orange" : "neutral"}>{status}</Badge>
      </div>

      {b.decision ? (
        <div className="p-4">
          <TrainingProposalCard save={save} decision={b.decision} C={C} onApprove={approve} onAdjust={openTraining} onKeepBase={keepBase} />
        </div>
      ) : (
        <div className="space-y-3 px-4 pb-4 pt-2.5">
          {/* what is running */}
          <div className={cx("flex items-center gap-3 rounded-xl border px-3 py-2.5", tone.ring, tone.bg)}>
            <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/25", tone.text)}>
              <ObjectiveIcon objective={objective} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx("display truncate text-base font-bold", objective ? tone.text : "text-ink")}>
                {objective ? Y.objectives[objective] : Y.by.base}
              </p>
              <p className="truncate text-[11px] text-sub">{Y.by[b.author] ?? ""}</p>
            </div>
            <CycleRing progress={b.progress} daysLeft={b.period.daysLeft} label={Y.daysLeft(b.period.daysLeft)} className="h-14 w-14" />
          </div>

          <PackageChips pkg={b.package} C={C} />

          {/* the numbers */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-good/30 bg-good/[0.06] px-3 py-2">
              <p className="flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-good">
                <TrendUpIcon className="h-3 w-3" />
                {Y.expected}
              </p>
              <p className="display text-lg font-bold text-good">{Y.expectedGain(b.expectedAvg.toFixed(2))}</p>
              <p className="text-[10px] text-faint">{Y.daysLeft(b.period.daysLeft)}</p>
            </div>
            <div className="rounded-xl border border-line bg-black/20 px-3 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-faint">{Y.lastCycle}</p>
              {b.lastAvg !== null ? (
                <>
                  <p className={cx("display text-lg font-bold", b.lastAvg >= 0 ? "text-ink" : "text-bad")}>{fmt1(b.lastAvg)}</p>
                  {b.lastBest ? (
                    <p className="truncate text-[10px] text-sub">
                      {b.lastBest.name} <span className="font-bold text-good">{fmt1(b.lastBest.gain)}</span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-[11px] text-faint">{Y.lastNone}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {b.package && b.package.scrimsPerWeek > 0 ? (
              <span className="inline-flex items-center gap-1 text-sub">
                <SwordsIcon className="h-3.5 w-3.5" />
                {Y.scrimsDone(b.scrims.done, b.scrims.planned)}
                {b.scrims.done > 0 ? ` · ${Y.record(b.scrims.won, b.scrims.lost)}` : ""}
              </span>
            ) : null}
            {b.unavailabilityPts > 0 ? (
              <span className="inline-flex items-center gap-1 text-orange-bright">
                <AlertIcon className="h-3.5 w-3.5" />
                {Y.risk(b.unavailabilityPts.toFixed(1))}
              </span>
            ) : null}
            {b.coach ? (
              <span className="inline-flex min-w-0 items-center gap-1 font-semibold text-cyan">
                <WhistleIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {b.coach.name}
                  {b.coach.effectPct > 0 ? ` · ${Y.coachBoost(b.coach.effectPct)}` : ""}
                </span>
              </span>
            ) : (
              <AppLink href="/career/market#coaches" className="inline-flex min-h-11 items-center gap-1 font-semibold text-orange-bright hover:underline">
                <WhistleIcon className="h-3.5 w-3.5" />
                {Y.hireCoach} →
              </AppLink>
            )}
          </div>

          {running ? (
            <Button variant="secondary" size="md" className="min-h-11 w-full sm:w-auto" onClick={openTraining}>
              {Y.adjust} →
            </Button>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
