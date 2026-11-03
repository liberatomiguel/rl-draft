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

import { useEffect, useState } from "react";
import { useCareerCopy } from "@/content/careerCopy";
import { useCopy } from "@/content/copy";
import { seasonLabelFor } from "@/engine/career/calendar";
import { cx } from "@/lib/util";
import { moneyNoticeOf } from "@/store/careerFlow";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { coachPlansOf, trainingReportOf } from "@/store/careerTraining";
import { useSettings } from "@/store/settingsStore";
import { buttonClass, Button } from "@/components/ui/Button";
import { AppLink } from "@/components/ui/AppLink";
import { Modal } from "@/components/ui/Modal";
import { WhistleIcon } from "@/components/ui/icons";
import {
  CycleReportBody,
  fmt1,
  ObjectiveIcon,
  OBJECTIVE_TONE,
  PackageChips,
  reportAvgOf,
  reportCompletionOf,
} from "@/components/career/training/TrainingPackageParts";

export function TrainingReportModal() {
  const C = useCareerCopy();
  const t = useCopy();
  const save = useCareerStore(selectActiveSave);
  const acknowledge = useCareerStore((s) => s.acknowledgeTrainingReport);
  const continueReport = useCareerStore((s) => s.continueTrainingReport);
  const showReports = useSettings((s) => s.careerTrainingReports);
  const setSettings = useSettings((s) => s.set);
  const [dontShow, setDontShow] = useState(false);
  const report = save ? trainingReportOf(save) : null;
  // Hiding the recap must have the same lifecycle as its Continue button.
  useEffect(() => {
    if (!showReports && report) continueReport();
  }, [showReports, report, continueReport]);
  if (!showReports || !save || !report || moneyNoticeOf(save)) return null;
  const remember = () => { if (dontShow) setSettings("careerTrainingReports", false); setDontShow(false); };
  const dismiss = () => { remember(); acknowledge(); };
  const Y = C.training.cycle;
  const R = Y.report;
  const objective = report.package?.objective ?? null;
  const tone = objective ? OBJECTIVE_TONE[objective] : { text: "text-sub", ring: "border-line", bg: "bg-white/[0.02]" };
  const avg = reportAvgOf(report);
  const completion = reportCompletionOf(report);
  const canRepeat = save.phase === "running" && report.package !== null;
  const coachRuns = coachPlansOf(save) && Boolean(save.training?.plan?.package) && save.coach;
  return (
    <Modal
      open
      wide
      title={R.title(report.periodIndex + 1, seasonLabelFor(report.seasonIndex))}
      onClose={dismiss}
      actions={
        <div className="flex w-full flex-wrap justify-start gap-2">
          <Button variant="primary" size="md" className="min-h-11" disabled={!canRepeat} onClick={() => { remember(); continueReport(); }}>{R.close}</Button>
          <AppLink href="/career/training?edit=1" className={cx(buttonClass("secondary", "md"), "min-h-11")} onClick={dismiss}>
            {R.planNext}
          </AppLink>
        </div>
      }
    >
      <div className={cx("mb-4 rounded-xl border p-3.5", tone.ring, tone.bg)}>
        <div className="flex items-center gap-3">
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", tone.ring, tone.text)}>
            <ObjectiveIcon objective={objective} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="display truncate text-base font-bold text-ink">{objective ? Y.objectives[objective] : Y.by.base}</p>
            <p className="truncate text-[11px] text-faint">{Y.by[report.author] ?? ""}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={cx("display text-2xl font-bold tabular-nums", avg >= 0 ? "text-good" : "text-bad")}>{fmt1(avg)}</p>
            <p className="text-[10px] text-faint">{R.avg}</p>
          </div>
        </div>
        <PackageChips pkg={report.package} C={C} className="mt-3" />
        {completion > 0.004 ? <p className="mt-2 text-[10px] text-faint">{R.completion(completion.toFixed(2))}</p> : null}
      </div>
      <CycleReportBody summary={report} C={C} statLabels={t.STAT_LABELS} stats={false} />
      {coachRuns && save.coach ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-sub">
          <WhistleIcon className="h-3.5 w-3.5 shrink-0" />
          {R.coachNext(save.coach.name)}
        </p>
      ) : null}
      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-2 border-t border-line pt-3 text-xs text-sub">
        <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-4 w-4 accent-orange" />
        {R.dontShowAgain}
      </label>
    </Modal>
  );
}
