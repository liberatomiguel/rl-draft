"use client";

/** Achievements album — discoverable straight from the home screen. */

import { useCopy } from "@/content/copy";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { BackToMenu } from "@/components/layout/LeaveRunGuard";
import { SectionTitle } from "@/components/ui/Panel";
import { AchievementsGrid, achievementTotals } from "@/components/AchievementsGrid";

export function AchievementsView() {
  const { ACH_UI } = useCopy();
  const mounted = useMounted();
  const earned = useProfileStore((s) => s.achievements);
  // rc.36 (UX-05): Road to Worlds' marks count in the list (and its badge) too.
  const careerMarks = useProfileStore((s) => s.careerMarks);
  const totals = achievementTotals(mounted ? earned : {}, mounted ? careerMarks : []);

  // Job: the list of feats, in groups. The one decision: which feat to chase
  // next. So the list is the page; the count is one figure beside the title.
  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle
        kicker={ACH_UI.kicker}
        title={ACH_UI.title}
        right={
          <p className="display text-3xl font-bold leading-none text-ink">
            {totals.earned}
            <span className="text-base text-faint">/{totals.total}</span>
          </p>
        }
        className="mb-6"
      />
      <AchievementsGrid earned={mounted ? earned : {}} careerMarks={mounted ? careerMarks : []} />
    </div>
  );
}
