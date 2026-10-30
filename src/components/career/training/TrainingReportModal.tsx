"use client";

/**
 * Road to Worlds — the cycle results modal (rc.35, front T).
 *
 * Miguel (rc.34 playtest): "I did not get the pop-up at the end of a cycle".
 * Root cause: rc.34 filed each cycle's summary into the history and a news
 * line only — no component ever surfaced it. Mounted once in the career
 * shell, this shows the newest filed report the manager has not seen
 * (`careerTraining.trainingReportOf`): per-player gains, the squad average,
 * the top gain. Closing it stamps `training.reportSeen` in the save, so it
 * survives a reload and never repeats. It waits while a money notice is up.
 */

import { useCareerCopy } from "@/content/careerCopy";
import { useCopy } from "@/content/copy";
import { seasonLabelFor } from "@/engine/career/calendar";
import { moneyNoticeOf } from "@/store/careerFlow";
import { selectActiveSave, useCareerStore } from "@/store/careerStore";
import { trainingReportOf } from "@/store/careerTraining";
import { buttonClass, Button } from "@/components/ui/Button";
import { AppLink } from "@/components/ui/AppLink";
import { Modal } from "@/components/ui/Modal";
import { CycleReportBody } from "@/components/career/training/TrainingPackageParts";

export function TrainingReportModal() {
  const C = useCareerCopy();
  const t = useCopy();
  const save = useCareerStore(selectActiveSave);
  const acknowledge = useCareerStore((s) => s.acknowledgeTrainingReport);
  const report = save ? trainingReportOf(save) : null;
  if (!save || !report || moneyNoticeOf(save)) return null;
  const R = C.training.cycle.report;
  return (
    <Modal
      open
      title={R.title(report.periodIndex + 1, seasonLabelFor(report.seasonIndex))}
      onClose={acknowledge}
      actions={
        <>
          <AppLink href="/career/training" className={buttonClass("ghost", "md")} onClick={acknowledge}>
            {R.open}
          </AppLink>
          <Button variant="primary" size="md" onClick={acknowledge}>
            {R.close}
          </Button>
        </>
      }
    >
      <p className="kicker mb-3 text-[10px] text-good">{R.kicker}</p>
      <CycleReportBody summary={report} C={C} statLabels={t.STAT_LABELS} />
    </Modal>
  );
}
