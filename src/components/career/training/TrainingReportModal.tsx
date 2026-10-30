"use client";

/**
 * Road to Worlds — the cycle results modal (rc.35 front T; rc.36 front T2, R83).
 *
 * Mounted once in the career shell, it shows the newest finished cycle the
 * manager has not seen (`careerTraining.trainingReportOf`; a period on the
 * base is filed quietly, no modal). rc.36 (Miguel: "a prettier cycle-report
 * modal"): a hero in the objective's colour — its icon, the plan as chips,
 * the squad's average gain and what landed on completion — then player by
 * player, the chemistry and the scrims; "Plan the next cycle" leads to the
 * Training tab (a coach who plans the cycles has started it already).
 * Closing stamps `training.reportSeen` in the save, so it survives a reload
 * and never repeats. It waits while a money notice is up.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { useCopy } from "@/content/copy";
import { seasonLabelFor } from "@/engine/career/calendar";
import { cx } from "@/lib/util";
import { moneyNoticeOf } from "@/store/careerFlow";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { coachPlansOf, trainingReportOf } from "@/store/careerTraining";
import { buttonClass, Button } from "@/components/ui/Button";
import { AppLink } from "@/components/ui/AppLink";
import { Modal } from "@/components/ui/Modal";
import { StarIcon, TrophyIcon, WhistleIcon } from "@/components/ui/icons";
import {
  CycleReportBody,
  fmt1,
  OBJECTIVE_TONE,
  ObjectiveIcon,
  PackageChips,
  reportAvgOf,
  reportCompletionOf,
} from "@/components/career/training/TrainingPackageParts";

export function TrainingReportModal() {
  const C = useCareerCopy();
  const t = useCopy();
  const save = useCareerStore(selectActiveSave);
  const acknowledge = useCareerStore((s) => s.acknowledgeTrainingReport);
  const report = save ? trainingReportOf(save) : null;
  if (!save || !report || moneyNoticeOf(save)) return null;
  const Y = C.training.cycle;
  const R = Y.report;
  const objective = report.package?.objective ?? null;
  const tone = objective ? OBJECTIVE_TONE[objective] : { text: "text-sub", ring: "border-line", bg: "bg-white/[0.03]" };
  const avg = reportAvgOf(report);
  const completion = reportCompletionOf(report);
  const best = [...report.players].sort((a, b) => b.after - b.before - (a.after - a.before))[0];
  const coachRuns = coachPlansOf(save) && Boolean(save.training?.plan?.package) && save.coach;
  return (
    <Modal
      open
      wide
      title={R.title(report.periodIndex + 1, seasonLabelFor(report.seasonIndex))}
      onClose={acknowledge}
      actions={
        coachRuns ? (
          <Button variant="primary" size="md" className="min-h-11" onClick={acknowledge}>
            {R.close}
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="md" className="min-h-11" onClick={acknowledge}>
              {R.close}
            </Button>
            <AppLink href="/career/training" className={cx(buttonClass("primary", "md"), "min-h-11")} onClick={acknowledge}>
              {R.planNext} →
            </AppLink>
          </>
        )
      }
    >
      {/* the hero: the objective's colour, the plan, the squad's average, the top gain, the completion */}
      <div className={cx("mb-3 overflow-hidden rounded-2xl border", tone.ring)}>
        <div className={cx("px-3.5 py-3", tone.bg)}>
          <p className={cx("kicker text-[10px]", tone.text)}>{R.kicker}</p>
          <div className="mt-1.5 flex items-center gap-3">
            <span className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 bg-black/25", tone.ring, tone.text)}>
              <ObjectiveIcon objective={objective} className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx("display truncate text-lg font-bold", tone.text)}>{objective ? Y.objectives[objective] : Y.by.base}</p>
              <p className="truncate text-[11px] text-sub">{Y.by[report.author] ?? ""}</p>
            </div>
            <div className="shrink-0 text-right leading-none">
              <p className={cx("display text-3xl font-bold", avg >= 0 ? "text-good" : "text-bad")}>{fmt1(avg)}</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-faint">{R.avg}</p>
            </div>
          </div>
        </div>
        <div className="space-y-2 bg-black/20 px-3.5 py-2.5">
          <PackageChips pkg={report.package} C={C} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold">
            {best ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-ink">
                <StarIcon className="h-3.5 w-3.5 shrink-0 text-amber-300" filled />
                <span className="truncate">
                  {R.best}: {best.name} <span className="text-good">{fmt1(best.after - best.before)}</span>
                </span>
              </span>
            ) : null}
            {completion > 0.004 ? (
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <TrophyIcon className="h-3.5 w-3.5 shrink-0" />
                {R.completion(completion.toFixed(2))}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <CycleReportBody summary={report} C={C} statLabels={t.STAT_LABELS} stats={false} />
      {coachRuns && save.coach ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-cyan">
          <WhistleIcon className="h-3.5 w-3.5 shrink-0" />
          {R.coachNext(save.coach.name)}
        </p>
      ) : null}
    </Modal>
  );
}
