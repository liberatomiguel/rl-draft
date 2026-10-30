"use client";

/** Achievements album — discoverable straight from the home screen. */

import { useCopy } from "@/content/copy";
import { useMounted } from "@/store/useMounted";
import { useProfileStore } from "@/store/profileStore";
import { Badge } from "@/components/ui/Badge";
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

  return (
    <div className="rise-in">
      <BackToMenu />
      <SectionTitle
        kicker={ACH_UI.kicker}
        title={ACH_UI.title}
        right={
          <Badge tone="orange" className="!text-sm">
            {totals.earned}/{totals.total}
          </Badge>
        }
        className="mb-6"
      />
      <AchievementsGrid earned={mounted ? earned : {}} careerMarks={mounted ? careerMarks : []} />
    </div>
  );
}
