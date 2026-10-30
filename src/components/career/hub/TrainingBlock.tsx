"use client";

/**
 * Road to Worlds hub — THE TRAINING BLOCK (rc.34, DEV-03 / HQ-CONTRACT H3).
 *
 * The period's plan at a glance, read from one flow function
 * (`careerTraining.trainingBlockOf`): the package (objective · focus), the
 * day of the period and the days left, the scrims done of planned and their
 * level, the coach and his effect on this package, the last period's report,
 * and the actions — Adjust (the Training screen), Delegate (the coach runs
 * it). A proposal waiting for approval ("the coach proposes") shows here
 * until front G's decision queue (H1) carries it; `TrainingProposalCard` is
 * the same card either place. Props unchanged since rc.2, so HQ's layout
 * places it as before. rc.33's "edges" chips move to the toolbox (H6).
 */

import { useRouter } from "next/navigation";
import type { CareerCopy } from "@/content/careerCopy";
import type { CareerSave } from "@/engine/career/types";
import { clamp, cx } from "@/lib/util";
import { useCareerStore } from "@/store/careerStore";
import { trainingBlockOf } from "@/store/careerTraining";
import { clockLabel } from "@/components/career/careerUi";
import { focusLabel, TrainingProposalCard, fmt1 } from "@/components/career/training/TrainingPackageParts";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ProgressBar } from "@/components/ui/ProgressBar";

export function TrainingBlock({ save, C }: { save: CareerSave; C: CareerCopy; statLabels?: Record<string, string> }) {
  const router = useRouter();
  const approve = useCareerStore((s) => s.approveTrainingProposal);
  const keepBase = useCareerStore((s) => s.keepBaseTraining);
  const setMode = useCareerStore((s) => s.setTrainingMode);
  const P = C.training.plan;
  const b = trainingBlockOf(save);
  const clock = clockLabel(save);
  const running = save.phase === "running";
  const eventToday = Boolean(save.pendingEventDef && save.pendingEventDef.day === save.clock.day) || Boolean(save.activeEvent);
  const trainingDay = running && !eventToday && clock.dow <= 5;
  const status = eventToday ? C.hub.trainingMatch : trainingDay ? C.hub.trainingToday : C.hub.trainingRest;
  const delegated = b.mode === "coach";

  return (
    <Panel className="rise-in p-4" style={{ animationDelay: "90ms" }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="kicker min-w-0 truncate text-[10px]">
          {C.hub.trainingTitle}
          {b.package ? ` · ${P.objectives[b.package.objective]} · ${focusLabel(C, b.package.focus)}` : ` · ${P.base}`}
        </p>
        <span className="flex items-center gap-2">
          <Badge tone={trainingDay ? "good" : eventToday ? "orange" : "neutral"}>{status}</Badge>
          <AppLink href="/career/training" className="inline-flex min-h-11 items-center text-[11px] font-semibold text-blue-bright underline-offset-4 hover:underline">
            {C.hub.trainingOpen} →
          </AppLink>
        </span>
      </div>

      {b.decision ? (
        <TrainingProposalCard
          save={save}
          decision={b.decision}
          C={C}
          onApprove={approve}
          onAdjust={() => router.push("/career/training")}
          onKeepBase={keepBase}
        />
      ) : (
        <>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="shrink-0 font-semibold text-ink">{P.dayOf(b.period.dayOf, b.period.length)}</span>
            <ProgressBar value={clamp(b.period.dayOf / b.period.length, 0, 1)} tone="blue" className="h-1.5 flex-1" label={P.title} />
            <span className="shrink-0 text-faint">{P.daysLeft(b.period.daysLeft)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
            <span className="text-sub">
              {b.package && b.package.scrimsPerWeek > 0 && b.scrims.level
                ? C.hub.trainingScrims(b.scrims.done, b.scrims.planned, P.levels[b.scrims.level])
                : C.hub.trainingNoScrims}
            </span>
            {b.coach ? (
              <span className="font-semibold text-cyan">{P.coachLine(b.coach.name, b.coach.effectPct)}</span>
            ) : (
              <AppLink href="/career/market#coaches" className="font-semibold text-orange-bright hover:underline">
                {C.hub.trainingCoachNone}
              </AppLink>
            )}
          </div>
          {b.unavailabilityPts > 0 ? (
            <p className="mt-1 text-[11px] text-orange-bright">{C.hub.trainingRisk(b.unavailabilityPts.toFixed(1))}</p>
          ) : null}
          <p className="mt-1 text-[11px] text-faint">
            {b.lastAvg !== null && b.lastBest && b.lastWear
              ? C.hub.trainingLast(fmt1(b.lastAvg), b.lastBest.name, fmt1(b.lastBest.gain), P.wearBand[b.lastWear])
              : C.hub.trainingLastNone}
          </p>
          {running ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button variant="secondary" size="md" className="min-h-11" onClick={() => router.push("/career/training")}>
                {P.edit}
              </Button>
              {save.coach ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={delegated}
                  onClick={() => setMode(delegated ? b.undelegateTo : "coach")}
                  className={cx(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-colors",
                    delegated ? "border-good/50 bg-good/10 text-good" : "border-line bg-white/[0.03] text-sub hover:border-line-strong",
                  )}
                >
                  {delegated ? `${C.hub.trainingDelegated} ✓` : C.hub.trainingDelegate}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}
