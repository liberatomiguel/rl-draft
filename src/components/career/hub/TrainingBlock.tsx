"use client";

/**
 * Road to Worlds hub — THE TRAINING BLOCK (rc.35 front T; rc.36 front T2, R83).
 *
 * The cycle at a glance, from one flow read (`careerTraining.trainingBlockOf`):
 *  - a running plan: its objective, who set it, the days-left ring, the chips
 *    and the PROGRESS BAR of its promised gain (earned · to come · what lands
 *    on completion), the coach or the hire link, the absence risk, "Adjust";
 *  - nothing running (Miguel: "nothing runs until you pick"): a call to pick
 *    this cycle's plan — the recommendation where the preset or the coach
 *    gives one — and "Choose a plan" into the Training tab. A NUDGE, never a
 *    hold: not picking is the base (R83).
 * A legacy proposal still shows its card until the save passes the load
 * repair. Props unchanged, so HQ's layout places it as before.
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
  PromiseBar,
  RecommendedTag,
  TrainingProposalCard,
} from "@/components/career/training/TrainingPackageParts";
import { AppLink } from "@/components/ui/AppLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AlertIcon, BaseDotIcon, SwordsIcon, WhistleIcon } from "@/components/ui/icons";

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

  const coachLine = b.coach ? (
    <span className="inline-flex min-w-0 items-center gap-1 font-medium text-sub">
      <WhistleIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {b.coach.name}
        {b.coach.effectPct > 0 ? ` · ${Y.coachBoost(b.coach.effectPct)}` : ""}
      </span>
    </span>
  ) : (
    <AppLink href="/career/market#coaches" className="inline-flex min-h-11 items-center gap-1 font-medium text-orange-bright hover:text-orange hover:underline">
      <WhistleIcon className="h-3.5 w-3.5" />
      {Y.hireCoach} →
    </AppLink>
  );

  return (
    <Panel className="rise-in overflow-hidden p-0" style={{ animationDelay: "90ms" }}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <p className="kicker min-w-0 text-[10px] leading-snug">
          {C.hub.trainingTitle} · {Y.cycleOf(b.period.index + 1, b.period.count)}
        </p>
        <Badge tone={trainingDay ? "good" : eventToday ? "orange" : "neutral"} className="shrink-0 whitespace-nowrap">
          {status}
        </Badge>
      </div>

      {b.decision ? (
        <div className="p-4">
          <TrainingProposalCard save={save} decision={b.decision} C={C} onApprove={approve} onAdjust={openTraining} onKeepBase={keepBase} />
        </div>
      ) : b.running && b.cycle ? (
        <div className="space-y-3 px-4 pb-4 pt-2.5">
          {/* what is running */}
          <div className={cx("flex items-center gap-3 rounded-xl border px-3 py-2.5", tone.ring, tone.bg)}>
            <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/25", tone.text)}>
              <ObjectiveIcon objective={objective} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx("display truncate text-base font-bold", tone.text)}>{objective ? Y.objectives[objective] : Y.by.base}</p>
              <p className="truncate text-[11px] text-sub">{Y.by[b.author] ?? ""}</p>
            </div>
            <CycleRing progress={b.cycle.progress} daysLeft={b.cycle.daysLeft} label={Y.daysLeft(b.cycle.daysLeft)} />
          </div>

          <PackageChips pkg={b.package} C={C} />

          {b.promise ? <PromiseBar promise={b.promise} C={C} /> : null}


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
            {coachLine}
          </div>

          {running ? (
            <Button variant="secondary" size="md" className="min-h-11 w-full sm:w-auto" onClick={openTraining}>
              {Y.adjust} →
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 px-4 pb-4 pt-2.5">
          {/* nothing running: the nudge (never a hold) */}
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong bg-white/[0.02] px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/25 text-faint">
              <BaseDotIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="display text-base font-bold leading-tight text-ink">{Y.idle}</p>
              <p className="text-[11px] leading-snug text-sub">{Y.idleLine}</p>
            </div>
          </div>
          {b.recommended ? (
            <div className="space-y-1.5">
              <RecommendedTag>{Y.recommended}</RecommendedTag>
              <PackageChips pkg={b.recommended} C={C} />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {b.lastAvg !== null && b.last?.package ? (
              <span className="text-sub">
                {Y.lastCycle}: <span className="font-bold text-ink">{fmt1(b.lastAvg)}</span>
              </span>
            ) : null}
            {coachLine}
          </div>
          {running ? (
            <Button variant="primary" size="md" className="min-h-11 w-full sm:w-auto" onClick={openTraining}>
              {Y.choosePlan} →
            </Button>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
